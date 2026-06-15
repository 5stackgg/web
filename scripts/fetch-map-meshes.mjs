#!/usr/bin/env node
// Build + publish lightweight CS2 map collision meshes (".tri") for the 3D-lite
// replay viewer.
//
// A .tri file is a raw, non-indexed float32 position buffer (9 floats =
// 3 vertices per triangle, no header) in CS2 source units — the SAME space as
// demo player positions, so the mesh and players align with no calibration.
// The viewer (components/match/Replay3DLite.vue) loads the .tri straight into a
// three.js BufferGeometry.
//
// Sources:
//   - awpy's published collision data (https://awpycs.com/<build>/tris.zip).
//     No CS2 install required. Equivalent to `pip install awpy && awpy get tris`.
//   - your own generated .tri files via --from <dir> (for maps awpy doesn't ship;
//     generate from VPKs per docs/3d-replay-map-meshes.md).
//
// Maps over MESH_MAX_MB (default 30) are auto-decimated to fit (grid-snap +
// dedup of triangles) rather than dropped, so active-duty maps like inferno /
// train / ancient still come through. Set MESH_NO_DECIMATE=1 to skip oversized
// meshes instead, or raise MESH_MAX_MB to keep them at full detail.
//
// The app loads meshes from a CDN (runtimeConfig.public.mapMeshCdn), NOT from
// this repo. --publish pushes the built meshes to the meshes repo + tags them so
// jsDelivr serves them. Without --publish, meshes are staged locally for
// inspection under .cache/meshes/.
//
// Usage:
//   node scripts/fetch-map-meshes.mjs                      # build default pool → .cache/meshes
//   node scripts/fetch-map-meshes.mjs de_mirage de_nuke    # specific maps
//   node scripts/fetch-map-meshes.mjs --all                # every map in the awpy pack
//   node scripts/fetch-map-meshes.mjs --from ~/gen de_cache # include a self-generated mesh
//   node scripts/fetch-map-meshes.mjs --all --publish      # build + push + tag to the meshes repo
//   node scripts/fetch-map-meshes.mjs --from ~/gen de_cache --publish --tag 17595823-1
//
//   MESH_MAX_MB=60          allow bigger meshes (less decimation)
//   MESH_NO_DECIMATE=1      skip oversized meshes instead of shrinking
//   AWPY_BUILD_ID=<id>      awpy data build (default 17595823); also the default tag
//   MESH_REPO=<owner/repo>  meshes repo (default 5stackgg/replay-map-meshes)

import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  existsSync,
  statSync,
  rmSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const BUILD_ID = process.env.AWPY_BUILD_ID || "17595823";
const ZIP_URL = `https://awpycs.com/${BUILD_ID}/tris.zip`;
const MAX_MB = Number(process.env.MESH_MAX_MB || "30"); // target size; bigger meshes get decimated to fit
const NO_DECIMATE = process.env.MESH_NO_DECIMATE === "1";
const REPO = process.env.MESH_REPO || "5stackgg/replay-map-meshes";

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valOf = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};
const all = has("--all");
const publish = has("--publish");
const fromDir = valOf("--from") ? resolve(valOf("--from")) : null;
const tag = valOf("--tag") || BUILD_ID;
const flagVals = new Set([valOf("--from"), valOf("--tag")].filter(Boolean));
const maps = argv.filter((a) => !a.startsWith("--") && !flagVals.has(a));

// Valve maps tracked in api/hasura/enums/maps.sql (plus cs_office); workshop maps
// are ignored by default. Use --all for the whole awpy pack, or name maps.
const DEFAULT_POOL = [
  "de_ancient",
  "de_anubis",
  "de_dust2",
  "de_inferno",
  "de_mirage",
  "de_nuke",
  "de_overpass",
  "de_train",
  "de_vertigo",
  "cs_office",
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stageDir = join(root, ".cache", "meshes");
const tmpZip = join("/tmp", `awpy-tris-${BUILD_ID}.zip`);

// ── decimation ────────────────────────────────────────────────────────────────
// Shrink a non-indexed float32 triangle buffer by snapping vertices to a grid
// and dropping degenerate + duplicate triangles. Source collision soups carry a
// lot of fine, coplanar tessellation that collapses away under quantization,
// which cuts the file while preserving the rough wall/height shapes the 3D
// viewer needs. `grid` is in source units (player ~32 wide, 72 tall).
function decimate(buf, grid) {
  const f = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const tris = f.length / 9;
  const out = [];
  const seen = new Set();
  const snap = (v) => Math.round(v / grid) * grid;
  for (let i = 0; i < tris; i++) {
    const o = i * 9;
    const ax = snap(f[o]), ay = snap(f[o + 1]), az = snap(f[o + 2]);
    const bx = snap(f[o + 3]), by = snap(f[o + 4]), bz = snap(f[o + 5]);
    const cx = snap(f[o + 6]), cy = snap(f[o + 7]), cz = snap(f[o + 8]);
    // drop zero-area triangles (snapped verts collapsed onto each other)
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-3) continue;
    // dedup identical triangles regardless of winding/vertex order
    const v = [
      [ax, ay, az],
      [bx, by, bz],
      [cx, cy, cz],
    ].sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
    const key = v[0].join() + "|" + v[1].join() + "|" + v[2].join();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  }
  return Buffer.from(new Float32Array(out).buffer);
}

// Bring a buffer under MAX_MB (best-effort, progressively coarser grids).
function fitToCap(buf, name) {
  const before = buf.length / 1e6;
  if (before <= MAX_MB || NO_DECIMATE) {
    return { buf, note: `${before.toFixed(1)} MB`, drop: before > MAX_MB };
  }
  let best = buf;
  for (const grid of [8, 16, 24, 32, 48, 64, 96, 128]) {
    best = decimate(buf, grid);
    if (best.length / 1e6 <= MAX_MB) break;
  }
  const after = best.length / 1e6;
  const tag = after > MAX_MB ? "⚠ still over cap" : "decimated";
  return { buf: best, note: `${tag} ${before.toFixed(1)}→${after.toFixed(1)} MB` };
}

// ── source: awpy zip ──────────────────────────────────────────────────────────
let zipMembers = [];
function ensureZip() {
  if (zipMembers.length) return;
  if (!existsSync(tmpZip)) {
    console.log(`↓ downloading ${ZIP_URL} (~100 MB, one-time)…`);
    execFileSync("curl", ["-sL", "-o", tmpZip, ZIP_URL], { stdio: "inherit" });
  } else {
    console.log(`• using cached ${tmpZip}`);
  }
  const listing = execFileSync("unzip", ["-l", tmpZip]).toString();
  zipMembers = [...listing.matchAll(/(\S+\.tri)\s*$/gm)].map((m) => m[1]);
}

// Resolve a map's raw .tri buffer: prefer --from dir, else the awpy zip.
function rawBufFor(name) {
  if (fromDir) {
    const p = join(fromDir, `${name}.tri`);
    if (existsSync(p)) return readFileSync(p);
  }
  ensureZip();
  if (!zipMembers.includes(`${name}.tri`)) return null;
  const tmp = join("/tmp", `awpy-extract-${BUILD_ID}`);
  execFileSync("unzip", ["-o", "-q", tmpZip, `${name}.tri`, "-d", tmp]);
  return readFileSync(join(tmp, `${name}.tri`));
}

// ── build the requested set ───────────────────────────────────────────────────
let wanted;
if (all) {
  ensureZip();
  wanted = zipMembers.map((m) => m.replace(/\.tri$/, ""));
} else if (maps.length) {
  wanted = maps;
} else {
  wanted = DEFAULT_POOL;
}

mkdirSync(stageDir, { recursive: true });
const built = [];
for (const name of wanted) {
  const raw = rawBufFor(name);
  if (!raw) {
    console.warn(`  ⚠ ${name}.tri not in awpy pack or --from dir — skipping`);
    continue;
  }
  const { buf, note, drop } = fitToCap(raw, name);
  if (drop) {
    console.warn(`  ✗ ${name}.tri ${note} > ${MAX_MB} MB cap — skipped (MESH_NO_DECIMATE)`);
    continue;
  }
  writeFileSync(join(stageDir, `${name}.tri`), buf);
  console.log(`  ✓ ${name}.tri (${note})`);
  built.push(name);
}

console.log(`\nbuilt ${built.length} mesh(es) → ${stageDir}`);

if (!publish) {
  console.log("(run again with --publish to push + tag to the meshes repo)");
  process.exit(0);
}

// ── publish: clone meshes repo, copy built tris, commit, tag, push ────────────
if (!built.length) {
  console.error("nothing built — aborting publish");
  process.exit(1);
}

const cloneDir = join("/tmp", `mesh-publish-${REPO.replace("/", "_")}`);
rmSync(cloneDir, { recursive: true, force: true });
console.log(`\n↓ cloning ${REPO}…`);
execFileSync("gh", ["repo", "clone", REPO, cloneDir], { stdio: "inherit" });

const exists = execFileSync("git", ["-C", cloneDir, "ls-remote", "--tags", "origin", tag])
  .toString()
  .trim();
if (exists) {
  console.error(
    `\n✗ tag "${tag}" already exists on ${REPO}. CDN URLs are immutable — ` +
      `pass a new --tag (e.g. ${BUILD_ID}-1) instead of reusing it.`,
  );
  process.exit(1);
}

for (const name of built) {
  execFileSync("cp", [join(stageDir, `${name}.tri`), join(cloneDir, `${name}.tri`)]);
}

const present = readdirSync(cloneDir)
  .filter((f) => f.endsWith(".tri"))
  .sort();
writeFileSync(
  join(cloneDir, "README.md"),
  `# 5Stack replay map meshes

Lightweight CS2 **collision** meshes for the 5Stack 3D replay viewer. Each
\`<map>.tri\` is a raw, header-less \`float32\` triangle soup (9 floats per
triangle) in CS2 source units. Built + decimated by
\`scripts/fetch-map-meshes.mjs\` in the web repo (awpy build \`${BUILD_ID}\`),
plus self-generated maps per \`docs/3d-replay-map-meshes.md\`.

Served immutably + Brotli'd via jsDelivr:

\`\`\`
https://cdn.jsdelivr.net/gh/${REPO}@<tag>/<map>.tri
\`\`\`

## Maps (tag \`${tag}\`)

${present.map((f) => `- ${f}`).join("\n")}
`,
);

const git = (...a) => execFileSync("git", ["-C", cloneDir, ...a], { stdio: "inherit" });
git("add", "-A");
git(
  "-c",
  "user.name=5stack-bot",
  "-c",
  "user.email=bot@5stack.gg",
  "commit",
  "-m",
  `Publish meshes (build ${BUILD_ID}, tag ${tag}): ${built.join(", ")}`,
);
git("tag", tag);
git("push", "origin", "HEAD");
git("push", "origin", tag);

console.log(`\n✓ published ${built.length} mesh(es) to ${REPO} @ ${tag}`);
console.log(`  CDN: https://cdn.jsdelivr.net/gh/${REPO}@${tag}/<map>.tri`);
console.log(`  → bump the tag in nuxt.config.ts mapMeshCdn (or NUXT_PUBLIC_MAP_MESH_CDN)`);
