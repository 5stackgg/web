#!/usr/bin/env node
// Precomputes the replay stage's map prep (utilities/replayStage/mapPrep.ts)
// so the browser can skip it: `<map>.prep.bin.gz`, a packed PrepCore
// (mapPrepPack.ts) to publish next to the map's .view.bin.gz and callouts.
//
//   node scripts/replay-stage/build-prep.mjs --map de_mirage \
//     [--view <map>.view.bin(.gz)] [--callouts <map>.callouts.json] [--out <dir>]
//
// Inputs default to the harness's asset cache (shot.mjs fills it); output to
// ./prep-out. The file only fits the exact mesh and callouts it was made
// from, and the PREP_VERSION it was made with: the browser checks both and
// preps for itself when either differs, so a stale file costs a download,
// never a wrong map. The prep code is bundled with esbuild on the fly, so
// this runs from the web checkout (or an image that carries it and esbuild).
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../..");
const cacheDir = path.join(webRoot, "node_modules/.cache/replay-stage-assets");

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i += 2)
  opt[args[i].replace(/^--/, "")] = args[i + 1];
if (!opt.map) {
  console.error(
    "usage: build-prep.mjs --map <name> [--view <file>] [--callouts <file>] [--out <dir>]",
  );
  process.exit(1);
}
const viewFile = opt.view ?? path.join(cacheDir, `${opt.map}.view.bin.gz`);
const calloutsFile =
  opt.callouts ?? path.join(cacheDir, `${opt.map}.callouts.json`);
const outDir = path.resolve(opt.out ?? "prep-out");

async function loadPrep() {
  const { build } = await import("esbuild");
  const dir = mkdtempSync(path.join(tmpdir(), "replay-stage-prep-"));
  const entry = path.join(dir, "entry.ts");
  writeFileSync(
    entry,
    [
      `export { parseViewMesh } from ${JSON.stringify(path.join(webRoot, "utilities/mapAssets.ts"))};`,
      `export { analyseMap } from ${JSON.stringify(path.join(webRoot, "utilities/replayStage/mapPrep.ts"))};`,
      `export { packPrep, prepFingerprint, PREP_VERSION } from ${JSON.stringify(path.join(webRoot, "utilities/replayStage/mapPrepPack.ts"))};`,
    ].join("\n"),
  );
  const out = path.join(dir, "prep.mjs");
  await build({
    entryPoints: [entry],
    outfile: out,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "warning",
    alias: { "~": webRoot },
  });
  const mod = await import(pathToFileURL(out).href);
  rmSync(dir, { recursive: true, force: true });
  return mod;
}

const prep = await loadPrep();
const raw = readFileSync(viewFile);
const view = viewFile.endsWith(".gz") ? gunzipSync(raw) : raw;
const mesh = prep.parseViewMesh(
  view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength),
);
let areas = [];
try {
  areas = JSON.parse(readFileSync(calloutsFile, "utf8")).callouts.flatMap(
    (c) => c.boxes,
  );
} catch {
  console.warn(`no callouts at ${calloutsFile}: prepping without them`);
}

const started = performance.now();
const core = prep.analyseMap(mesh.chunks, areas);
const fingerprint = prep.prepFingerprint(mesh.chunks, areas);
const packed = Buffer.from(prep.packPrep(core, fingerprint));
const gz = gzipSync(packed, { level: 9 });
mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${opt.map}.prep.bin.gz`);
writeFileSync(file, gz);
console.log(
  `${file}  v${prep.PREP_VERSION}  ${(packed.length / 1e6).toFixed(1)} MB packed, ` +
    `${(gz.length / 1e6).toFixed(1)} MB gzipped, prep ${(performance.now() - started).toFixed(0)} ms, ` +
    `fingerprint ${fingerprint}`,
);
