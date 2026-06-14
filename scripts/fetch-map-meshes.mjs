#!/usr/bin/env node
// Fetch lightweight CS2 map collision meshes (awpy ".tri" triangle data) and
// stage them under public/replay-assets/tris/ for the 3D-lite replay viewer.
//
// A .tri file is a raw, non-indexed float32 position buffer (9 floats =
// 3 vertices per triangle, no header) in CS2 source units — the SAME space as
// demo player positions, so the mesh and players align with no calibration.
// The viewer (components/match/Replay3DLite.vue) loads the .tri straight into a
// three.js BufferGeometry.
//
// Source: awpy's published collision data (https://awpycs.com/<build>/tris.zip).
// No CS2 install required. Equivalent to `pip install awpy && awpy get tris`.
//
// Usage:
//   node scripts/fetch-map-meshes.mjs                 # default competitive pool
//   node scripts/fetch-map-meshes.mjs de_mirage de_nuke
//   node scripts/fetch-map-meshes.mjs --all           # every map in the pack
//   MESH_MAX_MB=40 node scripts/fetch-map-meshes.mjs  # skip meshes over N MB
//
// Build id mirrors awpy.data.CURRENT_BUILD_ID — bump when awpy ships a newer
// data build for a CS2 patch.

import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, statSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BUILD_ID = process.env.AWPY_BUILD_ID || "17595823";
const ZIP_URL = `https://awpycs.com/${BUILD_ID}/tris.zip`;
const MAX_MB = Number(process.env.MESH_MAX_MB || "30"); // skip huge meshes (need decimation)

// Maps available in the awpy collision pack (https://github.com/pnxenopoulos/awpy).
// Full set per build: de_ancient de_anubis de_basalt de_dust2 de_edin de_inferno
// de_mirage de_nuke de_overpass de_palais de_train de_vertigo de_whistle
// cs_italy cs_office ar_baggage ar_pool_day ar_shoots
// Pull the current competitive + community-pool maps by default; use --all for
// the entire pack.
const DEFAULT_POOL = [
  // active duty / standard competitive
  "de_ancient",
  "de_anubis",
  "de_dust2",
  "de_inferno",
  "de_mirage",
  "de_nuke",
  "de_overpass",
  "de_train",
  "de_vertigo",
  // newer / community + operation maps
  "de_basalt",
  "de_edin",
  "de_palais",
  "de_whistle",
  "cs_office",
  "cs_italy",
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "replay-assets", "tris");
const tmpZip = join("/tmp", `awpy-tris-${BUILD_ID}.zip`);

const args = process.argv.slice(2);
const all = args.includes("--all");
const maps = all ? [] : args.filter((a) => !a.startsWith("--"));
const pool = maps.length ? maps : DEFAULT_POOL;

mkdirSync(outDir, { recursive: true });

if (!existsSync(tmpZip)) {
  console.log(`↓ downloading ${ZIP_URL} (~100 MB, one-time)…`);
  execFileSync("curl", ["-sL", "-o", tmpZip, ZIP_URL], { stdio: "inherit" });
} else {
  console.log(`• using cached ${tmpZip}`);
}

// list members so --all / size checks work without a unzip lib
const listing = execFileSync("unzip", ["-l", tmpZip]).toString();
const members = [...listing.matchAll(/(\S+\.tri)\s*$/gm)].map((m) => m[1]);
const wanted = all ? members.map((m) => m.replace(/\.tri$/, "")) : pool;

let staged = 0;
for (const name of wanted) {
  const member = `${name}.tri`;
  if (!members.includes(member)) {
    console.warn(`  ⚠ ${member} not in pack — skipping`);
    continue;
  }
  execFileSync("unzip", ["-o", "-q", tmpZip, member, "-d", outDir]);
  const dest = join(outDir, member);
  const mb = statSync(dest).size / 1e6;
  if (mb > MAX_MB) {
    rmSync(dest);
    console.warn(
      `  ✗ ${member} is ${mb.toFixed(1)} MB > ${MAX_MB} MB cap — removed (needs decimation; raise MESH_MAX_MB to keep)`,
    );
    continue;
  }
  console.log(`  ✓ ${member} (${mb.toFixed(1)} MB)`);
  staged++;
}

console.log(`\nstaged ${staged} mesh(es) → public/replay-assets/tris/`);
console.log("(these are gitignored like the other replay-assets)");
