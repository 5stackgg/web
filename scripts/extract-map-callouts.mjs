// Pull each map's CALLOUTS out of its compiled VPK, so the panel can draw named
// areas on the radar and name a utility throw without anybody typing.
//
// WHERE A CALLOUT LIVES. CS2 stores them as `env_cs_place` entities in the
// map's entity lump — a `place_name`, an `origin`, and a `model` pointing at a
// mesh whose vertices are the volume's corners. There is no mins/maxs to read:
// the box has to be recovered from the model and then translated by the
// entity's origin. The engine resolves the same entities at runtime, which is
// what fills `player_kills.attacker_location` — so the output of this script
// can be checked against the engine's own answer (see the docs).
//
// UNITS. Unlike the mesh pipeline this never goes near glTF, so the 0.0254
// inch→metre node transform never enters into it: the numbers in the lump and
// in the vmdl are already raw CS2 source units, the same space as demo player
// positions. The bbox sanity check below exists to catch the day that stops
// being true — a map that measures in the tens has been scaled by something.
//
// Usage:
//   node scripts/extract-map-callouts.mjs                  # every map with a radar
//   node scripts/extract-map-callouts.mjs de_mirage        # specific map(s)
//   CS2_DIR=~/Steam/steamapps/common/... node scripts/extract-map-callouts.mjs
//
// Publish with the meshes:
//   node scripts/fetch-map-meshes.mjs --publish --with-callouts --tag <build>-6
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDmx } from "./lib-dmx.mjs";
import { decompile as runDecompile, resolveCli } from "./lib-s2v.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stageDir = join(root, ".cache", "callouts");

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
// The token AFTER a value-taking flag is that flag's value, not a map name --
// `--cs2 /opt/cs2` would otherwise be read as a request to extract a map called
// "/opt/cs2", which skips the directory scan entirely and reports FAILED.
const VALUE_FLAGS = new Set(["--cs2"]);
const only = args.filter(
  (a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(args[i - 1]),
);

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
const PAK = join(CS2_DIR, "game", "csgo", "pak01_dir.vpk");

// A place volume that measures less than this on a side is a trigger somebody
// tied to the class by accident, not a callout.
const MIN_EXTENT = 8;

const CLI = resolveCli();

/**
 * Blocks of a decompiled entity lump that name the class asked for.
 *
 * The dump is `key<pad>value` per line, and the value has three shapes that all
 * turn up on one entity -- a bare quoted string, a `resource_name:"..."`
 * wrapper on anything pointing at another asset, and a bracketed comma list for
 * vectors. Reading only the first shape is a silent miss, not an error: the key
 * is there, so nothing complains, and the entity is quietly dropped (or worse,
 * takes a zero vector as its origin).
 */
function entities(text, classname) {
  return text
    .split(/====\d+====/)
    .filter((b) => new RegExp(`^\\s*classname\\s+"?${classname}"?\\s*$`, "m").test(b))
    .map((b) => {
      const raw = (k) => new RegExp(`^\\s*${k}\\s+(.+?)\\s*$`, "m").exec(b)?.[1] ?? null;

      const str = (k) => {
        const value = raw(k);
        if (value == null) {
          return null;
        }
        // resource_name:"maps/x/entities/y.vmdl" -> maps/x/entities/y.vmdl
        const quoted = /"([^"]*)"/.exec(value);
        // Older maps (cs_italy, de_boulder) write asset paths with Windows
        // separators. Left alone they are not a path on Linux at all, so every
        // volume silently fails to resolve and the map looks callout-less.
        return (quoted ? quoted[1] : value).replace(/\\+/g, "/");
      };

      const nums = (k) => {
        const value = raw(k);
        if (value == null) {
          return null;
        }
        const found = value.match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g);
        return found && found.length >= 3 ? found.slice(0, 3).map(Number) : null;
      };

      return {
        place: str("place_name") ?? str("placename") ?? str("targetname"),
        origin: nums("origin") ?? [0, 0, 0],
        mins: nums("mins"),
        maxs: nums("maxs"),
        model: str("model"),
      };
    });
}

/**
 * The AABB of a place volume, in the model's own space.
 *
 * A decompiled `.vmdl` is a ModelDoc that only NAMES its geometry -- the
 * vertices are in a companion DMX beside it. The suffix is NOT guessable: an
 * older map writes `<model>_hull.dmx` (PhysicsHullFile) and a newer one
 * `<model>_phys.dmx` (PhysicsMeshFile), so the filename is read out of the
 * ModelDoc rather than constructed. Guessing it cost de_boulder 40 of its 42
 * callouts, silently.
 */
function boundsOfModel(vmdlPath, tmp) {
  if (!existsSync(vmdlPath)) {
    return null;
  }

  let doc;

  try {
    doc = readFileSync(vmdlPath, "utf8");
  } catch {
    return null;
  }

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let seen = 0;

  // A shape list can name more than one file; the volume is their union.
  for (const match of doc.matchAll(/filename\s*=\s*"([^"]+\.dmx)"/g)) {
    const geometry = join(tmp, match[1].replace(/\\+/g, "/"));

    if (!existsSync(geometry)) {
      continue;
    }

    let elements;

    try {
      ({ elements } = parseDmx(readFileSync(geometry)));
    } catch {
      continue;
    }

    for (const element of elements) {
      const positions = element?.attrs?.["position$0"];

      if (!Array.isArray(positions)) {
        continue;
      }

      for (const point of positions) {
        // VECTOR3 comes back as {x,y,z} or a 3-tuple depending on the writer.
        const x = Array.isArray(point) ? point[0] : point?.x;
        const y = Array.isArray(point) ? point[1] : point?.y;
        const z = Array.isArray(point) ? point[2] : point?.z;

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          continue;
        }

        seen += 1;
        min[0] = Math.min(min[0], x);
        min[1] = Math.min(min[1], y);
        min[2] = Math.min(min[2], z);
        max[0] = Math.max(max[0], x);
        max[1] = Math.max(max[1], y);
        max[2] = Math.max(max[2], z);
      }
    }
  }

  return seen > 0 ? { min, max } : null;
}

function round(v) {
  return Math.round(v * 100) / 100;
}

function extractMap(map) {
  const own = join(MAPS_DIR, `${map}.vpk`);
  const vpk = existsSync(own) ? own : PAK;
  const tmp = mkdtempSync(join(tmpdir(), `callouts-${map}-`));

  try {
    // One call for the whole entities folder: it writes the lump AND every
    // place volume's hull beside it, so a map costs one VPK open instead of one
    // per callout.
    runDecompile(CLI, vpk, `maps/${map}/entities/`, tmp);

    const entitiesDir = join(tmp, "maps", map, "entities");
    const lump = readFileSync(join(entitiesDir, "default_ents.vents"), "utf8");

    const byName = new Map();
    let skipped = 0;
    const places = entities(lump, "env_cs_place");

    // A map with no place entities is a fact about the map -- arms-race and
    // some community maps never define any -- not a failure of this script.
    if (places.length === 0) {
      return { map, callouts: [], skipped: 0, none: true };
    }

    for (const place of places) {
      const name = (place.place ?? "").trim();
      if (!name) {
        skipped += 1;
        continue;
      }

      // A rare point-built place states its box outright; a brush-built one --
      // which is nearly all of them -- carries it on a model.
      const local =
        place.mins && place.maxs
          ? { min: place.mins, max: place.maxs }
          : place.model
            ? boundsOfModel(join(tmp, place.model), tmp)
            : null;

      if (!local) {
        skipped += 1;
        continue;
      }

      const [ox, oy, oz] = place.origin;
      const box = {
        min: [local.min[0] + ox, local.min[1] + oy, local.min[2] + oz].map(round),
        max: [local.max[0] + ox, local.max[1] + oy, local.max[2] + oz].map(round),
      };

      if (
        box.max[0] - box.min[0] < MIN_EXTENT ||
        box.max[1] - box.min[1] < MIN_EXTENT
      ) {
        skipped += 1;
        continue;
      }

      if (!byName.has(name)) {
        byName.set(name, []);
      }
      byName.get(name).push(box);
    }

    const callouts = [...byName.entries()]
      .map(([name, boxes]) => ({ name, boxes }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!callouts.length) {
      throw new Error(
        `${places.length} env_cs_place entities, none with usable geometry`,
      );
    }

    // The one check that catches a scale creeping in: a competitive map spans
    // thousands of source units, never tens.
    const span = Math.max(
      ...callouts.flatMap((c) => c.boxes.map((b) => Math.abs(b.max[0]) + Math.abs(b.min[0]))),
    );
    if (span < 500) {
      throw new Error(
        `bbox spans ${span.toFixed(1)} units -- that is metres, not source units; ` +
          "a scale transform leaked into the vertex read",
      );
    }

    return { map, generatedAt: new Date().toISOString(), callouts, skipped };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  if (!existsSync(MAPS_DIR)) {
    console.error(`✗ no CS2 maps at ${MAPS_DIR}\n  set CS2_DIR or pass --cs2 <path>`);
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
  for (const map of maps) {
    try {
      const result = extractMap(map);

      if (result.none) {
        console.log(`${map.padEnd(16)} no callouts defined by this map`);
        continue;
      }

      const out = join(stageDir, `${map}.callouts.json`);
      writeFileSync(
        out,
        `${JSON.stringify({ map: result.map, generatedAt: result.generatedAt, callouts: result.callouts }, null, 1)}\n`,
      );
      ok += 1;
      const boxes = result.callouts.reduce((n, c) => n + c.boxes.length, 0);
      console.log(
        `${map.padEnd(16)} ${String(result.callouts.length).padStart(3)} callouts, ` +
          `${String(boxes).padStart(3)} boxes${result.skipped ? `, ${result.skipped} skipped` : ""}`,
      );
    } catch (error) {
      console.warn(`${map.padEnd(16)} FAILED ${error.message}`);
    }
  }

  console.log(`\n${ok}/${maps.length} map(s) → ${stageDir}`);
  if (has("--print") && ok) {
    for (const file of readdirSync(stageDir)) {
      const data = JSON.parse(readFileSync(join(stageDir, file), "utf8"));
      console.log(`\n${data.map}: ${data.callouts.map((c) => c.name).join(", ")}`);
    }
  }
  console.log("(publish with: node scripts/fetch-map-meshes.mjs --publish --with-callouts --tag <tag>)");
}

main();
