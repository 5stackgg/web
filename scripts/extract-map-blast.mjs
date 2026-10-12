// Valve's own C4 damage, baked into each compiled map since CS2's 2026 bomb
// rework, as `<map>.blast.v2.bin`: per bomb site, how far the blast travels to
// every point round it, on a grid the replay stage samples as a 3D texture.
//
// WHERE IT LIVES. `maps/<map>/baked_bomb_damage.vdata_c` in the map's VPK: a
// generic-data resource (`generic_data_type = "CS2_BOMB_DAMAGE_DATA"`) that
// Source2Viewer-CLI decompiles to KV3 text. ValveResourceFormat's BombDamage
// type is the reference for the layout (header.version 1 or 2):
//
//   data.bombsites      blob, 7 f32 per site: bounds min xyz, max xyz, power
//   data.positions      blob, 3 i16 per sample point, source units
//   data.damage_values  blob, 4 bytes per (site, point), site-major:
//                       u16 phase, u8 yaw, u8 pitch
//
// `phase` is the effective distance from the site the damage falls off with
// -- the path the blast takes, not the straight line -- and `power` is about
// the distance it still deals 100 at. The game's damage, as VRF replicates it:
//
//   phase == 0  ->  100 (0 if power <= 0)
//   else        ->  clamp(100 - 100 * (phase - power) / min(phase, 1800), 0, 255)
//
// i.e. 100 * power / phase up to 1800, then a straight fall to nothing at
// 1800 + power. Yaw and pitch (the blast's direction at the point) are not
// carried over.
//
// The data names no site letters: the game uses the first site whose bounds,
// grown by 32 units, hold the bomb. Letters come from the func_bomb_target
// volumes that touch each site's bounds (`bomb_site_designation` 0 = A,
// 1 = B), else from the BombsiteA/B callouts, else from the order.
//
// THE FILE (version 2 of the replay stage's "5SBL"; little-endian):
//
//   "5SBL" u16 version = 2, u16 site count, u32 collision triangles
//   per site, a 72-byte header:
//     0  u8      letter 'A' | 'B'
//     1  u8      model: 0 = path length from the collision hull (the
//                browser's own flood), 1 = Valve's baked phase
//     2  u16     unit: source units per step of a value
//     4  f32[3]  at: where the field is measured from (Valve: the middle
//                of the site's bounds, at their floor)
//     16 f32[4]  ox oy oz vs: the grid's minimum corner and voxel edge
//     32 u16[3]  dx dy dz
//     38 u16     reserved, 0
//     40 u32     value count, dx * dy * dz
//     44 f32     power (model 1), else 0
//     48 f32[6]  the site's bounds min xyz, max xyz as baked (model 1)
//     72 u8[]    values, x fastest, then y, then z, padded to 4 bytes:
//                255 = not reached / no sample near; 0 = phase exactly 0;
//                else value * unit = the path length (phase), rounded
//
// Version 1 (the browser's own fields, 48-byte site headers, unit fixed at 8)
// is unchanged, so a client that only knows 1 rejects this file and measures
// for itself. The version is also in the file name, so a client can skip a
// file it would reject without downloading it.
//
// Usage:
//   node scripts/extract-map-blast.mjs de_mirage --cs2 <install> [--out <dir>]
//   node scripts/extract-map-blast.mjs --vpk <file.vpk> [--map <name>] [--out <dir>]
//   node scripts/extract-map-blast.mjs --kv3 <baked_bomb_damage.vdata> --map de_mirage
//     [--triangles <n>] [--out <dir>]      # from a file decompiled by hand
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { blobAs, parseKv3 } from "./lib-kv3.mjs";
import { decompile, describeOutput, resolveCli } from "./lib-s2v.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const BOMB_DAMAGE_TYPE = "CS2_BOMB_DAMAGE_DATA";
export const BLAST_FILE_MAGIC = "5SBL";
export const BLAST_FILE_VERSION = 2;
export const MODEL_VALVE = 1;
/** Above this the game's falloff turns linear (VRF: "MaxPhase"). */
export const PHASE_CAP = 1800;
/** The game grows each site's baked bounds by this on every axis. */
export const SITE_GROW = 32;
export const NEVER = 255;
const SITE_HEADER = 72;
const MIN_UNIT = 8;

/** What the game deals at `phase` from a site of `power` (VRF's CalculateDamage). */
export function valveDamage(phase, power) {
  if (phase === 0) {
    return phase >= power ? 0 : 100;
  }
  const damage = 100 - (100 * (phase - power)) / Math.min(phase, PHASE_CAP);
  return Math.min(255, Math.max(0, damage));
}

/**
 * The baked data out of decompiled KV3 text:
 * `{ version, sites: [{ min, max, power }], positions: Int16Array (xyz per
 * point), phases: Uint16Array (site-major), yaw, pitch: Uint8Array }`.
 */
export function parseBombDamage(text) {
  const kv = parseKv3(text);
  if (kv?.generic_data_type !== BOMB_DAMAGE_TYPE) {
    throw new Error(
      `not baked bomb damage (generic_data_type ${JSON.stringify(kv?.generic_data_type)})`,
    );
  }
  const version = kv.header?.version;
  if (version !== 1 && version !== 2) {
    throw new Error(`unknown baked bomb damage version ${version}`);
  }
  const data = kv.data;
  if (!data?.bombsites || !data.positions || !data.damage_values) {
    throw new Error("baked bomb damage without bombsites, positions and damage_values");
  }
  const floats = blobAs(Float32Array, data.bombsites);
  const sites = [];
  for (let s = 0; s + 7 <= floats.length; s += 7) {
    sites.push({
      min: [floats[s], floats[s + 1], floats[s + 2]],
      max: [floats[s + 3], floats[s + 4], floats[s + 5]],
      power: floats[s + 6],
    });
  }
  const shorts = blobAs(Int16Array, data.positions);
  const positions = shorts.subarray(0, shorts.length - (shorts.length % 3));
  const packed = data.damage_values;
  const count = Math.floor(packed.length / 4);
  const phases = new Uint16Array(count);
  const yaw = new Uint8Array(count);
  const pitch = new Uint8Array(count);
  for (let v = 0; v < count; v++) {
    phases[v] = packed[v * 4] | (packed[v * 4 + 1] << 8);
    yaw[v] = packed[v * 4 + 2];
    pitch[v] = packed[v * 4 + 3];
  }
  if (count !== sites.length * (positions.length / 3)) {
    throw new Error(
      `${count} damage values for ${sites.length} site(s) x ${positions.length / 3} point(s)`,
    );
  }
  return { version, sites, positions, phases, yaw, pitch };
}

const overlaps = (a, b) =>
  a.min.every((v, k) => v <= b.max[k]) && b.min.every((v, k) => v <= a.max[k]);

const grown = (box, by) => ({
  min: box.min.map((v) => v - by),
  max: box.max.map((v) => v + by),
});

/**
 * A letter per site: from the func_bomb_target volumes touching it
 * (`targets`: `{ designation, box }`), else the BombsiteA/B callouts, else
 * the order. `how` says which.
 */
export function siteLetters(sites, { targets = [], callouts = [] } = {}) {
  const fromTargets = sites.map((site) => {
    const area = grown(site, SITE_GROW);
    const found = new Set(
      targets
        .filter((t) => t.box && overlaps(t.box, area))
        .map((t) => ({ 0: "A", 1: "B" })[String(t.designation)] ?? "?"),
    );
    return found.size === 1 ? [...found][0] : null;
  });
  const named = fromTargets.every((l) => l === "A" || l === "B");
  if (named && new Set(fromTargets).size === sites.length) {
    return { letters: fromTargets, how: "entities" };
  }

  const boxes = (letter) =>
    callouts.find((c) => c.name === `Bombsite${letter}`)?.boxes ?? [];
  const fromCallouts = sites.map((site) => {
    const area = grown(site, SITE_GROW);
    const hits = ["A", "B"].filter((l) => boxes(l).some((b) => overlaps(b, area)));
    return hits.length === 1 ? hits[0] : null;
  });
  if (fromCallouts.every(Boolean) && new Set(fromCallouts).size === sites.length) {
    return { letters: fromCallouts, how: "callouts" };
  }

  return { letters: sites.map((_, i) => (i === 0 ? "A" : "B")), how: "order" };
}

const gcd = (a, b) => {
  while (b) [a, b] = [b, a % b];
  return a;
};

/**
 * The spacing of the sample lattice in x and y, when the points sit on one
 * between 16 and 128 units; else 32.
 */
export function latticeStep(positions) {
  const count = positions.length / 3;
  if (count < 2) {
    return 32;
  }
  const stride = Math.max(1, Math.floor(count / 20000));
  let g = 0;
  for (let p = stride; p < count; p += stride) {
    g = gcd(g, Math.abs(positions[p * 3] - positions[0]));
    g = gcd(g, Math.abs(positions[p * 3 + 1] - positions[1]));
  }
  return g >= 16 && g <= 128 ? g : 32;
}

/**
 * One site's phases resampled onto a grid round every point it hurts: each
 * voxel holding points takes their smallest phase, then `halo` layers of
 * empty voxels round them take their smallest neighbour's, so a surface
 * just beside the sampled air still reads a value. Null when the site hurts
 * nowhere.
 */
export function bakeSite(data, index, { voxel = null, halo = 2, maxVoxels = 4_000_000 } = {}) {
  const site = data.sites[index];
  const count = data.positions.length / 3;
  const base = count * index;
  const hurts = [];
  let maxPhase = 0;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let p = 0; p < count; p++) {
    const phase = data.phases[base + p];
    if (valveDamage(phase, site.power) <= 0) {
      continue;
    }
    hurts.push(p);
    maxPhase = Math.max(maxPhase, phase);
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], data.positions[p * 3 + k]);
      hi[k] = Math.max(hi[k], data.positions[p * 3 + k]);
    }
  }
  if (!hurts.length) {
    return null;
  }

  let vs = voxel ?? latticeStep(data.positions);
  const dims = () =>
    lo.map((v, k) => Math.floor((hi[k] - v) / vs) + 1 + 2 * halo);
  const volume = () => dims().reduce((a, b) => a * b, 1);
  // Coarser until it fits, or until the halo alone is the whole grid.
  for (let size = volume(); size > maxVoxels; ) {
    const before = vs;
    vs = Math.ceil(vs * 1.5);
    const next = volume();
    if (next >= size) {
      vs = before;
      break;
    }
    size = next;
  }
  const [dx, dy, dz] = dims();
  // Lattice points land on voxel centres.
  const ox = lo[0] - vs / 2 - halo * vs;
  const oy = lo[1] - vs / 2 - halo * vs;
  const oz = lo[2] - vs / 2 - halo * vs;

  const EMPTY = 0xffff;
  let field = new Uint16Array(dx * dy * dz).fill(EMPTY);
  for (const p of hurts) {
    const i = Math.floor((data.positions[p * 3] - ox) / vs);
    const j = Math.floor((data.positions[p * 3 + 1] - oy) / vs);
    const k = Math.floor((data.positions[p * 3 + 2] - oz) / vs);
    const v = (k * dy + j) * dx + i;
    field[v] = Math.min(field[v], data.phases[base + p]);
  }

  const plane = dx * dy;
  for (let pass = 0; pass < halo; pass++) {
    const next = field.slice();
    for (let k = 0; k < dz; k++) {
      for (let j = 0; j < dy; j++) {
        for (let i = 0; i < dx; i++) {
          const v = (k * dy + j) * dx + i;
          if (field[v] !== EMPTY) {
            continue;
          }
          let best = EMPTY;
          if (i > 0) best = Math.min(best, field[v - 1]);
          if (i < dx - 1) best = Math.min(best, field[v + 1]);
          if (j > 0) best = Math.min(best, field[v - dx]);
          if (j < dy - 1) best = Math.min(best, field[v + dx]);
          if (k > 0) best = Math.min(best, field[v - plane]);
          if (k < dz - 1) best = Math.min(best, field[v + plane]);
          next[v] = best;
        }
      }
    }
    field = next;
  }

  const unit = Math.max(MIN_UNIT, Math.ceil(maxPhase / (NEVER - 1)));
  const values = new Uint8Array(field.length);
  let filled = 0;
  for (let v = 0; v < field.length; v++) {
    const phase = field[v];
    if (phase === EMPTY) {
      values[v] = NEVER;
      continue;
    }
    filled++;
    values[v] = phase === 0 ? 0 : Math.min(NEVER - 1, Math.max(1, Math.round(phase / unit)));
  }

  return {
    model: MODEL_VALVE,
    at: {
      x: (site.min[0] + site.max[0]) / 2,
      y: (site.min[1] + site.max[1]) / 2,
      z: site.min[2],
    },
    ox,
    oy,
    oz,
    vs,
    dx,
    dy,
    dz,
    unit,
    power: site.power,
    bounds: { min: site.min, max: site.max },
    values,
    stats: { points: hurts.length, filled, maxPhase },
  };
}

/** `[{ site: "A" | "B", field }]` -> the file's bytes. */
export function packBlastFile(sites, triangles) {
  let bytes = 12;
  for (const { field } of sites) {
    bytes += SITE_HEADER + ((field.values.length + 3) & ~3);
  }
  const out = Buffer.alloc(bytes);
  out.write(BLAST_FILE_MAGIC, 0, "latin1");
  out.writeUInt16LE(BLAST_FILE_VERSION, 4);
  out.writeUInt16LE(sites.length, 6);
  out.writeUInt32LE(triangles >>> 0, 8);
  let o = 12;
  for (const { site, field } of sites) {
    out[o] = site.charCodeAt(0);
    out[o + 1] = field.model ?? MODEL_VALVE;
    out.writeUInt16LE(field.unit, o + 2);
    out.writeFloatLE(field.at.x, o + 4);
    out.writeFloatLE(field.at.y, o + 8);
    out.writeFloatLE(field.at.z, o + 12);
    out.writeFloatLE(field.ox, o + 16);
    out.writeFloatLE(field.oy, o + 20);
    out.writeFloatLE(field.oz, o + 24);
    out.writeFloatLE(field.vs, o + 28);
    out.writeUInt16LE(field.dx, o + 32);
    out.writeUInt16LE(field.dy, o + 34);
    out.writeUInt16LE(field.dz, o + 36);
    out.writeUInt32LE(field.values.length, o + 40);
    out.writeFloatLE(field.power ?? 0, o + 44);
    const bounds = field.bounds ?? { min: [0, 0, 0], max: [0, 0, 0] };
    [...bounds.min, ...bounds.max].forEach((v, k) => out.writeFloatLE(v, o + 48 + k * 4));
    out.set(field.values, o + SITE_HEADER);
    o += SITE_HEADER + ((field.values.length + 3) & ~3);
  }
  return out;
}

/** The file back as `{ triangles, sites }`, or null for anything else. */
export function unpackBlastFile(buf) {
  if (buf.length < 12 || buf.toString("latin1", 0, 4) !== BLAST_FILE_MAGIC) {
    return null;
  }
  if (buf.readUInt16LE(4) !== BLAST_FILE_VERSION) {
    return null;
  }
  const count = buf.readUInt16LE(6);
  const sites = [];
  let o = 12;
  for (let s = 0; s < count; s++) {
    if (o + SITE_HEADER > buf.length) {
      return null;
    }
    const dx = buf.readUInt16LE(o + 32);
    const dy = buf.readUInt16LE(o + 34);
    const dz = buf.readUInt16LE(o + 36);
    const length = buf.readUInt32LE(o + 40);
    if (length !== dx * dy * dz || o + SITE_HEADER + length > buf.length) {
      return null;
    }
    const f = (k) => buf.readFloatLE(o + k);
    sites.push({
      site: String.fromCharCode(buf[o]),
      field: {
        model: buf[o + 1],
        unit: buf.readUInt16LE(o + 2),
        at: { x: f(4), y: f(8), z: f(12) },
        ox: f(16),
        oy: f(20),
        oz: f(24),
        vs: f(28),
        dx,
        dy,
        dz,
        power: f(44),
        bounds: { min: [f(48), f(52), f(56)], max: [f(60), f(64), f(68)] },
        values: new Uint8Array(buf.subarray(o + SITE_HEADER, o + SITE_HEADER + length)),
      },
    });
    o += SITE_HEADER + ((length + 3) & ~3);
  }
  return { triangles: buf.readUInt32LE(8), sites };
}

/** Parsed baked data -> `{ sites: [{ site, field }], how }`, sites in letter order. */
export function blastSites(data, { targets, callouts, voxel } = {}) {
  const { letters, how } = siteLetters(data.sites, { targets, callouts });
  const sites = [];
  data.sites.forEach((_, index) => {
    const field = bakeSite(data, index, { voxel });
    if (field) {
      sites.push({ site: letters[index], field });
    }
  });
  sites.sort((a, b) => a.site.localeCompare(b.site));
  return { sites, how };
}

function findDecompiled(dir) {
  if (!existsSync(dir)) {
    return null;
  }
  const hit = readdirSync(dir, { recursive: true })
    .map(String)
    .find((f) => basename(f).startsWith("baked_bomb_damage.") && !f.endsWith("_c"));
  return hit ? join(dir, hit) : null;
}

/**
 * One map's baked blast, out of its VPK. `inner` is the map's name inside
 * the VPK (a workshop VPK can be published under another). Returns
 * `{ sites, how, version }`, or `{ none: true, why }` for a map that carries
 * no baked damage -- anything compiled before the rework, most workshop maps.
 * `targets` and `callouts` name the sites (see siteLetters).
 */
export function extractBlast(map, { vpk, inner = map, cli, targets, callouts, voxel }) {
  const tmp = mkdtempSync(join(tmpdir(), `blast-${map}-`));
  try {
    const path = `maps/${inner}/baked_bomb_damage.vdata_c`;
    let run;
    try {
      run = decompile(cli, vpk, path, tmp);
    } catch (error) {
      return { none: true, why: error.message };
    }
    const file = findDecompiled(join(tmp, "maps", inner));
    if (!file) {
      return { none: true, why: `no ${path} (${describeOutput(run) || "nothing printed"})` };
    }
    const data = parseBombDamage(readFileSync(file, "utf8"));
    return { ...blastSites(data, { targets, callouts, voxel }), version: data.version };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export function describeBlast(result) {
  if (result.none) {
    return `none (${result.why})`;
  }
  return (
    result.sites
      .map(
        ({ site, field }) =>
          `${site} ${field.stats.points} pts ${field.dx}x${field.dy}x${field.dz}@${field.vs}u`,
      )
      .join(", ") + ` (letters from ${result.how})`
  );
}

function main() {
  const args = process.argv.slice(2);
  const value = (flag, fallback = null) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  const VALUE_FLAGS = new Set(["--cs2", "--vpk", "--map", "--kv3", "--out", "--triangles"]);
  const named = args.find((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(args[i - 1]));
  const out = value("--out", join(root, ".cache", "blast"));
  const triangles = Number(value("--triangles", "0"));
  mkdirSync(out, { recursive: true });

  let map;
  let result;
  if (value("--kv3")) {
    map = value("--map", named);
    if (!map) {
      console.error("--kv3 needs --map <name>");
      process.exit(1);
    }
    result = blastSites(parseBombDamage(readFileSync(value("--kv3"), "utf8")));
  } else {
    const vpkArg = value("--vpk");
    const cs2 =
      process.env.CS2_DIR ??
      value(
        "--cs2",
        join(
          process.env.HOME ?? "",
          "Library/Application Support/Steam/steamapps/common/Counter-Strike Global Offensive",
        ),
      );
    const inner = vpkArg ? basename(vpkArg).replace(/(_dir)?\.vpk$/, "") : named;
    map = value("--map", named ?? inner);
    const vpk = vpkArg ?? join(cs2, "game", "csgo", "maps", `${map}.vpk`);
    if (!map || !existsSync(vpk)) {
      console.error(`no VPK at ${vpk} -- pass a map name with --cs2 <install>, or --vpk <file>`);
      process.exit(1);
    }
    result = extractBlast(map, { vpk, inner, cli: resolveCli() });
  }

  console.log(`${map.padEnd(18)} ${describeBlast(result)}`);
  if (result.none || !result.sites.length) {
    return;
  }
  const file = join(out, `${map}.blast.v${BLAST_FILE_VERSION}.bin`);
  writeFileSync(file, packBlastFile(result.sites, triangles));
  console.log(`-> ${file}${triangles ? "" : " (triangles 0: pass --triangles to match a .tri)"}`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
