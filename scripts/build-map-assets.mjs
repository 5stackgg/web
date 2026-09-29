// Build every map's assets for one CS2 build and, with --publish, put them on
// B2 behind the demo-dl worker. This is what the map-assets job runs when the
// API sees a new CS2 build land; it is also the manual path.
//
// LAYOUT (keys relative to maps/, see docs/3d-replay-map-meshes.md and
// lib-manifest.mjs):
//
//   <build>/<map>.tri.gz              collision, for line of sight
//   <build>/<map>.grenadeclip.tri.gz  grenade clips only; absent when none
//   <build>/<map>.view.bin.gz         the 3D viewer's render mesh
//   <build>/<map>.callouts.json       stored gzipped with Content-Encoding
//   <build>/manifest.json             which key holds each asset of each map
//   <build>/manifest.r<N>.json        a retry of the maps revision N-1 failed
//   latest.json                       -> the newest manifest; the only mutable key
//
// UNCHANGED MAPS ARE NOT REBUILT. Every map entry records what it was built
// from, `source: { vpk_sha256, pipeline }` (lib-fingerprint.mjs): the map's
// VPK, and the build scripts + Source2Viewer + meshoptimizer versions. A map
// whose source matches the previous manifest's entry, and which that manifest
// does not list as failed, is carried over verbatim without a single export.
// --force / --force-maps a,b build regardless.
//
// DEDUPE. A built file whose sha256 (of its uncompressed bytes) matches the
// base manifest's entry is not uploaded again: the new manifest points at the
// older key. Installed maps this run did not look at carry over from the base
// untouched; maps no longer in the install are dropped.
//
// --only-maps a,b narrows "installed" to those maps (the API passes its maps
// table), so an install map 5stack does not know is never built, and one a
// base manifest carries is dropped along with any failure listed for it.
//
// FAILURES. Only a map's collision can fail it. A failed map keeps its
// previous entry and is listed in `failed`; a map whose callouts failed ships
// new collision and old callouts and is listed in `failed`; a map whose view
// mesh failed ships without `view` and is listed in `failed_view`.
//
// RE-RUNS. A build whose newest manifest lists no failures is done: the run
// only makes sure latest.json points at it (unless --force asks for maps to be
// rebuilt). One that lists failures is retried for those maps alone, into the
// next manifest.r<N>.json -- published manifests are never overwritten.
//
// IMMUTABILITY. Every new key is HEAD-checked first; one that already exists
// is only accepted when its x-amz-meta-sha256 matches (an interrupted run of
// the same revision), and anything B2 will not answer aborts the run.
// latest.json is written LAST, re-read right before, and only ever moves
// forwards (newer build, or newer revision of the same build).
//
// EXIT: 0 every map fully published; 2 published, but `failed` or
// `failed_view` is not empty; 1 fatal, nothing new published.
//
// Usage:
//   node scripts/build-map-assets.mjs --cs2 <install> [--build <id>] [--maps a,b]
//     [--only-maps a,b] [--force | --force-maps a,b] [--out <dir>] [--publish]
//     [--dry-run]
//
// --build defaults to the install's own build id (steamapps/appmanifest_730.acf)
// and must match it when both are known. --out (or MAP_ASSETS_OUT) holds every
// file the run writes besides the CLI's scratch, which goes to TMPDIR. Without
// --publish nothing leaves the machine; --dry-run with --publish runs every
// check but uploads nothing. S3_ACCESS_KEY / S3_SECRET (and optionally
// BUCKET_NAME / S3_ENDPOINT) are the B2 credentials.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { extractCallouts } from "./extract-map-callouts.mjs";
import { describe, eligibleMaps, extractMap } from "./extract-map-meshes.mjs";
import { bucketFromEnv } from "./lib-bucket.mjs";
import { pipelineFingerprint, sameSource, sha256File } from "./lib-fingerprint.mjs";
import {
  compareRevisions,
  latestPointer,
  listsFailure,
  manifestKey,
  mergeManifest,
  parseManifest,
  parsePointer,
  retryMaps,
  sameContent,
} from "./lib-manifest.mjs";
import { resolveCli } from "./lib-s2v.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_BASE =
  process.env.MAP_ASSETS_BASE || "https://demo-dl.5stack.gg/maps";

const EXIT_FAILED_MAPS = 2;

const ASSETS = [
  { name: "tri", raw: (m) => `${m}.tri`, file: (m) => `${m}.tri.gz` },
  {
    name: "grenadeclip",
    raw: (m) => `${m}.grenadeclip.tri`,
    file: (m) => `${m}.grenadeclip.tri.gz`,
  },
  { name: "view", raw: (m) => `${m}.view.bin`, file: (m) => `${m}.view.bin.gz` },
  { name: "callouts", raw: (m) => `${m}.callouts.json`, file: (m) => `${m}.callouts.json` },
];
const CONTENT = {
  tri: { type: "application/gzip" },
  grenadeclip: { type: "application/gzip" },
  view: { type: "application/gzip" },
  callouts: { type: "application/json", encoding: "gzip" },
};

class FatalError extends Error {}

function fail(message) {
  throw new FatalError(message);
}

function list(text) {
  return (text ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

function installBuild(cs2) {
  const acf = join(cs2, "steamapps", "appmanifest_730.acf");
  if (!existsSync(acf)) {
    return null;
  }
  return /"buildid"\s+"(\d+)"/.exec(readFileSync(acf, "utf8"))?.[1] ?? null;
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function seconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function mb(bytes) {
  return `${(bytes / 1e6).toFixed(1)} MB`;
}

/**
 * Read access to maps/ without credentials, through the public worker. Only
 * ever used for runs that upload nothing, so a 403 (B2's answer for a missing
 * key the worker cannot list) is read as "absent".
 */
function publicStore() {
  const request = async (method, key) => {
    const response = await fetch(`${PUBLIC_BASE}/${key.replace(/^maps\//, "")}`, {
      method,
      cache: "no-store",
    });
    if (response.status === 404 || response.status === 403) {
      await response.body?.cancel();
      return null;
    }
    if (!response.ok) {
      throw new Error(`${method} ${PUBLIC_BASE}/${key}: ${response.status}`);
    }
    return response;
  };
  return {
    async get(key) {
      const response = await request("GET", key);
      return response ? Buffer.from(await response.arrayBuffer()) : null;
    },
    async exists(key) {
      const response = await request("HEAD", key);
      return response !== null;
    },
  };
}

async function readPointer(store) {
  const body = await store.get("maps/latest.json");
  return body ? parsePointer(body) : null;
}

async function readManifest(store, key) {
  const body = await store.get(`maps/${key}`);
  if (!body) {
    throw new Error(`${key} does not exist`);
  }
  return parseManifest(body, key);
}

/**
 * The newest manifest published for `build`: latest.json's when it points at
 * this build, then whatever revisions exist past it; else probed from
 * revision 1 upwards. null when the build has none.
 */
async function newestRevision(store, build, pointer, latest) {
  let revision = pointer?.build === build ? pointer.revision : 0;
  if (!revision && (await store.exists(`maps/${manifestKey(build, 1)}`))) {
    revision = 1;
  }
  if (!revision) {
    return null;
  }
  const pointed = revision;
  while (await store.exists(`maps/${manifestKey(build, revision + 1)}`)) {
    revision += 1;
  }
  const manifest =
    revision === pointed && pointer?.build === build
      ? latest
      : await readManifest(store, manifestKey(build, revision));
  return { revision, manifest };
}

/**
 * Point latest.json at (build, revision) unless it already points at the same
 * or something newer. Re-read immediately before writing.
 */
async function moveLatest(bucket, build, revision, dry) {
  const current = await readPointer(bucket);
  const target = { build, revision };
  if (current && compareRevisions(current, target) >= 0) {
    return `latest.json stays on ${current.manifest}`;
  }
  if (!dry) {
    await bucket.put("maps/latest.json", latestPointer(build, revision), {
      type: "application/json",
    });
  }
  return `${dry ? "would move" : "moved"} latest.json -> ${manifestKey(build, revision)}`;
}

async function buildMap(map, { mapsDir, rawDir, filesDir, cli, pak }) {
  const start = performance.now();
  for (const asset of ASSETS) {
    rmSync(join(filesDir, asset.file(map)), { force: true });
  }
  const result = {
    map,
    files: {},
    triFailed: false,
    calloutsFailed: false,
    viewFailed: false,
  };

  let meshes;
  try {
    meshes = await extractMap(map, { mapsDir, outDir: rawDir, cli });
    if (!meshes.tri) {
      throw new Error(`collision mesh over the cap (${meshes.note})`);
    }
  } catch (error) {
    result.triFailed = true;
    console.warn(`${map.padEnd(18)} FAILED ${error.message}`);
    return result;
  }
  result.viewFailed = !meshes.view;

  let callouts;
  try {
    callouts = extractCallouts(map, { mapsDir, pak, cli });
  } catch (error) {
    callouts = { failed: error.message };
    result.calloutsFailed = true;
  }
  // generatedAt is left out on purpose: a timestamp would change the hash of
  // every map on every run and defeat the dedupe.
  const calloutsBody =
    callouts.failed || callouts.none
      ? ""
      : `${JSON.stringify({ map: callouts.map, callouts: callouts.callouts }, null, 1)}\n`;
  writeFileSync(join(rawDir, `${map}.callouts.json`), calloutsBody);

  const present = {
    tri: true,
    grenadeclip: Boolean(meshes.grenadeClip),
    view: Boolean(meshes.view),
    callouts: Boolean(calloutsBody),
  };
  const sizes = [];
  for (const asset of ASSETS) {
    if (!present[asset.name]) {
      continue;
    }
    const body = readFileSync(join(rawDir, asset.raw(map)));
    const packed = gzipSync(body, { level: 9 });
    writeFileSync(join(filesDir, asset.file(map)), packed);
    result.files[asset.name] = { file: asset.file(map), sha256: sha256(body) };
    sizes.push(`${asset.name} ${mb(body.length)}->${mb(packed.length)}`);
  }

  const calloutNote = callouts.failed
    ? `FAILED ${callouts.failed}`
    : callouts.none
      ? `none (${callouts.why})`
      : callouts.callouts.length;
  const stages = Object.entries(meshes.timings)
    .map(([k, v]) => `${k} ${seconds(v)}`)
    .join(" ");
  console.log(
    `${map.padEnd(18)} ${describe(meshes)}; callouts ${calloutNote}\n` +
      `${"".padEnd(18)} ${sizes.join(", ")} ` +
      `[${seconds(performance.now() - start)}: ${stages}]`,
  );
  return result;
}

async function build(args) {
  const has = (flag) => args.includes(flag);
  const value = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")
      ? args[i + 1]
      : fallback;
  };

  const cs2 =
    value("--cs2", null) ??
    process.env.CS2_DIR ??
    join(
      process.env.HOME ?? "",
      "Library/Application Support/Steam/steamapps/common/Counter-Strike Global Offensive",
    );
  const mapsDir = join(cs2, "game", "csgo", "maps");
  if (!existsSync(mapsDir)) {
    fail(`no CS2 maps at ${mapsDir} -- pass --cs2 <install dir>`);
  }

  const installed = installBuild(cs2);
  const build = value("--build", null) ?? installed;
  if (!build || !/^\d+$/.test(build)) {
    fail(
      "no build id: pass --build <id> or point --cs2 at an install with " +
        "steamapps/appmanifest_730.acf",
    );
  }
  if (installed && installed !== build) {
    fail(
      `the install at ${cs2} is build ${installed}, not ${build} -- ` +
        `refusing to label its maps as ${build}`,
    );
  }

  const publish = has("--publish");
  const dry = has("--dry-run");
  const bucket = bucketFromEnv();
  if (publish && !dry && !bucket) {
    fail("--publish needs S3_ACCESS_KEY and S3_SECRET");
  }
  const store = bucket ?? publicStore();

  let pointer = null;
  let latest = null;
  try {
    pointer = await readPointer(store);
    latest = pointer ? await readManifest(store, pointer.manifest) : null;
  } catch (error) {
    if (publish) {
      fail(`could not read the current latest.json: ${error.message}`);
    }
    console.warn(`• no dedupe: ${error.message}`);
  }

  const only = value("--only-maps", null) ? list(value("--only-maps", null)) : null;
  const available = eligibleMaps(mapsDir).filter((m) => !only || only.includes(m));
  const requested = value("--maps", null) ? list(value("--maps", null)) : null;
  const forceAll = has("--force");
  const forceMaps = list(value("--force-maps", null));
  const forced = (map) => forceAll || forceMaps.includes(map);

  let revision = 1;
  let base = latest;
  let candidates = requested ?? available;
  if (publish) {
    let newest;
    try {
      newest = await newestRevision(store, build, pointer, latest);
    } catch (error) {
      fail(`could not tell what build ${build} already has: ${error.message}`);
    }
    const again = newest
      ? [...new Set([...retryMaps(newest.manifest), ...available.filter(forced)])].sort()
      : [];
    if (newest && !again.length) {
      const moved = bucket
        ? await moveLatest(bucket, build, newest.revision, dry)
        : "latest.json not checked (no credentials)";
      console.log(
        `build ${build} is already published without failures ` +
          `(${manifestKey(build, newest.revision)}); ${moved}`,
      );
      return 0;
    }
    if (newest) {
      revision = newest.revision + 1;
      base = newest.manifest;
      candidates = requested ? again.filter((m) => requested.includes(m)) : again;
      console.log(
        `build ${build} revision ${newest.revision} is published; rebuilding ` +
          `${candidates.join(" ") || "nothing"} (failed or forced) as revision ${revision}`,
      );
    }
  }

  const maps = candidates.filter((m) => {
    if (!available.includes(m)) {
      const why =
        only && !only.includes(m) ? "not in --only-maps" : `not an eligible map in ${mapsDir}`;
      console.warn(`${m.padEnd(18)} SKIPPED ${why}`);
      return false;
    }
    return true;
  });
  if (!maps.length && revision === 1) {
    fail("no maps to build");
  }

  const outDir =
    value("--out", null) ??
    process.env.MAP_ASSETS_OUT ??
    join(root, ".cache", "map-assets", build);
  const rawDir = join(outDir, "raw");
  const filesDir = join(outDir, "files");
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(filesDir, { recursive: true });

  const mode = !publish ? "" : dry ? " (publish dry run)" : " (publishing)";
  console.log(
    `CS2 build ${build} revision ${revision}: ${maps.length} map(s) -> ${outDir}${mode}`,
  );

  const cli = resolveCli();
  const pipeline = pipelineFingerprint(cli);
  console.log(
    `pipeline ${pipeline.sha256.slice(0, 12)}: Source2Viewer ${pipeline.source_viewer}, ` +
      `meshoptimizer ${pipeline.meshoptimizer}, ${pipeline.files.length} script(s)`,
  );
  const pak = join(cs2, "game", "csgo", "pak01_dir.vpk");
  const started = performance.now();
  const results = [];
  let hashing = 0;
  for (const map of maps) {
    const hashStart = performance.now();
    const source = {
      vpk_sha256: await sha256File(join(mapsDir, `${map}.vpk`)),
      pipeline: pipeline.sha256,
    };
    hashing += performance.now() - hashStart;
    const before = base?.maps?.[map];
    if (!forced(map) && sameSource(before?.source, source) && !listsFailure(base, map)) {
      const reusedFrom = [
        ...new Set(
          Object.entries(before)
            .filter(([asset]) => asset !== "sha256" && asset !== "source")
            .map(([, key]) => dirname(key)),
        ),
      ];
      console.log(
        `${map.padEnd(18)} unchanged (vpk ${source.vpk_sha256.slice(0, 12)}, ` +
          `pipeline ${source.pipeline.slice(0, 12)}) -- reused ` +
          reusedFrom.map((prefix) => `${prefix}/`).join(" "),
      );
      results.push({ map, unchanged: true });
      continue;
    }
    const result = await buildMap(map, { mapsDir, rawDir, filesDir, cli, pak });
    results.push({ ...result, source });
  }
  const attempted = results.filter((r) => !r.unchanged);
  const fresh = attempted.filter((r) => !r.triFailed).length;
  const same = results.length - attempted.length;
  console.log(
    `\nbuilt ${fresh}/${attempted.length} map(s), ${same} unchanged, ` +
      `in ${seconds(performance.now() - started)} (hashing VPKs ${seconds(hashing)})`,
  );

  const { manifest, uploads, reused, carried, dropped } = mergeManifest({
    build,
    revision,
    base,
    results,
    installed: available,
    pipeline: {
      sha256: pipeline.sha256,
      source_viewer: pipeline.source_viewer,
      meshoptimizer: pipeline.meshoptimizer,
    },
    createdAt: new Date().toISOString(),
  });
  const key = manifestKey(build, revision);
  const manifestBody = Buffer.from(`${JSON.stringify(manifest, null, 1)}\n`);
  writeFileSync(join(outDir, basename(key)), manifestBody);
  writeFileSync(join(outDir, "latest.json"), latestPointer(build, revision));

  const failures = [...(manifest.failed ?? []), ...(manifest.failed_view ?? [])];
  console.log(
    `${key}: ${Object.keys(manifest.maps).length} map(s), ` +
      `${uploads.length} new file(s), ${reused} reused from ` +
      `${base ? manifestKey(base.build, base.revision ?? 1) : "nothing (first run)"}` +
      `${same ? `, ${same} unchanged` : ""}` +
      `${carried.length ? `, ${carried.length} carried over` : ""}` +
      `${dropped.length ? `; dropped (${only ? "not installed or not in --only-maps" : "no longer installed"}): ${dropped.join(" ")}` : ""}` +
      `${manifest.failed ? `; failed: ${manifest.failed.join(" ")}` : ""}` +
      `${manifest.failed_view ? `; failed_view: ${manifest.failed_view.join(" ")}` : ""}`,
  );
  const outcome = failures.length ? EXIT_FAILED_MAPS : 0;

  if (!publish) {
    console.log(`not publishing (no --publish): ${join(outDir, basename(key))}`);
    return outcome;
  }
  // Every map that needed building failed and none was reusable: that is the
  // tooling, not the maps, and a manifest of carried-over entries would only
  // hide it.
  if (revision === 1 && attempted.length && !fresh && !same) {
    fail("no map built -- refusing to publish a manifest of carried-over entries");
  }
  if (revision > 1 && sameContent(manifest, base)) {
    console.log(`the rebuild changed nothing; no revision ${revision} published`);
    return outcome;
  }

  // Settle every key before the first upload, so a refusal leaves nothing
  // new behind. An existing key is only acceptable when it is this exact
  // file, left by an interrupted run of the same revision.
  const pending = [];
  if (bucket) {
    if (await bucket.exists(`maps/${key}`)) {
      fail(`maps/${key} already exists -- published manifests are never overwritten`);
    }
    const taken = [];
    for (const upload of uploads) {
      const existing = await bucket.head(upload.key);
      if (!existing) {
        pending.push(upload);
      } else if (existing.sha256 !== upload.sha256) {
        taken.push(upload.key);
      } else {
        console.log(`  kept      ${upload.key} (already uploaded, same sha256)`);
      }
    }
    if (taken.length) {
      fail(
        "already published with different content, refusing to overwrite: " +
          taken.join(", "),
      );
    }
  } else {
    pending.push(...uploads);
  }

  for (const { map, asset, key: target, sha256: sum } of pending) {
    const spec = ASSETS.find((a) => a.name === asset);
    const body = readFileSync(join(filesDir, spec.file(map)));
    if (dry) {
      console.log(`  would put ${target.padEnd(56)} ${mb(body.length)}`);
      continue;
    }
    await bucket.put(target, body, { ...CONTENT[asset], sha256: sum });
    console.log(`  ${target.padEnd(56)} ${mb(body.length)}`);
  }

  if (dry) {
    const moved = bucket
      ? await moveLatest(bucket, build, revision, true)
      : "latest.json not checked (no credentials)";
    console.log(`  would put maps/${key}; ${moved}`);
    return outcome;
  }
  await bucket.put(`maps/${key}`, manifestBody, { type: "application/json" });
  try {
    console.log(`published maps/${key}; ${await moveLatest(bucket, build, revision, false)}`);
  } catch (error) {
    fail(
      `published maps/${key} but could not move latest.json (${error.message}) -- ` +
        "a re-run finishes it",
    );
  }
  return outcome;
}

/** Runs the build with `args` (argv without node and the script); resolves to the exit code. */
export async function run(args) {
  try {
    return await build(args);
  } catch (error) {
    console.error(`✗ ${error instanceof FatalError ? error.message : (error.stack ?? error)}`);
    return 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await run(process.argv.slice(2));
}
