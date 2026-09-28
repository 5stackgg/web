// Build a map's meshes straight from the CS2 install, one run per map:
//
//   <map>.tri              the collision hull, clips and sky dropped -- what the
//                          demo parser raycasts for line of sight
//   <map>.grenadeclip.tri  only the grenade-clip brushes, same format; omitted
//                          when the map has none
//   <map>.view.bin         the 3D viewer's render mesh (see lib-view-mesh.mjs)
//
// This replaces the awpy pack as the source of truth. awpy publishes per-build
// snapshots and the one we shipped for a long time (17595823) is many CS2
// builds behind what the nodes actually run, so a map that Valve reworked in
// between was being raycast against its old geometry.
//
// THE .tri is exactly what glb-to-tri.mjs has always produced -- a raw float32
// triangle soup, 9 floats per triangle, in CS2 source units.
//
// Moving off jsDelivr raised the budget but did not remove it. The cap that
// binds now is what READS the mesh: the demo parser drops anything over 1.5M
// triangles or 96MB and the 3D viewer over 96MB, both SILENTLY -- line of sight
// just starts answering "visible" for everything. MESH_MAX_MB defaults to 40
// (~1.1M triangles), comfortably inside that and more than twice the 18MB the
// jsDelivr cap used to force. Most of the active pool now needs no decimation
// at all.
//
// Usage (from a machine with the CS2 files; in practice the map-assets job):
//   CLI=/path/to/Source2Viewer-CLI CS2_DIR=/cs2-game \
//     node scripts/extract-map-meshes.mjs            # every map
//   ... node scripts/extract-map-meshes.mjs de_mirage de_nuke --out /tmp/meshes
//   ... --no-view                                    # collision only
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { glbToTri } from "./glb-to-tri.mjs";
import { minimapVolumes } from "./lib-entities.mjs";
import { fitToCap } from "./lib-mesh.mjs";
import { distanceField, FloorIndex, walkableSurfaces } from "./lib-nav.mjs";
import { decompile, describeOutput, missingOutput, resolveCli } from "./lib-s2v.mjs";
import { buildViewMesh } from "./lib-view-mesh.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const MAP_PREFIXES = /^(de|cs|ar|rush)_[a-z0-9_]+$/;

/**
 * Map VPKs worth building, sorted. `_vanity` is the main-menu backdrop and
 * `_night` a lighting variant every consumer already folds onto the base map.
 */
export function eligibleMaps(mapsDir) {
  return readdirSync(mapsDir)
    .filter((f) => f.endsWith(".vpk"))
    .map((f) => f.replace(/\.vpk$/, ""))
    .filter((m) => MAP_PREFIXES.test(m) && !m.includes("_vanity") && !/_night$/.test(m))
    .sort();
}

function writeOrRemove(path, buf) {
  if (buf && buf.length) {
    writeFileSync(path, buf);
    return true;
  }
  rmSync(path, { force: true });
  return false;
}

function readNavBuffer(cli, vpk, map, tmp) {
  const dir = join(tmp, "nav");
  mkdirSync(dir, { recursive: true });
  try {
    decompile(cli, vpk, `maps/${map}.nav`, dir);
  } catch {
    return null;
  }
  const path = join(dir, "maps", `${map}.nav`);
  return existsSync(path) ? readFileSync(path) : null;
}

/**
 * The render world, as a .glb or failing that a .gltf; returns its path.
 *
 * A .glb is a single buffer, and Source2Viewer refuses to write one of 2 GiB
 * or more: it logs a NotSupportedException, writes nothing and still exits 0.
 * 20.0 also exports every LoD tier of an aggregate, not just the finest, so a
 * big world gets there sooner than its geometry suggests. A .gltf splits its
 * buffers into ~1 GB files beside it and has no cap, so a world that does not
 * come out as a .glb gets one more export in that form.
 */
function exportRenderWorld(cli, vpk, map, dir) {
  const tries = [];
  for (const format of ["glb", "gltf"]) {
    const path = join(dir, "maps", map, `world.${format}`);
    try {
      const run = decompile(cli, vpk, `maps/${map}/world.vwrld_c`, dir, [
        "--gltf_export_format",
        format,
      ]);
      if (existsSync(path)) {
        if (tries.length) {
          console.warn(`⚠ ${map}: render world exported as .gltf instead (${tries.join("; ")})`);
        }
        return path;
      }
      tries.push(`.${format}: ${describeOutput(run) || "the CLI printed nothing"}`);
    } catch (error) {
      tries.push(`.${format}: ${error.message}`);
    }
  }
  throw new Error(
    `no world.glb or world.gltf came out of the render world (${tries.join("; ")})`,
  );
}

/**
 * Everything the view mesh needs from the VPK: the render world, the nav and
 * the minimap volumes.
 */
function exportViewInputs(cli, vpk, map, tmp, lap) {
  let start = performance.now();
  const worldDir = join(tmp, "world");
  mkdirSync(worldDir);
  const world = exportRenderWorld(cli, vpk, map, worldDir);
  lap("renderExport", start);

  start = performance.now();
  const navBuffer = readNavBuffer(cli, vpk, map, tmp);
  const entitiesDir = join(tmp, "entities");
  mkdirSync(entitiesDir);
  try {
    decompile(cli, vpk, `maps/${map}/entities/`, entitiesDir);
  } catch {
    // no entity lump: no minimap volumes, one "world" chunk
  }
  const volumes = [...minimapVolumes(entitiesDir, map)].map(([name, box]) => ({
    name,
    ...box,
  }));
  lap("navAndEntities", start);
  return { world, navBuffer, volumes };
}

/**
 * Build one map's meshes into `outDir`. Returns what was written and how long
 * each stage took. Only the collision half can fail the map: anything that
 * goes wrong on the view side leaves `view` null and the reason in
 * `viewError`, and the map still ships its .tri and grenade clips.
 */
export async function extractMap(
  map,
  {
    mapsDir,
    outDir,
    cli,
    maxMb = 40,
    noDecimate = false,
    view = true,
    viewOptions = {},
  },
) {
  const vpk = join(mapsDir, `${map}.vpk`);
  if (!existsSync(vpk)) {
    throw new Error(`no ${vpk}`);
  }
  const viewPath = join(outDir, `${map}.view.bin`);
  rmSync(viewPath, { force: true });
  const tmp = mkdtempSync(join(tmpdir(), `mesh-${map}-`));
  const timings = {};
  const lap = (name, start) => {
    timings[name] = Math.round(performance.now() - start);
  };

  try {
    // Every export runs before anything big is held in this process: the
    // render export of rush_001 alone peaks at ~5 GB in the CLI, and on top of
    // the collision decimation's heap that no longer fits the job's limit.
    let start = performance.now();
    const physDir = join(tmp, "phys");
    mkdirSync(physDir);
    // The PHYSICS hull, never the textured render mesh: the hull is what a
    // raycast should hit and it is two orders of magnitude smaller.
    const physRun = decompile(cli, vpk, `maps/${map}/world_physics.vmdl_c`, physDir, [
      "--gltf_export_format",
      "glb",
    ]);

    // The CLI writes both a stub `world_physics.glb` and the real geometry as
    // `world_physics_physics.glb`; only the latter has vertices.
    const physGlb = join(physDir, "maps", map, "world_physics_physics.glb");
    if (!existsSync(physGlb)) {
      throw missingOutput("world_physics_physics.glb", physRun);
    }
    lap("collisionExport", start);

    let viewInputs = null;
    let viewError = null;
    if (view) {
      try {
        viewInputs = exportViewInputs(cli, vpk, map, tmp, lap);
      } catch (error) {
        viewError = error.message;
      }
    }

    start = performance.now();
    const collision = glbToTri(physGlb);
    if (collision.count === 0) {
      throw new Error("the hull exported with no triangles");
    }

    // The same sanity check the callout extractor makes: a competitive map
    // spans thousands of source units. Tens means a scale transform leaked in.
    const span = Math.max(
      ...collision.bbox.max.map(Math.abs),
      ...collision.bbox.min.map(Math.abs),
    );
    if (span < 500) {
      throw new Error(
        `bbox spans ${span.toFixed(1)} units -- that is metres, not source units`,
      );
    }

    const fitted = fitToCap(collision.buf, maxMb, noDecimate);
    const triPath = join(outDir, `${map}.tri`);
    if (fitted.drop) {
      rmSync(triPath, { force: true });
    } else {
      writeFileSync(triPath, fitted.buf);
    }
    const grenadeClip = writeOrRemove(
      join(outDir, `${map}.grenadeclip.tri`),
      collision.grenadeClip,
    );
    lap("collision", start);

    const result = {
      map,
      tri: fitted.drop
        ? null
        : { bytes: fitted.buf.length, triangles: fitted.buf.length / 36 },
      note: fitted.note,
      dropped: fitted.drop,
      collisionTriangles: collision.count,
      skipped: collision.skipped,
      grenadeClip: grenadeClip
        ? {
            bytes: collision.grenadeClip.length,
            triangles: collision.grenadeClip.length / 36,
          }
        : null,
      view: null,
      viewError: null,
      timings,
    };

    if (!view) {
      return result;
    }

    if (viewInputs) {
      try {
        start = performance.now();
        const floatsOf = (buf) =>
          new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
        const surfaces = walkableSurfaces(
          viewInputs.navBuffer,
          floatsOf(collision.buf),
          floatsOf(collision.playerClip),
        );
        if (surfaces.rejected) {
          console.warn(
            `⚠ ${map}: NAV REJECTED (${surfaces.rejected}) -- ` +
              "view floors come from collision instead",
          );
        }
        const floors = new FloorIndex(surfaces.polygons);
        const playable = distanceField(surfaces.polygons);
        const built = await buildViewMesh(viewInputs.world, {
          floors,
          playable,
          volumes: viewInputs.volumes,
          ...viewOptions,
        });
        writeFileSync(viewPath, built.buf);
        lap("viewMesh", start);
        result.view = {
          bytes: built.buf.length,
          floors:
            surfaces.source === "nav"
              ? `nav (${surfaces.polygons.length} areas)`
              : `collision (${surfaces.polygons.length} surfaces` +
                `${surfaces.rejected ? ", nav rejected" : ""})`,
          ...built.stats,
        };
      } catch (error) {
        rmSync(viewPath, { force: true });
        viewError = error.message;
      }
    }

    if (viewError) {
      result.viewError = viewError;
      console.warn(
        `⚠ ${map}: VIEW MESH FAILED (${viewError}) -- ` +
          "collision and grenade clips are unaffected",
      );
    }
    return result;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export function describe(result) {
  const parts = [];
  if (result.tri) {
    parts.push(
      `tri ${Math.round(result.tri.triangles).toLocaleString()} (${result.note}, ` +
        `from ${result.collisionTriangles.toLocaleString()}, ` +
        `dropped ${result.skipped.toLocaleString()} clip/sky)`,
    );
  } else {
    parts.push(`tri SKIPPED ${result.note}`);
  }
  if (result.grenadeClip) {
    parts.push(`grenadeclip ${result.grenadeClip.triangles.toLocaleString()}`);
  }
  if (result.viewError) {
    parts.push(`view FAILED (${result.viewError})`);
  }
  if (result.view) {
    const v = result.view;
    parts.push(
      `view ${v.trianglesOut.toLocaleString()} tris from ${v.trianglesIn.toLocaleString()} ` +
        `(${(v.bytes / 1e6).toFixed(1)} MB, ${v.chunks.length} chunk(s), ` +
        `error ${v.error}u, floors from ${v.floors})`,
    );
  }
  return parts.join("; ");
}

async function main() {
  const args = process.argv.slice(2);
  const value = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  // The token AFTER a value-taking flag is that flag's value, not a map name --
  // `--cs2 /opt/cs2` would otherwise be read as a request to build a map called
  // "/opt/cs2", which skips the directory scan entirely and reports FAILED.
  const VALUE_FLAGS = new Set(["--cs2", "--out"]);
  const only = args.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(args[i - 1]));

  const cs2 =
    process.env.CS2_DIR ??
    value(
      "--cs2",
      join(
        process.env.HOME ?? "",
        "Library/Application Support/Steam/steamapps/common/Counter-Strike Global Offensive",
      ),
    );
  const mapsDir = join(cs2, "game", "csgo", "maps");
  const outDir = value("--out", join(root, ".cache", "meshes"));
  const maxMb = Number(process.env.MESH_MAX_MB || "40");
  const noDecimate = process.env.MESH_NO_DECIMATE === "1";

  if (!existsSync(mapsDir)) {
    console.error(`no CS2 maps at ${mapsDir}\n  set CS2_DIR or pass --cs2 <path>`);
    process.exit(1);
  }

  const cli = resolveCli();
  const maps = only.length ? only : eligibleMaps(mapsDir);
  mkdirSync(outDir, { recursive: true });

  let ok = 0;
  for (const map of maps) {
    const start = performance.now();
    try {
      const result = await extractMap(map, {
        mapsDir,
        outDir,
        cli,
        maxMb,
        noDecimate,
        view: !args.includes("--no-view"),
      });
      ok += 1;
      console.log(
        `${map.padEnd(18)} ${describe(result)} ` +
          `[${((performance.now() - start) / 1000).toFixed(1)}s]`,
      );
    } catch (error) {
      console.warn(`${map.padEnd(18)} FAILED ${error.message}`);
    }
  }

  console.log(`\n${ok}/${maps.length} map(s) -> ${outDir}`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
