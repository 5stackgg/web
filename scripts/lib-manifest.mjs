// The map-asset manifest: which B2 key holds each asset of each map for one
// CS2 build, and which maps did not fully build.
//
//   maps/latest.json                      { version, build, manifest }
//   maps/<build>/manifest.json            revision 1, the build's first run
//   maps/<build>/manifest.r<N>.json       revision N: a re-run that retried
//                                         only the maps revision N-1 listed
//                                         as failed; its new files live under
//                                         maps/<build>/r<N>/
//
// Every manifest is immutable (the worker caches it for 30 days); only
// latest.json moves, and only forwards.

export const MANIFEST_VERSION = 1;
export const ASSET_NAMES = ["tri", "grenadeclip", "view", "callouts"];

/** A manifest's key relative to maps/. */
export function manifestKey(build, revision = 1) {
  return revision <= 1 ? `${build}/manifest.json` : `${build}/manifest.r${revision}.json`;
}

/** Where a revision's new files go, relative to maps/. */
export function uploadPrefix(build, revision = 1) {
  return revision <= 1 ? `${build}` : `${build}/r${revision}`;
}

/** `{ build, revision }` of a manifest key, or null for anything else. */
export function revisionOf(key) {
  const match = /^(\d+)\/manifest(?:\.r(\d+))?\.json$/.exec(key ?? "");
  if (!match) {
    return null;
  }
  return { build: match[1], revision: match[2] ? Number(match[2]) : 1 };
}

export function latestPointer(build, revision = 1) {
  const pointer = { version: MANIFEST_VERSION, build, manifest: manifestKey(build, revision) };
  return Buffer.from(`${JSON.stringify(pointer)}\n`);
}

/** latest.json's `{ build, revision, manifest }`; throws on any other shape. */
export function parsePointer(body) {
  const text = body.toString("utf8");
  let pointer;
  try {
    pointer = JSON.parse(text);
  } catch {
    throw new Error(`latest.json is not JSON: ${text.slice(0, 200)}`);
  }
  const at = pointer?.version === MANIFEST_VERSION ? revisionOf(pointer.manifest) : null;
  if (!at || at.build !== String(pointer.build)) {
    throw new Error(`latest.json has an unknown shape: ${text.slice(0, 200)}`);
  }
  return { build: at.build, revision: at.revision, manifest: pointer.manifest };
}

export function parseManifest(body, key) {
  const manifest = JSON.parse(body.toString("utf8"));
  if (manifest?.version !== MANIFEST_VERSION || typeof manifest.maps !== "object") {
    throw new Error(`${key} has an unknown shape`);
  }
  return manifest;
}

/** Order of (build, revision) pairs; builds compare as numbers. */
export function compareRevisions(a, b) {
  const byBuild = Number(a.build) - Number(b.build);
  return byBuild !== 0 ? Math.sign(byBuild) : Math.sign(a.revision - b.revision);
}

/** Maps a manifest says did not fully build, to retry. */
export function retryMaps(manifest) {
  return [...new Set([...(manifest?.failed ?? []), ...(manifest?.failed_view ?? [])])].sort();
}

export function hasFailures(manifest) {
  return retryMaps(manifest).length > 0;
}

/** Whether two manifests say the same thing, ignoring when and which revision. */
export function sameContent(a, b) {
  const content = (m) =>
    JSON.stringify({
      maps: m?.maps ?? {},
      failed: m?.failed ?? [],
      failed_view: m?.failed_view ?? [],
    });
  return content(a) === content(b);
}

const sortedObject = (object) =>
  Object.fromEntries(
    Object.keys(object)
      .sort()
      .map((key) => [key, object[key]]),
  );

/** Whether a manifest lists `map` as not fully built. */
export function listsFailure(manifest, map) {
  return retryMaps(manifest).includes(map);
}

/**
 * The manifest for one run, and the files it has to upload.
 *
 *   base       the manifest this run builds on: the newest one of this build
 *              for a retry, else latest.json's
 *   results    one per map this run looked at: `{ map, unchanged: true }` for
 *              a map whose inputs matched base's and was not built, else
 *              `{ map, source, files: { <asset>: { file, sha256 } },
 *              triFailed, calloutsFailed, viewFailed }`
 *   installed  every map in the install; base's entries for anything else
 *              are dropped. null keeps them all.
 *   pipeline   recorded as is, for whoever reads the manifest later
 *
 * An unchanged map keeps base's entry verbatim. A built file whose sha256
 * matches base's entry for the same map keeps base's key. A map whose
 * collision failed keeps base's entry whole (or has none) and is listed in
 * `failed`, as is one whose callouts failed (those keep base's callouts). A
 * map whose view mesh failed ships without `view` and is listed in
 * `failed_view`. Installed maps this run did not look at carry over from
 * base, failure listings included.
 */
export function mergeManifest({
  build,
  revision = 1,
  base = null,
  results,
  installed = null,
  pipeline = null,
  createdAt,
}) {
  const prefix = uploadPrefix(build, revision);
  const present = installed ? new Set(installed) : null;
  const kept = (map) => !present || present.has(map);
  const maps = {};
  const failed = new Set();
  const failedView = new Set();
  const uploads = [];
  const carried = [];
  const unchanged = [];
  const dropped = [];
  let reused = 0;

  const attempted = new Set();
  for (const result of [...results].sort((a, b) => a.map.localeCompare(b.map))) {
    const { map } = result;
    attempted.add(map);
    const before = base?.maps?.[map];
    if (result.unchanged) {
      maps[map] = before;
      unchanged.push(map);
      continue;
    }
    if (result.triFailed) {
      failed.add(map);
      if (before) {
        maps[map] = before;
      }
      continue;
    }

    const entry = {};
    const sums = {};
    for (const asset of ASSET_NAMES) {
      const file = result.files[asset];
      if (!file) {
        if (asset === "callouts" && result.calloutsFailed && before?.callouts) {
          entry.callouts = before.callouts;
          sums.callouts = before.sha256?.callouts;
          reused += 1;
        }
        continue;
      }
      if (before?.[asset] && before.sha256?.[asset] === file.sha256) {
        entry[asset] = before[asset];
        reused += 1;
      } else {
        entry[asset] = `${prefix}/${file.file}`;
        uploads.push({ map, asset, key: `maps/${entry[asset]}`, sha256: file.sha256 });
      }
      sums[asset] = file.sha256;
    }
    maps[map] = { ...entry, sha256: sums, ...(result.source ? { source: result.source } : {}) };
    if (result.calloutsFailed) {
      failed.add(map);
    }
    if (result.viewFailed) {
      failedView.add(map);
    }
  }

  for (const [map, entry] of Object.entries(base?.maps ?? {})) {
    if (attempted.has(map)) {
      continue;
    }
    if (kept(map)) {
      maps[map] = entry;
      carried.push(map);
    } else {
      dropped.push(map);
    }
  }
  for (const map of base?.failed ?? []) {
    if (!attempted.has(map) && kept(map)) {
      failed.add(map);
    }
  }
  for (const map of base?.failed_view ?? []) {
    if (!attempted.has(map) && kept(map)) {
      failedView.add(map);
    }
  }

  const manifest = {
    version: MANIFEST_VERSION,
    build,
    ...(revision > 1 ? { revision } : {}),
    created_at: createdAt,
    ...(pipeline ? { pipeline } : {}),
    ...(failed.size ? { failed: [...failed].sort() } : {}),
    ...(failedView.size ? { failed_view: [...failedView].sort() } : {}),
    maps: sortedObject(maps),
  };
  return { manifest, uploads, reused, carried, unchanged, dropped: dropped.sort() };
}
