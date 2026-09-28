// @vitest-environment node
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MapAssets = typeof import("~/utilities/mapAssets");

type ChunkSpec = {
  name: string;
  positions: number[];
  floorZ: number[];
  flags: number[];
  indices: number[];
};

const ROOT = "https://demo-dl.5stack.gg/maps";

function align4(n: number) {
  return (n + 3) & ~3;
}

// Writes a .view.bin exactly as the format spec lays it out, so the parser is
// checked against the spec rather than against its own reading of it.
function buildViewBin(
  chunks: ChunkSpec[],
  bbox: [number[], number[]] = [
    [-1, -2, -3],
    [4, 5, 6],
  ],
): ArrayBuffer {
  let offset = 32 + chunks.length * 32;
  const offsets = chunks.map((chunk) => {
    const at = offset;
    const vertices = chunk.floorZ.length;
    offset +=
      vertices * 12 +
      vertices * 4 +
      align4(vertices) +
      chunk.indices.length * 4;
    return at;
  });
  const buffer = new ArrayBuffer(offset);
  const data = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  bytes.set(new TextEncoder().encode("5SVM"), 0);
  data.setUint16(4, 1, true);
  data.setUint16(6, chunks.length, true);
  bbox[0].forEach((v, i) => data.setFloat32(8 + i * 4, v, true));
  bbox[1].forEach((v, i) => data.setFloat32(20 + i * 4, v, true));
  chunks.forEach((chunk, c) => {
    const entry = 32 + c * 32;
    bytes.set(new TextEncoder().encode(chunk.name), entry);
    const vertices = chunk.floorZ.length;
    data.setUint32(entry + 16, vertices, true);
    data.setUint32(entry + 20, chunk.indices.length, true);
    data.setUint32(entry + 24, offsets[c], true);
    let at = offsets[c];
    for (const v of chunk.positions) {
      data.setFloat32(at, v, true);
      at += 4;
    }
    for (const v of chunk.floorZ) {
      data.setFloat32(at, v, true);
      at += 4;
    }
    for (const v of chunk.flags) {
      data.setUint8(at, v);
      at += 1;
    }
    at = align4(at);
    for (const v of chunk.indices) {
      data.setUint32(at, v, true);
      at += 4;
    }
  });
  return buffer;
}

const WORLD: ChunkSpec = {
  name: "world",
  positions: [0, 0, 0, 100, 0, 0, 0, 100, 128],
  floorZ: [0, 0, NaN],
  flags: [0, 1, 0b110],
  indices: [0, 1, 2],
};

const ROOM: ChunkSpec = {
  name: "room101",
  positions: [0, 0, 10, 50, 0, 10, 50, 50, 10, 0, 50, 10, 25, 25, 200],
  floorZ: [10, 10, 10, 10, 10],
  flags: [0, 0, 2, 2, 4],
  indices: [0, 1, 2, 0, 2, 3, 3, 2, 4],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const MANIFEST = {
  version: 1,
  build: "25537370",
  created_at: "2026-09-27T00:00:00Z",
  maps: {
    de_mirage: {
      tri: "25537370/de_mirage.tri.gz",
      grenadeclip: "25537370/de_mirage.grenadeclip.tri.gz",
      view: "24957633/de_mirage.view.bin.gz",
      callouts: "25537370/de_mirage.callouts.json",
      sha256: { tri: "a", view: "b" },
    },
    de_nuke: {
      view: "25537370/de_nuke.view.bin.gz",
    },
    de_evil: {
      tri: "https://elsewhere.example/de_evil.tri.gz",
      view: "../secrets/de_evil.view.bin.gz",
    },
  },
};

function routes(
  table: Record<string, () => Response | Promise<Response>>,
): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    const handler = table[url];
    if (!handler) {
      return new Response(null, { status: 404 });
    }
    return handler();
  });
}

const PUBLISHED = {
  [`${ROOT}/latest.json`]: () =>
    json({ version: 1, build: "25537370", manifest: "25537370/manifest.json" }),
  [`${ROOT}/25537370/manifest.json`]: () => json(MANIFEST),
};

const REVISED = {
  version: 1,
  build: "25537371",
  created_at: "2026-09-28T00:00:00Z",
  failed: ["de_ancient"],
  failed_view: ["de_inferno"],
  maps: {
    de_mirage: MANIFEST.maps.de_mirage,
    de_inferno: {
      tri: "25537371/de_inferno.tri.gz",
      callouts: "25537371/de_inferno.callouts.json",
    },
  },
};

const REVISED_ROUTES = {
  [`${ROOT}/latest.json`]: () =>
    json({
      version: 1,
      build: "25537371",
      manifest: "25537371/manifest.r2.json",
    }),
  [`${ROOT}/25537371/manifest.r2.json`]: () => json(REVISED),
};

let assets: MapAssets;
let storage: Map<string, string>;

beforeEach(async () => {
  vi.resetModules();
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  assets = await import("~/utilities/mapAssets");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseViewMesh", () => {
  it("reads every chunk as views over the spec's layout", () => {
    const mesh = assets.parseViewMesh(buildViewBin([WORLD, ROOM]));

    expect(mesh.version).toBe(1);
    expect(mesh.bboxMin).toEqual([-1, -2, -3]);
    expect(mesh.bboxMax).toEqual([4, 5, 6]);
    expect(mesh.chunks.map((chunk) => chunk.name)).toEqual([
      "world",
      "room101",
    ]);

    const [world, room] = mesh.chunks;
    expect(Array.from(world.positions)).toEqual(WORLD.positions);
    expect(world.floorZ[0]).toBe(0);
    expect(Number.isNaN(world.floorZ[2])).toBe(true);
    expect(Array.from(world.flags)).toEqual(WORLD.flags);
    expect(Array.from(world.indices)).toEqual(WORLD.indices);

    expect(room.positions.length).toBe(15);
    expect(Array.from(room.floorZ)).toEqual(ROOM.floorZ);
    expect(Array.from(room.flags)).toEqual(ROOM.flags);
    expect(Array.from(room.indices)).toEqual(ROOM.indices);
  });

  it("decodes the surface and outside bits", () => {
    const [world] = assets.parseViewMesh(buildViewBin([WORLD])).chunks;
    const surface = (i: number) => world.flags[i] & assets.VIEW_SURFACE_MASK;

    expect(surface(0)).toBe(assets.VIEW_SURFACE_SOLID);
    expect(surface(1)).toBe(assets.VIEW_SURFACE_FOLIAGE);
    expect(surface(2)).toBe(assets.VIEW_SURFACE_SEE_THROUGH);
    expect(world.flags[2] & assets.VIEW_FLAG_OUTSIDE).toBeTruthy();
    expect(world.flags[0] & assets.VIEW_FLAG_OUTSIDE).toBeFalsy();
  });

  it("uses the whole 16 bytes for a name with no terminator", () => {
    const name = "roomparty_annex1";
    const [chunk] = assets.parseViewMesh(
      buildViewBin([{ ...WORLD, name }]),
    ).chunks;

    expect(chunk.name).toBe(name);
  });

  it("accepts an empty chunk", () => {
    const empty = {
      name: "world",
      positions: [],
      floorZ: [],
      flags: [],
      indices: [],
    };
    const mesh = assets.parseViewMesh(buildViewBin([empty, ROOM]));

    expect(mesh.chunks[0].indices.length).toBe(0);
    expect(mesh.chunks[1].indices.length).toBe(9);
  });

  it("rejects the wrong magic", () => {
    const buffer = buildViewBin([WORLD]);
    new Uint8Array(buffer)[0] = "X".charCodeAt(0);

    expect(() => assets.parseViewMesh(buffer)).toThrow("not a view mesh");
  });

  it("rejects a version it does not know", () => {
    const buffer = buildViewBin([WORLD]);
    new DataView(buffer).setUint16(4, 2, true);

    expect(() => assets.parseViewMesh(buffer)).toThrow("version 2");
  });

  it("rejects a buffer shorter than the header or chunk table", () => {
    expect(() => assets.parseViewMesh(new ArrayBuffer(10))).toThrow(
      "truncated",
    );
    const buffer = buildViewBin([WORLD]);
    new DataView(buffer).setUint16(6, 500, true);

    expect(() => assets.parseViewMesh(buffer)).toThrow("chunk table");
  });

  it("rejects a chunk that runs past the end of the file", () => {
    const buffer = buildViewBin([WORLD]);
    const short = buffer.slice(0, buffer.byteLength - 4);

    expect(() => assets.parseViewMesh(short)).toThrow("truncated");
  });

  it("rejects a misaligned chunk", () => {
    const buffer = buildViewBin([WORLD]);
    const data = new DataView(buffer);
    data.setUint32(32 + 24, data.getUint32(32 + 24, true) + 2, true);

    expect(() => assets.parseViewMesh(buffer)).toThrow("misaligned");
  });

  it("rejects indices past the chunk's vertices", () => {
    const buffer = buildViewBin([{ ...WORLD, indices: [0, 1, 3] }]);

    expect(() => assets.parseViewMesh(buffer)).toThrow("indexes past");
  });

  it("rejects a partial triangle", () => {
    const buffer = buildViewBin([{ ...WORLD, indices: [0, 1, 2, 0] }]);

    expect(() => assets.parseViewMesh(buffer)).toThrow("partial triangle");
  });
});

describe("resolveMapAssets", () => {
  it("keeps the explicit override exactly as before manifests", async () => {
    const fetchMock = routes({});
    vi.stubGlobal("fetch", fetchMock);

    const urls = await assets.resolveMapAssets(
      "de_mirage_night",
      "https://cdn.example/maps/1",
    );

    expect(urls).toMatchObject({
      source: "override",
      tri: "https://cdn.example/maps/1/de_mirage.tri.gz",
      view: "https://cdn.example/maps/1/de_mirage.view.bin.gz",
      grenadeclip: "https://cdn.example/maps/1/de_mirage.grenadeclip.tri.gz",
      callouts: "https://cdn.example/maps/1/de_mirage.callouts.json",
      listed: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows latest.json to the manifest's keys, older builds included", async () => {
    vi.stubGlobal("fetch", routes(PUBLISHED));

    const urls = await assets.resolveMapAssets("maps/de_mirage");

    expect(urls).toEqual({
      source: "manifest",
      build: "25537370",
      tri: `${ROOT}/25537370/de_mirage.tri.gz`,
      grenadeclip: `${ROOT}/25537370/de_mirage.grenadeclip.tri.gz`,
      view: `${ROOT}/24957633/de_mirage.view.bin.gz`,
      callouts: `${ROOT}/25537370/de_mirage.callouts.json`,
      listed: ["tri", "view", "grenadeclip", "callouts"],
    });
  });

  it("revalidates latest.json but leaves the immutable manifest cached", async () => {
    const fetchMock = routes(PUBLISHED);
    vi.stubGlobal("fetch", fetchMock);

    await assets.resolveMapAssets("de_mirage");

    const init = (url: string) =>
      fetchMock.mock.calls.find(([called]) => String(called) === url)?.[1];
    expect(init(`${ROOT}/latest.json`)).toMatchObject({ cache: "no-cache" });
    expect(init(`${ROOT}/25537370/manifest.json`)?.cache).toBeUndefined();
  });

  it("takes the pinned .tri and callouts for what an entry lacks", async () => {
    vi.stubGlobal("fetch", routes(PUBLISHED));

    const urls = await assets.resolveMapAssets("de_nuke");

    expect(urls).toEqual({
      source: "manifest",
      build: "25537370",
      view: `${ROOT}/25537370/de_nuke.view.bin.gz`,
      tri: `${ROOT}/24957633/de_nuke.tri.gz`,
      grenadeclip: null,
      callouts: `${ROOT}/24957633/de_nuke.callouts.json`,
      listed: ["view"],
    });
  });

  it("ignores keys that point outside maps/", async () => {
    vi.stubGlobal("fetch", routes(PUBLISHED));

    const urls = await assets.resolveMapAssets("de_evil");

    expect(urls).toMatchObject({
      source: "manifest",
      tri: `${ROOT}/24957633/de_evil.tri.gz`,
      view: null,
      listed: [],
    });
  });

  it("falls back to the pinned build for a map the manifest lacks", async () => {
    vi.stubGlobal("fetch", routes(PUBLISHED));

    const urls = await assets.resolveMapAssets("de_workshop_thing");

    expect(urls).toEqual({
      source: "legacy",
      build: "24957633",
      tri: `${ROOT}/24957633/de_workshop_thing.tri.gz`,
      view: null,
      grenadeclip: null,
      callouts: `${ROOT}/24957633/de_workshop_thing.callouts.json`,
      listed: [],
    });
  });

  it("follows a revisioned manifest key rather than assuming one", async () => {
    const fetchMock = routes(REVISED_ROUTES);
    vi.stubGlobal("fetch", fetchMock);

    const urls = await assets.resolveMapAssets("de_mirage");

    expect(urls).toMatchObject({ source: "manifest", build: "25537371" });
    const called = fetchMock.mock.calls.map(([url]) => String(url));
    expect(called).toContain(`${ROOT}/25537371/manifest.r2.json`);
    expect(called).not.toContain(`${ROOT}/25537371/manifest.json`);
    expect(await assets.mapAssetsRevision()).toBe(
      "manifest:25537371/manifest.r2.json",
    );
  });

  it("sends a map whose view failed down the .tri path", async () => {
    vi.stubGlobal("fetch", routes(REVISED_ROUTES));

    const urls = await assets.resolveMapAssets("de_inferno");

    expect(urls).toMatchObject({
      source: "manifest",
      tri: `${ROOT}/25537371/de_inferno.tri.gz`,
      view: null,
      listed: ["tri", "callouts"],
    });
    expect(await assets.fetchViewMesh("de_inferno")).toBeNull();
    expect(await assets.hasMeshForMap("", "de_inferno")).toBe(true);
  });

  it("sends a map that failed outright to the pinned build", async () => {
    vi.stubGlobal("fetch", routes(REVISED_ROUTES));

    expect(await assets.resolveMapAssets("de_ancient")).toMatchObject({
      source: "legacy",
      tri: `${ROOT}/24957633/de_ancient.tri.gz`,
      view: null,
    });
  });

  it("falls back to the pinned build when latest.json is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );

    const urls = await assets.resolveMapAssets("de_mirage");

    expect(urls).toMatchObject({
      source: "legacy",
      tri: `${ROOT}/24957633/de_mirage.tri.gz`,
      view: null,
    });
  });

  it("falls back when the manifest itself is missing", async () => {
    vi.stubGlobal(
      "fetch",
      routes({ [`${ROOT}/latest.json`]: PUBLISHED[`${ROOT}/latest.json`] }),
    );

    expect(await assets.resolveMapAssets("de_mirage")).toMatchObject({
      source: "legacy",
      tri: `${ROOT}/24957633/de_mirage.tri.gz`,
    });
  });

  it("falls back to the pinned build on a latest.json version it does not know", async () => {
    vi.stubGlobal(
      "fetch",
      routes({
        ...PUBLISHED,
        [`${ROOT}/latest.json`]: () =>
          json({ version: 2, build: "9", manifest: "25537370/manifest.json" }),
      }),
    );

    expect(await assets.resolveMapAssets("de_mirage")).toMatchObject({
      source: "legacy",
      tri: `${ROOT}/24957633/de_mirage.tri.gz`,
    });
    expect(storage.has("map-assets:latest:v1")).toBe(false);
  });

  it("falls back to the pinned build on a manifest version it does not know", async () => {
    vi.stubGlobal(
      "fetch",
      routes({
        ...PUBLISHED,
        [`${ROOT}/25537370/manifest.json`]: () =>
          json({ ...MANIFEST, version: 2 }),
        [`${ROOT}/24957633/de_mirage.tri.gz`]: () => new Response(null),
      }),
    );

    expect(await assets.resolveMapAssets("de_mirage")).toMatchObject({
      source: "legacy",
      tri: `${ROOT}/24957633/de_mirage.tri.gz`,
    });
    expect(await assets.hasMeshForMap("", "de_mirage")).toBe(true);
    expect(await assets.mapAssetsRevision()).toBe("legacy:24957633");
  });

  it("fetches latest.json and the manifest once", async () => {
    const fetchMock = routes(PUBLISHED);
    vi.stubGlobal("fetch", fetchMock);

    await assets.resolveMapAssets("de_mirage");
    await assets.resolveMapAssets("de_nuke");
    await assets.resolveMapAssets("de_dust2");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reuses a stored manifest across page loads", async () => {
    vi.stubGlobal("fetch", routes(PUBLISHED));
    await assets.resolveMapAssets("de_mirage");

    vi.resetModules();
    const fresh: MapAssets = await import("~/utilities/mapAssets");
    const fetchMock = routes({});
    vi.stubGlobal("fetch", fetchMock);

    expect(await fresh.resolveMapAssets("de_mirage")).toMatchObject({
      source: "manifest",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves nothing for an empty map name", async () => {
    expect(await assets.resolveMapAssets("  ")).toBeNull();
  });
});

describe("fetchViewMesh", () => {
  it("downloads, gunzips and parses the manifest's view mesh", async () => {
    const gz = gzipSync(new Uint8Array(buildViewBin([WORLD, ROOM])));
    vi.stubGlobal(
      "fetch",
      routes({
        ...PUBLISHED,
        [`${ROOT}/24957633/de_mirage.view.bin.gz`]: () => new Response(gz),
      }),
    );

    const mesh = await assets.fetchViewMesh("de_mirage");

    expect(mesh?.chunks.map((chunk) => chunk.indices.length)).toEqual([3, 9]);
  });

  it("is null when no view mesh is published", async () => {
    vi.stubGlobal("fetch", routes(PUBLISHED));

    expect(await assets.fetchViewMesh("de_dust2")).toBeNull();
  });

  it("throws on a missing file so the viewer can drop to the .tri", async () => {
    vi.stubGlobal("fetch", routes({}));

    await expect(
      assets.fetchViewMesh("de_mirage", "https://cdn.example/maps/1"),
    ).rejects.toThrow("404");
  });

  it("stops the download when its signal aborts", async () => {
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const pending = assets.fetchViewMeshUrl(
      `${ROOT}/25537370/de_nuke.view.bin.gz`,
      controller.signal,
    );
    controller.abort();

    await expect(pending).rejects.toThrow("aborted");
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it("hands the signal to the .tri download too", async () => {
    const fetchMock = routes({});
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(
      assets.fetchMeshBuffer(`${ROOT}/x.tri.gz`, controller.signal),
    ).rejects.toThrow("404");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      signal: controller.signal,
    });
  });
});

describe("hasMeshForMap", () => {
  it("trusts what the manifest lists without probing", async () => {
    const fetchMock = routes(PUBLISHED);
    vi.stubGlobal("fetch", fetchMock);

    expect(await assets.hasMeshForMap("", "de_nuke")).toBe(true);
    expect(await assets.hasMeshForMap("", "de_mirage")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("probes the pinned .tri for an entry that lists no mesh", async () => {
    const fetchMock = routes(PUBLISHED);
    vi.stubGlobal("fetch", fetchMock);

    expect(await assets.hasMeshForMap("", "de_evil")).toBe(false);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      `${ROOT}/24957633/de_evil.tri.gz`,
    );
  });

  it("probes the pinned build for maps outside the manifest", async () => {
    const fetchMock = routes({
      ...PUBLISHED,
      [`${ROOT}/24957633/de_train.tri.gz`]: () => new Response(null),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await assets.hasMeshForMap("", "de_train")).toBe(true);
    expect(await assets.hasMeshForMap("", "de_nowhere")).toBe(false);
    expect(storage.get(`mesh-asset:v1:${ROOT}/24957633:de_train`)).toBe("1");
  });

  it("counts a view mesh under the override when the .tri is missing", async () => {
    vi.stubGlobal(
      "fetch",
      routes({
        "https://cdn.example/maps/1/de_mirage.view.bin.gz": () =>
          new Response(null),
      }),
    );

    expect(
      await assets.hasMeshForMap("https://cdn.example/maps/1", "de_mirage"),
    ).toBe(true);
  });
});

describe("mapAssetAvailability", () => {
  it("answers null rather than false when the probe cannot tell", async () => {
    vi.stubGlobal(
      "fetch",
      routes({
        ...PUBLISHED,
        [`${ROOT}/24957633/de_train.tri.gz`]: () =>
          new Response(null, { status: 503 }),
      }),
    );

    expect(await assets.mapAssetAvailability("", "de_train", ["tri"])).toBe(
      null,
    );
  });

  it("only looks at the kinds asked for", async () => {
    vi.stubGlobal("fetch", routes(PUBLISHED));

    expect(await assets.mapAssetAvailability("", "de_nuke", ["tri"])).toBe(
      false,
    );
    expect(await assets.mapAssetAvailability("", "de_nuke", ["view"])).toBe(
      true,
    );
  });

  // MeshAvailability's line-of-sight coverage: the parser takes the manifest's
  // .tri, else the pinned build's, so coverage must answer the same way.
  it("resolves line-of-sight coverage the way the parser does", async () => {
    const fetchMock = routes({
      ...PUBLISHED,
      [`${ROOT}/24957633/de_nuke.tri.gz`]: () => new Response(null),
      [`${ROOT}/24957633/de_train.tri.gz`]: () => new Response(null),
    });
    vi.stubGlobal("fetch", fetchMock);
    const coverage = (map: string) =>
      assets.mapAssetAvailability("", map, ["tri"]);

    expect(await coverage("de_mirage")).toBe(true);
    expect(await coverage("de_nuke")).toBe(true);
    expect(await coverage("de_train")).toBe(true);
    expect(await coverage("de_nowhere")).toBe(false);
    const probed = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "HEAD")
      .map(([url]) => String(url));
    expect(probed).toEqual([
      `${ROOT}/24957633/de_nuke.tri.gz`,
      `${ROOT}/24957633/de_train.tri.gz`,
      `${ROOT}/24957633/de_nowhere.tri.gz`,
    ]);
  });

  it("probes the pinned .tri for coverage when no manifest is reachable", async () => {
    vi.stubGlobal(
      "fetch",
      routes({
        [`${ROOT}/24957633/de_mirage.tri.gz`]: () => new Response(null),
      }),
    );

    expect(await assets.mapAssetAvailability("", "de_mirage", ["tri"])).toBe(
      true,
    );
    expect(await assets.mapAssetAvailability("", "de_nuke", ["tri"])).toBe(
      false,
    );
  });
});

describe("replaySceneKey", () => {
  const mounts = (
    steps: Array<[string, boolean | null, string | null]>,
  ): string[] => {
    const keys: string[] = [];
    for (const [map, available, radar] of steps) {
      const key = assets.replaySceneKey(map, available, radar);
      if (key !== null && keys[keys.length - 1] !== key) {
        keys.push(key);
      }
    }
    return keys;
  };

  it("does not mount until mesh availability is known", () => {
    expect(assets.replaySceneKey("rush_001", null, "/radars/a.png")).toBeNull();
    expect(assets.replaySceneKey("", true, "/radars/a.png")).toBeNull();
  });

  it("mounts a Rush map with a mesh once, whatever room the radar follows", () => {
    expect(
      mounts([
        ["rush_001", null, "/radars/rush_001.png"],
        ["rush_001", null, "/radars/rush_001_room101.png"],
        ["rush_001", true, "/radars/rush_001_room101.png"],
        ["rush_001", true, "/radars/rush_001_room204.png"],
        ["rush_001", true, "/radars/rush_001_convoy.png"],
      ]),
    ).toEqual(["map:rush_001"]);
  });

  it("rebuilds the radar plane per room when there is no mesh", () => {
    expect(
      mounts([
        ["rush_001", null, "/radars/rush_001_room101.png"],
        ["rush_001", false, "/radars/rush_001_room101.png"],
        ["rush_001", false, "/radars/rush_001_room204.png"],
      ]),
    ).toEqual([
      "radar:/radars/rush_001_room101.png",
      "radar:/radars/rush_001_room204.png",
    ]);
  });

  it("mounts again only when the map itself changes", () => {
    expect(
      mounts([
        ["de_mirage", true, "/radars/de_mirage.png"],
        ["de_nuke", null, "/radars/de_nuke.png"],
        ["de_nuke", true, "/radars/de_nuke.png"],
      ]),
    ).toEqual(["map:de_mirage", "map:de_nuke"]);
  });
});

function quad(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z: number,
  floor: number,
  flag = 0,
): ChunkSpec {
  return {
    name: "world",
    positions: [x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z],
    floorZ: [floor, floor, floor, floor],
    flags: [flag, flag, flag, flag],
    indices: [0, 1, 2, 0, 2, 3],
  };
}

function merge(parts: ChunkSpec[]): ChunkSpec {
  const out: ChunkSpec = {
    name: "world",
    positions: [],
    floorZ: [],
    flags: [],
    indices: [],
  };
  for (const part of parts) {
    const base = out.floorZ.length;
    out.positions.push(...part.positions);
    out.floorZ.push(...part.floorZ);
    out.flags.push(...part.flags);
    out.indices.push(...part.indices.map((i) => i + base));
  }
  return out;
}

describe("buildFloorGrid", () => {
  const lower = quad(0, 0, 256, 256, 0, 0);
  const upper = quad(128, 0, 512, 256, 200, 200);
  const wall = {
    name: "world",
    positions: [0, 256, 0, 512, 256, 0, 512, 256, 300],
    floorZ: [0, 0, 0],
    flags: [0, 0, 0],
    indices: [0, 1, 2],
  };
  const roof = quad(640, 0, 768, 128, 150, 0);
  const outside = quad(0, 512, 256, 768, -40, -40, 0b100);
  const floorless = quad(512, 512, 768, 768, 0, NaN);
  const grid = (parts: ChunkSpec[]) =>
    assets.buildFloorGrid(assets.parseViewMesh(buildViewBin([merge(parts)])));
  const at = (g: ReturnType<typeof grid>, x: number, y: number) =>
    g.lowest[
      Math.floor((y - g.minY) / g.cell) * g.width +
        Math.floor((x - g.minX) / g.cell)
    ];

  it("keeps the lowest walkable floor over each cell", () => {
    const g = grid([lower, upper, wall, roof, outside, floorless]);

    expect(g.cell).toBe(assets.FLOOR_GRID_CELL);
    expect(at(g, 64, 64)).toBe(0);
    expect(at(g, 200, 64)).toBe(0);
    expect(at(g, 400, 64)).toBe(200);
  });

  it("ignores walls, roofs, outside-only and floorless surfaces", () => {
    const g = grid([lower, upper, wall, roof, outside, floorless]);

    expect(at(g, 400, 300)).toBe(g.empty);
    expect(at(g, 700, 64)).toBe(g.empty);
    expect(at(g, 100, 600)).toBe(g.empty);
    expect(at(g, 600, 600)).toBe(g.empty);
  });

  it("widens its cells to stay within the texture budget", () => {
    const g = grid([quad(-40000, -40000, 40000, 40000, 0, 0)]);

    expect(g.width).toBeLessThanOrEqual(1025);
    expect(g.height).toBeLessThanOrEqual(1025);
    expect(at(g, 0, 0)).toBe(0);
  });
});

describe("viewCutHeight", () => {
  it("maps the slider onto a height above the local floor", () => {
    expect(assets.viewCutHeight(0)).toBe(assets.VIEW_CUT_FLOOR);
    expect(assets.viewCutHeight(50)).toBe(assets.VIEW_CUT_DEFAULT);
    expect(assets.viewCutHeight(99)).toBeCloseTo(assets.VIEW_CUT_TALL);
    expect(assets.viewCutHeight(100)).toBe(assets.VIEW_CUT_NONE);
  });

  it("clears a standing player at the default and rises steadily", () => {
    expect(assets.viewCutHeight(50)).toBeGreaterThan(72);
    expect(assets.viewCutHeight(50)).toBeLessThan(128);
    let previous = -Infinity;
    for (let v = 0; v <= 100; v++) {
      const height = assets.viewCutHeight(v);
      expect(height).toBeGreaterThan(previous);
      previous = height;
    }
  });

  it("clamps out-of-range input", () => {
    expect(assets.viewCutHeight(-20)).toBe(assets.VIEW_CUT_FLOOR);
    expect(assets.viewCutHeight(250)).toBe(assets.VIEW_CUT_NONE);
    expect(assets.viewCutHeight(Number.NaN)).toBe(assets.VIEW_CUT_DEFAULT);
  });
});
