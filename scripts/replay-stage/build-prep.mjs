#!/usr/bin/env node
// Precomputes the replay stage's map prep (utilities/replayStage/mapPrep.ts)
// so the browser can skip it: `<map>.prep.v<PREP_VERSION>.bin.gz`, a packed
// PrepCore (mapPrepPack.ts) published next to the map's view mesh and
// callouts by build-map-assets.mjs.
//
// The file only fits the exact view mesh and callouts it was made from and
// the PREP_VERSION it was made with: the browser checks both and preps for
// itself when either differs, so a stale file costs a download, never a wrong
// map. The version is in the file name too, so a client can skip a file of
// another version without fetching it.
//
// THE PREP CODE IS THE BROWSER'S, bundled with esbuild: from a prebuilt
// bundle when PREP_BUNDLE names one (the map-assets image makes it at build
// time with --bundle, so the job carries no esbuild), else on the fly from
// this checkout's utilities/, which needs esbuild from its node_modules.
// Either way the output matches what the browser would compute byte for byte.
//
// build-map-assets.mjs tracks prep by PREP_VERSION (`source.prep` in each
// manifest entry), not by this file's source: it is left out of the pipeline
// hash so editing it never rebuilds every map's meshes.
//
//   node scripts/replay-stage/build-prep.mjs --map de_mirage \
//     --view <map>.view.bin(.gz) [--callouts <map>.callouts.json] [--out <dir>]
//   node scripts/replay-stage/build-prep.mjs --bundle <out.mjs>   # for the image
//
// PREP_WEB_ROOT points the on-the-fly bundle at another web checkout.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultWebRoot = path.resolve(here, "../..");

const ENTRY_EXPORTS = (webRoot) =>
  [
    `export { parseViewMesh } from ${JSON.stringify(path.join(webRoot, "utilities/mapAssets.ts"))};`,
    `export { analyseMap } from ${JSON.stringify(path.join(webRoot, "utilities/replayStage/mapPrep.ts"))};`,
    `export { packPrep, prepFingerprint, PREP_VERSION } from ${JSON.stringify(path.join(webRoot, "utilities/replayStage/mapPrepPack.ts"))};`,
  ].join("\n");

/** Bundles the browser's prep code into one ESM file at `outFile`. */
export async function bundlePrep(
  outFile,
  { webRoot = process.env.PREP_WEB_ROOT || defaultWebRoot } = {},
) {
  const { build } = await import("esbuild");
  const dir = mkdtempSync(path.join(tmpdir(), "replay-stage-prep-"));
  try {
    const entry = path.join(dir, "entry.ts");
    writeFileSync(entry, ENTRY_EXPORTS(webRoot));
    mkdirSync(path.dirname(outFile), { recursive: true });
    await build({
      entryPoints: [entry],
      outfile: outFile,
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node22",
      logLevel: "warning",
      alias: { "~": webRoot },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return outFile;
}

/**
 * The prep module: `{ parseViewMesh, analyseMap, packPrep, prepFingerprint,
 * PREP_VERSION }`. From `bundle` (default PREP_BUNDLE) when given, else
 * bundled from the checkout.
 */
export async function loadPrep({ bundle = process.env.PREP_BUNDLE, webRoot } = {}) {
  if (bundle) {
    return checked(await import(pathToFileURL(path.resolve(bundle)).href), bundle);
  }
  const dir = mkdtempSync(path.join(tmpdir(), "replay-stage-prep-"));
  try {
    const out = await bundlePrep(path.join(dir, "prep.mjs"), { webRoot });
    return checked(await import(pathToFileURL(out).href), "the on-the-fly bundle");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function checked(mod, where) {
  for (const name of ["parseViewMesh", "analyseMap", "packPrep", "prepFingerprint"]) {
    if (typeof mod[name] !== "function") {
      throw new Error(`${where} has no ${name}()`);
    }
  }
  if (!Number.isInteger(mod.PREP_VERSION)) {
    throw new Error(`${where} has no PREP_VERSION`);
  }
  return mod;
}

const isGzip = (buf) => buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;

/** A body as fetched or read: gunzipped when it is gzip. */
export function plain(buf) {
  return isGzip(buf) ? gunzipSync(buf) : buf;
}

/**
 * The callout boxes the browser preps with: every box of every callout, in
 * file order (map.ts does the same). No callouts, or an empty body, is no
 * boxes -- exactly what the browser has for such a map.
 */
export function calloutAreas(body) {
  if (!body || !body.length) {
    return [];
  }
  const text = Buffer.isBuffer(body) ? plain(body).toString("utf8") : String(body);
  if (!text.trim()) {
    return [];
  }
  return (JSON.parse(text).callouts ?? []).flatMap((c) => c.boxes);
}

/**
 * One map's packed prep core: `view` is the .view.bin (gzipped or not),
 * `callouts` the .callouts.json body or null.
 */
export function makePrep(prep, { view, callouts = null }) {
  const raw = plain(view);
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const mesh = prep.parseViewMesh(buffer);
  const areas = calloutAreas(callouts);
  const started = performance.now();
  const core = prep.analyseMap(mesh.chunks, areas);
  const fingerprint = prep.prepFingerprint(mesh.chunks, areas);
  const packed = Buffer.from(prep.packPrep(core, fingerprint));
  return {
    packed,
    fingerprint,
    version: prep.PREP_VERSION,
    areas: areas.length,
    ms: Math.round(performance.now() - started),
  };
}

/** `<map>.prep.v<version>.bin`, the name a published prep file carries (plus .gz). */
export function prepFileName(map, version) {
  return `${map}.prep.v${version}.bin`;
}

async function main() {
  const args = process.argv.slice(2);
  const opt = {};
  for (let i = 0; i < args.length; i += 2) {
    opt[args[i].replace(/^--/, "")] = args[i + 1];
  }
  if (opt.bundle) {
    const out = await bundlePrep(path.resolve(opt.bundle));
    const mod = checked(await import(pathToFileURL(out).href), out);
    console.log(`${out}: prep v${mod.PREP_VERSION}`);
    return;
  }
  if (!opt.map || !opt.view) {
    console.error(
      "usage: build-prep.mjs --map <name> --view <file> [--callouts <file>] [--out <dir>]\n" +
        "       build-prep.mjs --bundle <out.mjs>",
    );
    process.exit(1);
  }
  const prep = await loadPrep();
  let callouts = null;
  try {
    callouts = opt.callouts ? readFileSync(opt.callouts) : null;
  } catch {
    console.warn(`no callouts at ${opt.callouts}: prepping without them`);
  }
  const made = makePrep(prep, { view: readFileSync(opt.view), callouts });
  const gz = gzipSync(made.packed, { level: 9 });
  const outDir = path.resolve(opt.out ?? "prep-out");
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${prepFileName(opt.map, made.version)}.gz`);
  writeFileSync(file, gz);
  console.log(
    `${file}  v${made.version}  ${(made.packed.length / 1e6).toFixed(1)} MB packed, ` +
      `${(gz.length / 1e6).toFixed(1)} MB gzipped, prep ${made.ms} ms, ` +
      `fingerprint ${made.fingerprint}`,
  );
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
