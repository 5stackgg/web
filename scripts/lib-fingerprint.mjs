// What a map's published assets were built FROM, so a new CS2 build that did
// not touch a map does not rebuild it.
//
//   vpk_sha256  the map's own VPK -- geometry, nav and entity lump all live in
//               it, so an unchanged VPK means unchanged inputs
//   pipeline    everything that turns those inputs into files: the source of
//               the build script and every local module it imports, the
//               Source2Viewer-CLI version and the meshoptimizer version
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const LOCAL = String.raw`["'](\.{1,2}\/[^"']+)["']`;
const IMPORT = new RegExp(
  String.raw`(?:\bimport|\bexport)\s[^'";]*?\bfrom\s*${LOCAL}|\bimport\s*\(?\s*${LOCAL}`,
  "g",
);

export const PIPELINE_ENTRY = join(here, "build-map-assets.mjs");

/** Relative (`./`, `../`) import specifiers in a module's source. */
export function localImports(source) {
  return [...source.matchAll(IMPORT)].map((m) => m[1] ?? m[2]);
}

/** `entry` and every local module it imports, transitively; absolute, sorted. */
export function pipelineSources(entry = PIPELINE_ENTRY) {
  const seen = new Set();
  const visit = (path) => {
    if (seen.has(path)) {
      return;
    }
    if (!existsSync(path)) {
      throw new Error(`${path} is imported but does not exist`);
    }
    seen.add(path);
    for (const specifier of localImports(readFileSync(path, "utf8"))) {
      visit(resolve(dirname(path), specifier));
    }
  };
  visit(resolve(entry));
  return [...seen].sort();
}

export function sourceViewerVersion(cli) {
  const out = execFileSync(cli, ["--version"], { encoding: "utf8" });
  const version = /^\s*Version:\s*(\S+)/m.exec(out)?.[1];
  if (!version) {
    throw new Error(`no version in \`${cli} --version\`: ${out.slice(0, 200)}`);
  }
  return version;
}

export function meshoptimizerVersion() {
  let dir = dirname(createRequire(import.meta.url).resolve("meshoptimizer"));
  while (!existsSync(join(dir, "package.json"))) {
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("meshoptimizer has no package.json");
    }
    dir = parent;
  }
  return JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version;
}

/**
 * One hash over the pipeline. Files are keyed by their path relative to this
 * directory, so the same checkout hashes the same wherever it lives.
 */
export function pipelineHash({ files, sourceViewer, meshoptimizer }) {
  const hash = createHash("sha256");
  for (const file of [...files].sort()) {
    hash.update(`${relative(here, file)}\0`);
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  hash.update(`source-viewer\0${sourceViewer}\0meshoptimizer\0${meshoptimizer}`);
  return hash.digest("hex");
}

export function pipelineFingerprint(cli) {
  const files = pipelineSources();
  const sourceViewer = sourceViewerVersion(cli);
  const meshoptimizer = meshoptimizerVersion();
  return {
    sha256: pipelineHash({ files, sourceViewer, meshoptimizer }),
    source_viewer: sourceViewer,
    meshoptimizer,
    files: files.map((f) => relative(here, f)),
  };
}

export function sha256File(path) {
  return new Promise((done, failed) => {
    const hash = createHash("sha256");
    createReadStream(path, { highWaterMark: 4 * 1024 * 1024 })
      .on("data", (chunk) => hash.update(chunk))
      .on("error", failed)
      .on("end", () => done(hash.digest("hex")));
  });
}

export function sameSource(a, b) {
  return Boolean(
    a && b && a.vpk_sha256 === b.vpk_sha256 && a.pipeline === b.pipeline,
  );
}
