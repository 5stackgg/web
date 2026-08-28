// Build a map's collision mesh (.tri) straight from the CS2 install.
//
// This replaces the awpy pack as the source of truth. awpy publishes per-build
// snapshots and the one we shipped for a long time (17595823) is many CS2
// builds behind what the nodes actually run, so a map that Valve reworked in
// between was being raycast against its old geometry.
//
// WHAT COMES OUT is exactly what glb-to-tri.mjs has always produced -- a raw
// float32 triangle soup, 9 floats per triangle, in CS2 source units.
//
// Moving off jsDelivr raised the budget but did not remove it. The cap that
// binds now is what READS the mesh: the demo parser drops anything over 1.5M
// triangles or 96MB and the 3D viewer over 96MB, both SILENTLY -- line of sight
// just starts answering "visible" for everything. MESH_MAX_MB defaults to 40
// (~1.1M triangles), comfortably inside that and more than twice the 18MB the
// jsDelivr cap used to force. Most of the active pool now needs no decimation
// at all.
//
// Usage (from a machine with the CS2 files; in practice the cluster):
//   CLI=/path/to/Source2Viewer-CLI CS2_DIR=/cs2-game \
//     node scripts/extract-map-meshes.mjs            # every map
//   ... node scripts/extract-map-meshes.mjs de_mirage de_nuke
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { glbToTri } from "./glb-to-tri.mjs";
import { fitToCap } from "./lib-mesh.mjs";
import { decompile, resolveCli } from "./lib-s2v.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stageDir = join(root, ".cache", "meshes");

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const only = args.filter((a) => !a.startsWith("--"));

const CS2_DIR =
  process.env.CS2_DIR ??
  value(
    "--cs2",
    join(
      process.env.HOME ?? "",
      "Library/Application Support/Steam/steamapps/common/Counter-Strike Global Offensive",
    ),
  );
const MAPS_DIR = join(CS2_DIR, "game", "csgo", "maps");

const MAX_MB = Number(process.env.MESH_MAX_MB || "40");
const NO_DECIMATE = process.env.MESH_NO_DECIMATE === "1";

const CLI = resolveCli();

function extractMap(map) {
  const vpk = join(MAPS_DIR, `${map}.vpk`);
  const tmp = mkdtempSync(join(tmpdir(), `mesh-${map}-`));

  try {
    // The PHYSICS hull, never the textured render mesh: the hull is what a
    // raycast should hit and it is two orders of magnitude smaller.
    decompile(CLI, vpk, `maps/${map}/world_physics.vmdl_c`, tmp, [
      "--gltf_export_format",
      "glb",
    ]);

    // The CLI writes both a stub `world_physics.glb` and the real geometry as
    // `world_physics_physics.glb`; only the latter has vertices.
    const glb = join(tmp, "maps", map, "world_physics_physics.glb");

    if (!existsSync(glb)) {
      throw new Error("no world_physics_physics.glb came out");
    }

    const { buf, count, skipped, bbox } = glbToTri(glb);

    if (count === 0) {
      throw new Error("the hull exported with no triangles");
    }

    // The same sanity check the callout extractor makes: a competitive map
    // spans thousands of source units. Tens means a scale transform leaked in.
    const span = Math.max(...bbox.max.map(Math.abs), ...bbox.min.map(Math.abs));

    if (span < 500) {
      throw new Error(
        `bbox spans ${span.toFixed(1)} units -- that is metres, not source units`,
      );
    }

    const fitted = fitToCap(buf, MAX_MB, NO_DECIMATE);

    return { ...fitted, count, skipped };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  if (!existsSync(MAPS_DIR)) {
    console.error(`no CS2 maps at ${MAPS_DIR}\n  set CS2_DIR or pass --cs2 <path>`);
    process.exit(1);
  }

  const maps = only.length
    ? only
    : readdirSync(MAPS_DIR)
        .filter((f) => /^(de|cs|ar)_[a-z0-9_]+\.vpk$/.test(f) && !f.includes("_vanity"))
        .map((f) => f.replace(/\.vpk$/, ""))
        .sort();

  mkdirSync(stageDir, { recursive: true });

  let ok = 0;
  let bytes = 0;

  for (const map of maps) {
    try {
      const { buf, count, skipped, note, drop } = extractMap(map);

      if (drop) {
        console.warn(`${map.padEnd(18)} SKIPPED ${note} > ${MAX_MB} MB cap`);
        continue;
      }

      const out = join(stageDir, `${map}.tri`);
      writeFileSync(out, buf);
      ok += 1;
      bytes += buf.length;
      console.log(
        `${map.padEnd(18)} ${String(Math.round(buf.length / 36).toLocaleString()).padStart(9)} tris  ` +
          `${note.padEnd(26)} (from ${count.toLocaleString()}, dropped ${skipped.toLocaleString()} clip/sky)`,
      );
    } catch (error) {
      console.warn(`${map.padEnd(18)} FAILED ${error.message}`);
    }
  }

  console.log(
    `\n${ok}/${maps.length} mesh(es), ${(bytes / 1e6).toFixed(0)} MB total -> ${stageDir}`,
  );
}

main();
