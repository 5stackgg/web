// Pull a map's radar straight out of the CS2 files: the overview calibration,
// the radar PNG, the per-room radars of a map that splits its minimap into
// volumes (Rush's rush_001), and the map's poster and icon.
//
// CALIBRATION. Valve's overview gives the radar's TOP-left corner in world units
// (pos_x, pos_y) and the world units per pixel of a 1024px image (scale).
// metadata.json measures from the BOTTOM-left corner to world origin instead:
//   resolution = scale
//   offset     = { x: -pos_x, y: 1024 * scale - pos_y }
//
// VOLUMES. An overview's "Volumes" block is one more radar per room, each with
// its own pos_x/pos_y/scale. The engine swaps to one while the player stands in
// the `cs_minimap_volume` of the same name, so those brushes -- read from the
// map's own VPK -- are the bounds. Without that VPK the bounds fall back to the
// square each room's image covers, and on rush_001 those squares overlap
// (204/207, 203/210, 212/210) where the real volumes do not.
//
// Usage:
//   node scripts/extract-map-radars.mjs rush_001                     # CS2_DIR / Steam
//   node scripts/extract-map-radars.mjs rush_001 --cs2 <cs2 install>
//   node scripts/extract-map-radars.mjs rush_001 --cs2 <.../pak01_dir.vpk>
//   node scripts/extract-map-radars.mjs rush_001 --cs2 <dir of loose files>
//
// A loose directory holds each entry at its VPK path (resource/overviews/...,
// panorama/images/..., maps/<map>/entities/...), which is how the files come
// off a node where only single entries can be streamed out.
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { minimapVolumes } from "./lib-entities.mjs";
import { decompile, resolveCli } from "./lib-s2v.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const radarsDir = join(root, "public", "radars");
const metadataPath = join(radarsDir, "metadata.json");
const postersDir = join(root, "public", "img", "maps", "screenshots");
const iconsDir = join(root, "public", "img", "maps", "icons");

const RADAR_PX = 1024;

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
// The token AFTER a value-taking flag is that flag's value, not a map name.
const VALUE_FLAGS = new Set(["--cs2"]);
const only = args.filter(
  (a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(args[i - 1]),
);

const CS2 =
  process.env.CS2_DIR ??
  value(
    "--cs2",
    join(
      process.env.HOME ?? "",
      "Library/Application Support/Steam/steamapps/common/Counter-Strike Global Offensive",
    ),
  );

const CLI = resolveCli();

function resolveSource(path) {
  if (path.endsWith(".vpk")) {
    return { pak: path, maps: join(dirname(path), "maps") };
  }
  const pak = join(path, "game", "csgo", "pak01_dir.vpk");
  if (existsSync(pak)) {
    return { pak, maps: join(path, "game", "csgo", "maps") };
  }
  return { loose: path };
}

function wantedEntries(map) {
  return {
    overview: `resource/overviews/${map}.txt`,
    images: [
      `panorama/images/overheadmaps/${map}_`,
      `panorama/images/map_icons/screenshots/1080p/${map}_png.vtex_c`,
      `panorama/images/map_icons/map_icon_${map}.vsvg_c`,
    ],
    entities: `maps/${map}/entities/`,
  };
}

/**
 * The same filters the CLI takes for a VPK -- a trailing slash is a folder, a
 * partial name a prefix -- applied to a loose directory.
 */
function copyLoose(loose, filter, dest) {
  const dir = filter.endsWith("/") ? filter.slice(0, -1) : dirname(filter);
  const prefix = filter.endsWith("/") ? "" : basename(filter);
  const from = join(loose, dir);
  if (!existsSync(from)) {
    return;
  }
  for (const name of readdirSync(from)) {
    if (!name.startsWith(prefix)) {
      continue;
    }
    mkdirSync(join(dest, dir), { recursive: true });
    cpSync(join(from, name), join(dest, dir, name), { recursive: true });
  }
}

/**
 * Everything the map needs, decompiled into one tree laid out by VPK path, so
 * the rest of the script never has to know where it came from.
 */
function stage(source, map, tmp) {
  const out = join(tmp, "out");
  const { overview, images, entities } = wantedEntries(map);

  if (source.loose) {
    const input = join(tmp, "in");
    for (const filter of [...images, entities]) {
      copyLoose(source.loose, filter, input);
    }
    // Folder mode decompiles resources only; a plain text file is skipped
    // rather than copied, so the overview goes across by hand.
    if (existsSync(join(source.loose, overview))) {
      mkdirSync(join(out, dirname(overview)), { recursive: true });
      copyFileSync(join(source.loose, overview), join(out, overview));
    }
    if (existsSync(input)) {
      execFileSync(CLI, ["-i", input, "-o", out, "-d", "--recursive"], {
        stdio: "pipe",
      });
    }
    return out;
  }

  decompile(CLI, source.pak, [overview, ...images].join(","), out);

  const mapVpk = join(source.maps, `${map}.vpk`);
  if (existsSync(mapVpk)) {
    decompile(CLI, mapVpk, entities, out);
  }
  return out;
}

/** KeyValues1: quoted or bare tokens, braces for blocks, `//` comments. */
function parseKeyValues(text) {
  const tokens = [];
  const re = /"((?:[^"\\]|\\.)*)"|([{}])|\/\/[^\n]*|([^\s{}"]+)/g;
  for (const match of text.matchAll(re)) {
    if (match[1] !== undefined) {
      tokens.push({ str: match[1] });
    } else if (match[2]) {
      tokens.push({ brace: match[2] });
    } else if (match[3] !== undefined) {
      tokens.push({ str: match[3] });
    }
  }

  let i = 0;
  const block = () => {
    const node = {};
    while (i < tokens.length && tokens[i].brace !== "}") {
      const key = tokens[i++].str;
      if (tokens[i]?.brace === "{") {
        i += 1;
        node[key] = block();
        i += 1;
      } else {
        node[key] = tokens[i++]?.str;
      }
    }
    return node;
  };
  return block();
}

function readOverview(out, map) {
  const path = join(out, "resource", "overviews", `${map}.txt`);
  if (!existsSync(path)) {
    throw new Error(`no resource/overviews/${map}.txt`);
  }
  const parsed = parseKeyValues(readFileSync(path, "utf8"));
  // The root key is the map name, but not always in the file's own case.
  const body = Object.entries(parsed).find(
    ([key]) => key.toLowerCase() === map.toLowerCase(),
  )?.[1];
  if (!body) {
    throw new Error(`overview has no "${map}" block`);
  }

  const calibrate = (entry, name) => {
    const x = Number(entry.pos_x);
    const y = Number(entry.pos_y);
    const scale = Number(entry.scale);
    if (![x, y, scale].every(Number.isFinite) || scale <= 0) {
      throw new Error(`${name}: pos_x/pos_y/scale missing or not numbers`);
    }
    return { x, y, scale };
  };

  const volumesKey = Object.keys(body).find((k) => k.toLowerCase() === "volumes");
  const volumes = Object.entries(volumesKey ? body[volumesKey] : {})
    .filter(([, entry]) => entry && typeof entry === "object")
    .map(([name, entry]) => ({ name, ...calibrate(entry, name) }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));

  return { global: calibrate(body, map), volumes };
}

function round(v, places = 3) {
  const f = 10 ** places;
  return Math.round(v * f) / f;
}

function toCalibration({ x, y, scale }) {
  return {
    resolution: scale,
    offset: { x: round(-x), y: round(RADAR_PX * scale - y) },
  };
}

function imageBounds({ x, y, scale }) {
  return {
    minX: round(x),
    maxX: round(x + RADAR_PX * scale),
    minY: round(y - RADAR_PX * scale),
    maxY: round(y),
  };
}

/**
 * The viewer lays every radar over a 1024 square, and Valve ships the odd room
 * at 1024x1025, which `object-cover` would crop. Anything already square is
 * copied as decoded: re-encoding it only makes the file bigger.
 */
async function writeRadar(from, to) {
  if (!existsSync(from)) {
    throw new Error(`no radar image at ${from.slice(from.indexOf("panorama/"))}`);
  }
  const { width, height } = await sharp(from).metadata();
  if (width === RADAR_PX && height === RADAR_PX) {
    copyFileSync(from, to);
    return;
  }
  await sharp(from)
    .resize(RADAR_PX, RADAR_PX, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toFile(to);
}

async function extractMap(source, map) {
  const tmp = mkdtempSync(join(tmpdir(), `radar-${map}-`));
  try {
    const out = stage(source, map, tmp);
    const { global, volumes } = readOverview(out, map);
    const overheads = join(out, "panorama", "images", "overheadmaps");

    await writeRadar(join(overheads, `${map}_radar_tga.png`), join(radarsDir, `${map}.png`));

    const boxes = minimapVolumes(out, map);
    const entries = [];
    for (const volume of volumes) {
      await writeRadar(
        join(overheads, `${map}_${volume.name}_radar_tga.png`),
        join(radarsDir, `${map}_${volume.name}.png`),
      );

      const square = imageBounds(volume);
      const box = boxes.get(volume.name.toLowerCase());
      // A volume that pokes out of its own radar square means the names were
      // paired up wrong -- the room would draw off the edge of its image.
      if (
        box &&
        (box.minX < square.minX - 1 ||
          box.maxX > square.maxX + 1 ||
          box.minY < square.minY - 1 ||
          box.maxY > square.maxY + 1)
      ) {
        throw new Error(`${volume.name}: cs_minimap_volume runs outside its radar image`);
      }

      entries.push({
        name: volume.name,
        ...toCalibration(volume),
        bounds: box ?? square,
      });
    }

    const posters = join(out, "panorama", "images", "map_icons");
    const screenshot = join(posters, "screenshots", "1080p", `${map}_png.png`);
    const poster = existsSync(screenshot);
    if (poster) {
      await sharp(screenshot)
        .resize(1920, 1080, { fit: "cover" })
        .webp({ quality: 80 })
        .toFile(join(postersDir, `${map}.webp`));
    }
    const iconSvg = join(posters, `map_icon_${map}.svg`);
    const icon = existsSync(iconSvg);
    if (icon) {
      copyFileSync(iconSvg, join(iconsDir, `${map}.svg`));
    }

    return {
      entry: { ...toCalibration(global), volumes: entries },
      fromBrushes: entries.filter((e) => boxes.has(e.name.toLowerCase())).length,
      poster,
      icon,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * The shape the file is kept in by hand: a leaf object stays on one line while
 * it fits, so a re-run touches only the entries it wrote.
 */
function formatJson(value, indent = "", prefix = 0) {
  if (Array.isArray(value)) {
    if (!value.length) {
      return "[]";
    }
    const inner = `${indent}  `;
    return `[\n${value.map((v) => inner + formatJson(v, inner)).join(",\n")}\n${indent}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) {
      return "{}";
    }
    if (entries.every(([, v]) => v === null || typeof v !== "object")) {
      const line = `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`;
      if (indent.length + prefix + line.length <= 80) {
        return line;
      }
    }
    const inner = `${indent}  `;
    return `{\n${entries
      .map(([k, v]) => {
        const key = `${JSON.stringify(k)}: `;
        return `${inner}${key}${formatJson(v, inner, key.length)}`;
      })
      .join(",\n")}\n${indent}}`;
  }
  return JSON.stringify(value);
}

function writeMetadata(updates) {
  const current = JSON.parse(readFileSync(metadataPath, "utf8"));
  for (const [map, entry] of Object.entries(updates)) {
    const { volumes, ...calibration } = entry;
    const next = { ...current[map], ...calibration };
    delete next.volumes;
    if (volumes.length) {
      next.volumes = volumes;
    }
    current[map] = next;
  }
  const { _comment, ...maps } = current;
  const sorted = Object.fromEntries(
    Object.keys(maps)
      .sort()
      .map((key) => [key, maps[key]]),
  );
  writeFileSync(
    metadataPath,
    `${formatJson(_comment === undefined ? sorted : { _comment, ...sorted })}\n`,
  );
}

async function main() {
  if (!only.length) {
    console.error("usage: node scripts/extract-map-radars.mjs <map> [<map>…] [--cs2 <path>]");
    process.exit(1);
  }
  if (!existsSync(CS2)) {
    console.error(`✗ nothing at ${CS2}\n  set CS2_DIR or pass --cs2 <install | pak01_dir.vpk | loose dir>`);
    process.exit(1);
  }

  const source = resolveSource(CS2);
  mkdirSync(postersDir, { recursive: true });
  mkdirSync(iconsDir, { recursive: true });

  const existing = JSON.parse(readFileSync(metadataPath, "utf8"));
  const updates = {};
  for (const map of only) {
    // A split-level entry is boltobserv's: its split offsets are tuned to
    // boltobserv's stacked image, and Valve ships the lower level separately.
    if (existing[map]?.splits) {
      console.warn(`${map.padEnd(16)} SKIPPED boltobserv split-level radar, not Valve's`);
      continue;
    }
    try {
      const result = await extractMap(source, map);
      updates[map] = result.entry;
      const volumes = result.entry.volumes.length;
      console.log(
        `${map.padEnd(16)} radar${volumes ? ` + ${volumes} volume(s), ${result.fromBrushes} bounded by cs_minimap_volume` : ""}` +
          `${result.poster ? ", poster" : ""}${result.icon ? ", icon" : ""}`,
      );
    } catch (error) {
      console.warn(`${map.padEnd(16)} FAILED ${error.message}`);
    }
  }

  if (Object.keys(updates).length) {
    writeMetadata(updates);
    console.log(`\n${Object.keys(updates).length}/${only.length} map(s) → ${radarsDir}`);
  }
}

main();
