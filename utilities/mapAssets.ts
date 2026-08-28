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

const meshMemo: Record<string, Promise<boolean>> = {};

/**
 * Meshes are published gzipped and decompressed HERE rather than by the CDN.
 * Measured: a Worker's `fetch` auto-decompresses a gzip subresponse and strips
 * the header, and Cloudflare's edge only re-compresses MIME types on its
 * compressible list, which `application/octet-stream` is not -- inferno arrived
 * 18.6 MB instead of 2.4 MB. Same shape as the replay blob (`fetchReplayBlob`).
 */
export const MESH_EXT = ".tri.gz";

export function meshUrlForMap(cdn: string, mapName: string): string | null {
  const norm = normalizeMapName(mapName);
  return cdn && norm ? `${cdn}/${norm}${MESH_EXT}` : null;
}

export async function fetchMeshBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);

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

export function hasMeshForMap(cdn: string, mapName: string): Promise<boolean> {
  const norm = normalizeMapName(mapName);
  if (!cdn || !norm) {
    return Promise.resolve(false);
  }
  if (!meshMemo[norm]) {
    meshMemo[norm] = (async () => {
      const cacheKey = `mesh-asset:v1:${cdn}:${norm}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached === "1") {
          return true;
        }
        if (cached === "0") {
          return false;
        }
      } catch {}
      let result: boolean | null = null;
      for (let attempt = 0; attempt < 3 && result === null; attempt++) {
        try {
          const res = await fetch(`${cdn}/${norm}${MESH_EXT}`, { method: "HEAD" });
          if (res.status === 404) {
            result = false;
          } else if (res.ok) {
            result = true;
          }
        } catch {
          result = null;
        }
      }
      if (result !== null) {
        try {
          localStorage.setItem(cacheKey, result ? "1" : "0");
        } catch {}
      }
      return result === true;
    })();
  }
  return meshMemo[norm];
}
