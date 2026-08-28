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
//   - your own files via --from <dir>: ready .tri OR Source 2 Viewer .glb exports
//     (auto-converted to source-unit .tri, textures discarded). For maps awpy
//     doesn't ship — see docs/3d-replay-map-meshes.md.
//
// Maps over MESH_MAX_MB (default 18, under jsDelivr's ~20 MiB per-file limit) are
// auto-decimated to fit (grid-snap + dedup of triangles) rather than dropped, so
// active-duty maps like inferno / train / ancient still come through. Set
// MESH_NO_DECIMATE=1 to skip oversized meshes instead. Do NOT raise MESH_MAX_MB
// past ~19 for published meshes: jsDelivr 403s bigger files (not 404), so the 3D
// viewer silently falls back to the flat radar.
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
//   node scripts/fetch-map-meshes.mjs --from ~/exports de_cache  # one .glb/.tri from a dir
//   node scripts/fetch-map-meshes.mjs --from ~/exports --from-all # EVERY .glb/.tri in a dir
//   node scripts/fetch-map-meshes.mjs --all --publish      # build + push + tag to the meshes repo
//   node scripts/fetch-map-meshes.mjs --from ~/exports --from-all --publish --tag 17595823-2
//
//   MESH_MAX_MB=16          smaller meshes (more decimation); keep < ~19 for jsDelivr
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
import { glbToTri, mapNameFromGlb } from "./glb-to-tri.mjs";
import { fitToCap } from "./lib-mesh.mjs";

const BUILD_ID = process.env.AWPY_BUILD_ID || "17595823";
const ZIP_URL = `https://awpycs.com/${BUILD_ID}/tris.zip`;
// Target on-disk size. MUST stay under jsDelivr's ~20 MiB per-file serving limit:
// files over it 403 (NOT 404), so the 3D viewer silently falls back to the flat
// radar and MeshAvailability lists them as "missing". 18 leaves headroom.
const MAX_MB = Number(process.env.MESH_MAX_MB || "18"); // bigger meshes get decimated to fit
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
const fromAll = has("--from-all"); // process every .glb/.tri in --from dir
const publish = has("--publish");
// Callouts are a few KB per map and change on the same event a mesh does (Valve
// patched the map), so they ride the same repo and the same immutable tag
// rather than earning a second CDN pin to keep in sync.
const withCallouts = has("--with-callouts");
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
const calloutStageDir = join(root, ".cache", "callouts");
const tmpZip = join("/tmp", `awpy-tris-${BUILD_ID}.zip`);

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

// Find a map's source file in --from: a ready .tri, or any .glb whose name maps
// to it (e.g. <map>.glb, <map>_world_physics_physics.glb).
function fromFileFor(name) {
  if (!fromDir || !existsSync(fromDir)) return null;
  const tri = join(fromDir, `${name}.tri`);
  if (existsSync(tri)) return tri;
  // Among glbs mapping to this name, prefer the physics hull, then the largest
  // (the textured render stub is tiny; the collision export is big).
  const glbs = readdirSync(fromDir)
    .filter((f) => f.toLowerCase().endsWith(".glb") && mapNameFromGlb(f) === name)
    .map((f) => ({ f, p: join(fromDir, f), size: statSync(join(fromDir, f)).size }))
    .sort(
      (a, b) =>
        Number(/physics/i.test(b.f)) - Number(/physics/i.test(a.f)) || b.size - a.size,
    );
  return glbs.length ? glbs[0].p : null;
}

// Resolve a map's raw triangle buffer: prefer --from (.tri or .glb), else awpy.
function rawBufFor(name) {
  const src = fromFileFor(name);
  if (src) {
    if (src.toLowerCase().endsWith(".glb")) {
      const { buf, count, skipped, bbox } = glbToTri(src);
      const big = Math.max(...bbox.max.map(Math.abs)) >= 500;
      console.log(
        `    ${name}: glb → ${count.toLocaleString()} tris (dropped ${skipped.toLocaleString()} clip/sky)${big ? "" : " ⚠ bbox tiny (meters?)"}`,
      );
      return buf;
    }
    return readFileSync(src);
  }
  ensureZip();
  if (!zipMembers.includes(`${name}.tri`)) return null;
  const tmp = join("/tmp", `awpy-extract-${BUILD_ID}`);
  execFileSync("unzip", ["-o", "-q", tmpZip, `${name}.tri`, "-d", tmp]);
  return readFileSync(join(tmp, `${name}.tri`));
}

// ── build the requested set ───────────────────────────────────────────────────
let wanted;
if (fromAll) {
  if (!fromDir) {
    console.error("--from-all requires --from <dir>");
    process.exit(1);
  }
  // every .glb/.tri in the from dir, deduped to map names
  wanted = [
    ...new Set(
      readdirSync(fromDir)
        .filter((f) => /\.(glb|tri)$/i.test(f))
        .map((f) => (f.toLowerCase().endsWith(".glb") ? mapNameFromGlb(f) : f.replace(/\.tri$/i, ""))),
    ),
  ].sort();
} else if (all) {
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
  const { buf, note, drop } = fitToCap(raw, MAX_MB, NO_DECIMATE);
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
const callouts =
  withCallouts && existsSync(calloutStageDir)
    ? readdirSync(calloutStageDir).filter((f) => f.endsWith(".callouts.json")).sort()
    : [];

if (withCallouts && !callouts.length) {
  console.error(
    `nothing in ${calloutStageDir} — run scripts/extract-map-callouts.mjs first`,
  );
  process.exit(1);
}

if (!built.length && !callouts.length) {
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
for (const file of callouts) {
  execFileSync("cp", [join(calloutStageDir, file), join(cloneDir, file)]);
}

const present = readdirSync(cloneDir)
  .filter((f) => f.endsWith(".tri"))
  .sort();
const presentCallouts = readdirSync(cloneDir)
  .filter((f) => f.endsWith(".callouts.json"))
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

## Callouts

Each \`<map>.callouts.json\` lists the map's \`env_cs_place\` volumes — a name and
one or more axis-aligned boxes in the same source units as the meshes. Built by
\`scripts/extract-map-callouts.mjs\` in the web repo. The panel draws them on the
radar and names utility throws from them.

${presentCallouts.length ? presentCallouts.map((f) => `- ${f}`).join("\n") : "_none published yet_"}
`,
);

const git = (...a) => execFileSync("git", ["-C", cloneDir, ...a], { stdio: "inherit" });
git("add", "-A");
// Re-publishing identical content under a new tag leaves nothing staged; `commit`
// would exit non-zero and abort before the tag is created. Only commit if dirty,
// then tag the (existing or new) HEAD either way.
const dirty = execFileSync("git", ["-C", cloneDir, "status", "--porcelain"]).toString().trim();
if (dirty) {
  git(
    "-c", "user.name=5stack-bot",
    "-c", "user.email=bot@5stack.gg",
    "commit",
    "-m",
    `Publish meshes (build ${BUILD_ID}, tag ${tag}): ${[...built, ...callouts].join(", ")}`,
  );
} else {
  console.log("  • no file changes — tagging existing HEAD");
}
git("tag", tag);
git("push", "origin", "HEAD");
git("push", "origin", tag);

console.log(`\n✓ published ${built.length} mesh(es) to ${REPO} @ ${tag}`);
console.log(`  CDN: https://cdn.jsdelivr.net/gh/${REPO}@${tag}/<map>.tri`);
if (callouts.length) {
  console.log(`✓ published ${callouts.length} callout file(s)`);
  console.log(`  CDN: https://cdn.jsdelivr.net/gh/${REPO}@${tag}/<map>.callouts.json`);
}
console.log(`  → bump the tag in nuxt.config.ts mapMeshCdn (or NUXT_PUBLIC_MAP_MESH_CDN)`);
