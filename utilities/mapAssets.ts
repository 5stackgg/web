export function normalizeMapName(name: string): string {
  let n = (name || "").toLowerCase().trim();
  const slash = n.lastIndexOf("/");
  if (slash >= 0) {
    n = n.slice(slash + 1);
  }
  return n.replace(/_night$/, "");
}

let radarSetPromise: Promise<Set<string>> | null = null;

export function loadRadarMaps(): Promise<Set<string>> {
  if (!radarSetPromise) {
    radarSetPromise = (async () => {
      try {
        const res = await fetch("/radars/metadata.json");
        if (!res.ok) {
          return new Set<string>();
        }
        const data = await res.json();
        const set = new Set<string>();
        for (const key of Object.keys(data)) {
          if (!key.startsWith("_")) {
            set.add(key.toLowerCase());
          }
        }
        return set;
      } catch {
        return new Set<string>();
      }
    })();
  }
  return radarSetPromise;
}

export async function hasRadarForMap(mapName: string): Promise<boolean> {
  const set = await loadRadarMaps();
  return set.has(normalizeMapName(mapName));
}

export const MAP_ASSETS_ROOT = "https://demo-dl.5stack.gg/maps";
// Published before manifests existed; used when latest.json is unreachable or
// the manifest does not list the map.
export const LEGACY_MAP_BUILD = "24957633";
const LEGACY_BASE = `${MAP_ASSETS_ROOT}/${LEGACY_MAP_BUILD}`;

/**
 * Meshes are published gzipped and decompressed HERE rather than by the CDN.
 * Measured: a Worker's `fetch` auto-decompresses a gzip subresponse and strips
 * the header, and Cloudflare's edge only re-compresses MIME types on its
 * compressible list, which `application/octet-stream` is not -- inferno arrived
 * 18.6 MB instead of 2.4 MB. Same shape as the replay blob (`fetchReplayBlob`).
 */
export const MESH_EXT = ".tri.gz";
export const VIEW_EXT = ".view.bin.gz";
export const GRENADECLIP_EXT = ".grenadeclip.tri.gz";
export const CALLOUTS_EXT = ".callouts.json";

export type MapAssetKind = "tri" | "view" | "grenadeclip" | "callouts";

const ASSET_KINDS: MapAssetKind[] = ["tri", "view", "grenadeclip", "callouts"];

export type MapAssetManifest = {
  version: number;
  build: string;
  // The manifest's own key, e.g. "<build>/manifest.r2.json" when a build was
  // republished; latest.json names it, so it is never assumed.
  key: string;
  maps: Record<string, Partial<Record<MapAssetKind, string>>>;
};

export type MapAssetUrls = Record<MapAssetKind, string | null> & {
  // "override": NUXT_PUBLIC_MAP_MESH_CDN, where nothing is known to exist.
  // "manifest": the published manifest has an entry for the map.
  // "legacy": no usable manifest, or the map is not in it.
  source: "override" | "manifest" | "legacy";
  build: string | null;
  // Kinds the manifest lists, which exist without probing. The .tri and the
  // callouts otherwise fall back to the pinned pre-manifest build, the same
  // rule the demo parser and the api resolve the .tri by; that build never had
  // view meshes or grenade clips, so those stay null.
  listed: MapAssetKind[];
};

const LATEST_TTL_MS = 10 * 60 * 1000;
const FAILED_RETRY_MS = 60 * 1000;
const LATEST_STORAGE_KEY = "map-assets:latest:v1";
const MANIFEST_STORAGE_KEY = "map-assets:manifest:v1";
const ASSET_KEY = /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*$/;

type LatestPointer = { build: string; manifest: string };

let manifestMemo: {
  at: number;
  promise: Promise<MapAssetManifest | null>;
} | null = null;

function isAssetKey(value: unknown): value is string {
  return (
    typeof value === "string" && ASSET_KEY.test(value) && !value.includes("..")
  );
}

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function parseLatest(body: any): LatestPointer | null {
  if (!body || body.version !== 1 || !isAssetKey(body.manifest)) {
    return null;
  }
  return { build: String(body.build ?? ""), manifest: body.manifest };
}

function parseManifest(body: any, key: string): MapAssetManifest | null {
  if (!body || body.version !== 1 || typeof body.maps !== "object") {
    return null;
  }
  const maps: MapAssetManifest["maps"] = {};
  for (const [name, entry] of Object.entries(body.maps ?? {})) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const keys: Partial<Record<MapAssetKind, string>> = {};
    for (const kind of ASSET_KINDS) {
      const key = (entry as Record<string, unknown>)[kind];
      if (isAssetKey(key)) {
        keys[kind] = key;
      }
    }
    maps[normalizeMapName(name)] = keys;
  }
  return { version: 1, build: String(body.build ?? ""), key, maps };
}

async function fetchLatest(): Promise<LatestPointer | null> {
  const stored = readStorage<LatestPointer & { at: number }>(
    LATEST_STORAGE_KEY,
  );
  if (stored && Date.now() - stored.at < LATEST_TTL_MS) {
    const pointer = parseLatest({ version: 1, ...stored });
    if (pointer) {
      return pointer;
    }
  }
  try {
    // Revalidated on every read: the only mutable key, and a browser that once
    // cached it under the worker's blanket 30-day immutable header would
    // otherwise never see another build.
    const res = await fetch(`${MAP_ASSETS_ROOT}/latest.json`, {
      cache: "no-cache",
    });
    if (!res.ok) {
      return null;
    }
    const pointer = parseLatest(await res.json());
    if (pointer) {
      writeStorage(LATEST_STORAGE_KEY, { ...pointer, at: Date.now() });
    }
    return pointer;
  } catch {
    return null;
  }
}

async function fetchManifest(): Promise<MapAssetManifest | null> {
  const latest = await fetchLatest();
  if (!latest) {
    return null;
  }
  const stored = readStorage<{ key: string; manifest: unknown }>(
    MANIFEST_STORAGE_KEY,
  );
  if (stored?.key === latest.manifest) {
    const manifest = parseManifest(stored.manifest, latest.manifest);
    if (manifest) {
      return manifest;
    }
  }
  try {
    const res = await fetch(`${MAP_ASSETS_ROOT}/${latest.manifest}`);
    if (!res.ok) {
      return null;
    }
    const manifest = parseManifest(await res.json(), latest.manifest);
    if (manifest) {
      writeStorage(MANIFEST_STORAGE_KEY, { key: latest.manifest, manifest });
    }
    return manifest;
  } catch {
    return null;
  }
}

export function loadMapAssetManifest(): Promise<MapAssetManifest | null> {
  const now = Date.now();
  if (manifestMemo && now - manifestMemo.at < LATEST_TTL_MS) {
    return manifestMemo.promise;
  }
  const memo = { at: now, promise: fetchManifest() };
  manifestMemo = memo;
  void memo.promise.then((manifest) => {
    if (!manifest) {
      memo.at = now - LATEST_TTL_MS + FAILED_RETRY_MS;
    }
  });
  return memo.promise;
}

function urlsAt(base: string, map: string): Record<MapAssetKind, string> {
  return {
    tri: `${base}/${map}${MESH_EXT}`,
    view: `${base}/${map}${VIEW_EXT}`,
    grenadeclip: `${base}/${map}${GRENADECLIP_EXT}`,
    callouts: `${base}/${map}${CALLOUTS_EXT}`,
  };
}

/**
 * `cdn` is the explicit NUXT_PUBLIC_MAP_MESH_CDN override: when set, assets
 * are read from `<cdn>/<map>.<ext>` exactly as before manifests existed (the
 * view mesh is only a guess there, so callers fall back to the .tri on a 404).
 */
export async function resolveMapAssets(
  mapName: string,
  cdn = "",
): Promise<MapAssetUrls | null> {
  const map = normalizeMapName(mapName);
  if (!map) {
    return null;
  }
  if (cdn) {
    return {
      ...urlsAt(cdn, map),
      source: "override",
      build: null,
      listed: [],
    };
  }
  const manifest = await loadMapAssetManifest();
  const entry = manifest?.maps[map];
  const legacy = urlsAt(LEGACY_BASE, map);
  if (!manifest || !entry) {
    return {
      tri: legacy.tri,
      view: null,
      grenadeclip: null,
      callouts: legacy.callouts,
      source: "legacy",
      build: LEGACY_MAP_BUILD,
      listed: [],
    };
  }
  const url = (kind: MapAssetKind) =>
    entry[kind] ? `${MAP_ASSETS_ROOT}/${entry[kind]}` : null;
  return {
    tri: url("tri") ?? legacy.tri,
    view: url("view"),
    grenadeclip: url("grenadeclip"),
    callouts: url("callouts") ?? legacy.callouts,
    source: "manifest",
    build: manifest.build,
    listed: ASSET_KINDS.filter((kind) => !!entry[kind]),
  };
}

/** Identifies where assets currently resolve from, for caches keyed on it. */
export async function mapAssetsRevision(cdn = ""): Promise<string> {
  if (cdn) {
    return cdn;
  }
  const manifest = await loadMapAssetManifest();
  return manifest ? `manifest:${manifest.key}` : `legacy:${LEGACY_MAP_BUILD}`;
}

export async function fetchMeshBuffer(
  url: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(String(response.status));
  }
  if (!response.body) {
    throw new Error("mesh response had no body");
  }

  return await new Response(
    response.body.pipeThrough(new DecompressionStream("gzip")),
  ).arrayBuffer();
}

export const VIEW_MESH_MAGIC = "5SVM";
export const VIEW_MESH_VERSION = 1;
// Same cap the viewer has always applied to the decompressed .tri.
export const MAX_VIEW_MESH_BYTES = 96 * 1024 * 1024;
export const VIEW_SURFACE_MASK = 0b11;
export const VIEW_SURFACE_SOLID = 0;
export const VIEW_SURFACE_FOLIAGE = 1;
export const VIEW_SURFACE_SEE_THROUGH = 2;
export const VIEW_FLAG_OUTSIDE = 0b100;

const VIEW_HEADER_BYTES = 32;
const VIEW_CHUNK_ENTRY_BYTES = 32;
const VIEW_CHUNK_NAME_BYTES = 16;

export type ViewMeshChunk = {
  name: string;
  positions: Float32Array;
  // NaN where the extractor found no floor under the vertex.
  floorZ: Float32Array;
  flags: Uint8Array;
  indices: Uint32Array;
};

export type ViewMesh = {
  version: number;
  bboxMin: [number, number, number];
  bboxMax: [number, number, number];
  chunks: ViewMeshChunk[];
};

function align4(n: number): number {
  return (n + 3) & ~3;
}

/** Views into `buffer` rather than copies: the buffer must outlive the mesh. */
export function parseViewMesh(buffer: ArrayBuffer): ViewMesh {
  if (buffer.byteLength < VIEW_HEADER_BYTES) {
    throw new Error("view mesh truncated");
  }
  const data = new DataView(buffer);
  const magic = String.fromCharCode(
    data.getUint8(0),
    data.getUint8(1),
    data.getUint8(2),
    data.getUint8(3),
  );
  if (magic !== VIEW_MESH_MAGIC) {
    throw new Error("not a view mesh");
  }
  const version = data.getUint16(4, true);
  if (version !== VIEW_MESH_VERSION) {
    throw new Error(`unsupported view mesh version ${version}`);
  }
  const chunkCount = data.getUint16(6, true);
  const vec = (offset: number): [number, number, number] => [
    data.getFloat32(offset, true),
    data.getFloat32(offset + 4, true),
    data.getFloat32(offset + 8, true),
  ];
  const bboxMin = vec(8);
  const bboxMax = vec(20);
  const tableEnd = VIEW_HEADER_BYTES + chunkCount * VIEW_CHUNK_ENTRY_BYTES;
  if (tableEnd > buffer.byteLength) {
    throw new Error("view mesh chunk table truncated");
  }

  const decoder = new TextDecoder();
  const chunks: ViewMeshChunk[] = [];
  for (let c = 0; c < chunkCount; c++) {
    const entry = VIEW_HEADER_BYTES + c * VIEW_CHUNK_ENTRY_BYTES;
    const nameBytes = new Uint8Array(buffer, entry, VIEW_CHUNK_NAME_BYTES);
    const nul = nameBytes.indexOf(0);
    const name = decoder.decode(
      nul >= 0 ? nameBytes.subarray(0, nul) : nameBytes,
    );
    const vertexCount = data.getUint32(entry + 16, true);
    const indexCount = data.getUint32(entry + 20, true);
    const dataOffset = data.getUint32(entry + 24, true);
    if (dataOffset % 4 !== 0) {
      throw new Error(`view mesh chunk ${name} is misaligned`);
    }
    if (indexCount % 3 !== 0) {
      throw new Error(`view mesh chunk ${name} has a partial triangle`);
    }
    const floorOffset = dataOffset + vertexCount * 12;
    const flagsOffset = floorOffset + vertexCount * 4;
    const indexOffset = flagsOffset + align4(vertexCount);
    const end = indexOffset + indexCount * 4;
    if (end > buffer.byteLength) {
      throw new Error(`view mesh chunk ${name} is truncated`);
    }
    const indices = new Uint32Array(buffer, indexOffset, indexCount);
    for (let i = 0; i < indexCount; i++) {
      if (indices[i] >= vertexCount) {
        throw new Error(`view mesh chunk ${name} indexes past its vertices`);
      }
    }
    chunks.push({
      name,
      positions: new Float32Array(buffer, dataOffset, vertexCount * 3),
      floorZ: new Float32Array(buffer, floorOffset, vertexCount),
      flags: new Uint8Array(buffer, flagsOffset, vertexCount),
      indices,
    });
  }
  return { version, bboxMin, bboxMax, chunks };
}

export async function fetchViewMeshUrl(
  url: string,
  signal?: AbortSignal,
): Promise<ViewMesh> {
  const buffer = await fetchMeshBuffer(url, signal);
  if (buffer.byteLength > MAX_VIEW_MESH_BYTES) {
    throw new Error("view mesh too large");
  }
  return parseViewMesh(buffer);
}

/** Resolves to null when no view mesh is published for the map. */
export async function fetchViewMesh(
  mapName: string,
  cdn = "",
  signal?: AbortSignal,
): Promise<ViewMesh | null> {
  const assets = await resolveMapAssets(mapName, cdn);
  if (!assets?.view) {
    return null;
  }
  return fetchViewMeshUrl(assets.view, signal);
}

export type FloorGrid = {
  minX: number;
  minY: number;
  cell: number;
  width: number;
  height: number;
  // Lowest walkable floor whose surface covers each cell's centre; `empty`
  // where none does.
  lowest: Float32Array;
  empty: number;
};

export const FLOOR_GRID_CELL = 64;
const FLOOR_GRID_MAX_CELLS = 1024;
const FLOOR_SURFACE_TOLERANCE = 16;

/**
 * Where walkable floor lies, per XY cell, so the viewer can tell an upper
 * storey (something walkable sits under it) from higher ground beside a
 * player (nothing does). A triangle counts as floor when every vertex sits on
 * its own floor; outside-only and floorless vertices never do. A cell only
 * takes a floor that covers its centre, so edges err toward "no floor".
 */
export function buildFloorGrid(
  view: ViewMesh,
  empty = VIEW_CUT_NONE,
): FloorGrid {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { positions } of view.chunks) {
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      if (x < minX) {
        minX = x;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (y > maxY) {
        maxY = y;
      }
    }
  }
  if (!(maxX >= minX && maxY >= minY)) {
    minX = minY = 0;
    maxX = maxY = 0;
  }
  const span = Math.max(maxX - minX, maxY - minY);
  const cell = Math.max(FLOOR_GRID_CELL, span / FLOOR_GRID_MAX_CELLS);
  const width = Math.max(1, Math.ceil((maxX - minX) / cell) + 1);
  const height = Math.max(1, Math.ceil((maxY - minY) / cell) + 1);
  const lowest = new Float32Array(width * height).fill(empty);

  for (const { positions: p, floorZ: f, flags, indices } of view.chunks) {
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t];
      const b = indices[t + 1];
      const c = indices[t + 2];
      const onFloor =
        Math.abs(p[a * 3 + 2] - f[a]) <= FLOOR_SURFACE_TOLERANCE &&
        Math.abs(p[b * 3 + 2] - f[b]) <= FLOOR_SURFACE_TOLERANCE &&
        Math.abs(p[c * 3 + 2] - f[c]) <= FLOOR_SURFACE_TOLERANCE;
      if (!onFloor || (flags[a] | flags[b] | flags[c]) & VIEW_FLAG_OUTSIDE) {
        continue;
      }
      const ax = p[a * 3];
      const ay = p[a * 3 + 1];
      const bx = p[b * 3];
      const by = p[b * 3 + 1];
      const cx = p[c * 3];
      const cy = p[c * 3 + 1];
      if (Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) < 1e-3) {
        continue;
      }
      const floor = Math.min(f[a], f[b], f[c]);
      const x0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - minX) / cell));
      const x1 = Math.min(
        width - 1,
        Math.floor((Math.max(ax, bx, cx) - minX) / cell),
      );
      const y0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - minY) / cell));
      const y1 = Math.min(
        height - 1,
        Math.floor((Math.max(ay, by, cy) - minY) / cell),
      );
      for (let gy = y0; gy <= y1; gy++) {
        const py = minY + (gy + 0.5) * cell;
        for (let gx = x0; gx <= x1; gx++) {
          const px = minX + (gx + 0.5) * cell;
          const w0 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
          const w1 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
          const w2 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
          const inside =
            (w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0);
          const at = gy * width + gx;
          if (inside && floor < lowest[at]) {
            lowest[at] = floor;
          }
        }
      }
    }
  }
  return { minX, minY, cell, width, height, lowest, empty };
}

// The ROOF slider (0..100) as a cut height above each vertex's own floor.
// 0 is a floor plan, 50 clears a standing player's head (72u) but sits under
// the usual 128u+ interior ceiling and just below a 112u doorway's lintel, so
// doors read as gaps; above 50 walls grow geometrically, and 100 is no cut.
export const VIEW_CUT_FLOOR = 24;
export const VIEW_CUT_DEFAULT = 110;
export const VIEW_CUT_TALL = 1024;
export const VIEW_CUT_NONE = 1e9;

export function viewCutHeight(slider: number): number {
  const v = Math.max(0, Math.min(100, Number.isFinite(slider) ? slider : 50));
  if (v >= 100) {
    return VIEW_CUT_NONE;
  }
  if (v <= 50) {
    return VIEW_CUT_FLOOR + ((VIEW_CUT_DEFAULT - VIEW_CUT_FLOOR) * v) / 50;
  }
  return (
    VIEW_CUT_DEFAULT *
    Math.pow(VIEW_CUT_TALL / VIEW_CUT_DEFAULT, (v - 50) / 49)
  );
}

const PROBE_ATTEMPTS = 3;

async function probeAsset(url: string): Promise<boolean | null> {
  for (let attempt = 0; attempt < PROBE_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.status === 404) {
        return false;
      }
      if (res.ok) {
        return true;
      }
    } catch {}
  }
  return null;
}

/**
 * Whether any of `kinds` exists for the map, in order of preference; null when
 * it could not be told (network trouble), so callers can avoid caching it.
 */
export async function mapAssetAvailability(
  cdn: string,
  mapName: string,
  kinds: MapAssetKind[],
): Promise<boolean | null> {
  const assets = await resolveMapAssets(mapName, cdn);
  if (!assets) {
    return false;
  }
  if (kinds.some((kind) => assets.listed.includes(kind))) {
    return true;
  }
  let unknown = false;
  for (const kind of kinds) {
    const url = assets[kind];
    if (!url) {
      continue;
    }
    const found = await probeAsset(url);
    if (found) {
      return true;
    }
    if (found === null) {
      unknown = true;
    }
  }
  return unknown ? null : false;
}

/**
 * The key Replay3DLite is mounted under, or null while it must not mount yet.
 * It builds its scene once, so it waits for mesh availability rather than
 * being keyed on the radar first and the map later (a Rush scene was built
 * twice that way). With a mesh the scene never reads the radar and lives for
 * the whole map; without one it draws the radar, which a Rush room swaps.
 */
export function replaySceneKey(
  mapName: string,
  meshAvailable: boolean | null,
  radarSrc: string | null,
): string | null {
  if (meshAvailable === null || !mapName) {
    return null;
  }
  return meshAvailable ? `map:${mapName}` : `radar:${radarSrc ?? ""}`;
}

const meshMemo: Record<string, Promise<boolean>> = {};

/** A map is viewable in 3D when it has a view mesh or a collision .tri. */
export function hasMeshForMap(cdn: string, mapName: string): Promise<boolean> {
  const norm = normalizeMapName(mapName);
  if (!norm) {
    return Promise.resolve(false);
  }
  const memoKey = `${cdn}|${norm}`;
  if (!meshMemo[memoKey]) {
    meshMemo[memoKey] = (async () => {
      const assets = await resolveMapAssets(norm, cdn);
      if (!assets) {
        return false;
      }
      if (assets.listed.includes("view") || assets.listed.includes("tri")) {
        return true;
      }
      // Kept on the pre-manifest key so answers cached against the pinned
      // build stay valid.
      const base = assets.source === "override" ? cdn : LEGACY_BASE;
      const cacheKey = `mesh-asset:v1:${base}:${norm}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached === "1") {
          return true;
        }
        if (cached === "0") {
          return false;
        }
      } catch {}
      const result = await mapAssetAvailability(cdn, norm, ["tri", "view"]);
      if (result !== null) {
        try {
          localStorage.setItem(cacheKey, result ? "1" : "0");
        } catch {}
      }
      return result === true;
    })();
  }
  return meshMemo[memoKey];
}
