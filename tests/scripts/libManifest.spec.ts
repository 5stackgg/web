// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  compareRevisions,
  hasFailures,
  latestPointer,
  manifestKey,
  mergeManifest,
  parsePointer,
  retryMaps,
  revisionOf,
  sameContent,
  uploadPrefix,
} from "~/scripts/lib-manifest.mjs";

const NOW = "2026-09-27T00:00:00.000Z";

const file = (name: string, sha256: string) => ({ file: name, sha256 });

function built(map: string, sums: Record<string, string>, flags = {}) {
  const suffix: Record<string, string> = {
    tri: "tri.gz",
    grenadeclip: "grenadeclip.tri.gz",
    view: "view.bin.gz",
    callouts: "callouts.json",
  };
  return {
    map,
    files: Object.fromEntries(
      Object.entries(sums).map(([asset, sum]) => [asset, file(`${map}.${suffix[asset]}`, sum)]),
    ),
    triFailed: false,
    calloutsFailed: false,
    viewFailed: false,
    ...flags,
  };
}

const previous = {
  version: 1,
  build: "100",
  created_at: NOW,
  maps: {
    de_mirage: {
      tri: "100/de_mirage.tri.gz",
      view: "100/de_mirage.view.bin.gz",
      callouts: "100/de_mirage.callouts.json",
      sha256: { tri: "t1", view: "v1", callouts: "c1" },
    },
    de_nuke: {
      tri: "100/de_nuke.tri.gz",
      callouts: "100/de_nuke.callouts.json",
      sha256: { tri: "n1", callouts: "nc1" },
    },
  },
};

describe("manifest keys", () => {
  it("names revision 1 manifest.json and later ones manifest.r<N>.json", () => {
    expect(manifestKey("200")).toBe("200/manifest.json");
    expect(manifestKey("200", 3)).toBe("200/manifest.r3.json");
    expect(uploadPrefix("200")).toBe("200");
    expect(uploadPrefix("200", 3)).toBe("200/r3");
    expect(revisionOf("200/manifest.json")).toEqual({ build: "200", revision: 1 });
    expect(revisionOf("200/manifest.r3.json")).toEqual({ build: "200", revision: 3 });
    expect(revisionOf("200/de_mirage.tri.gz")).toBeNull();
  });

  it("round-trips latest.json and rejects other shapes", () => {
    expect(parsePointer(latestPointer("200", 2))).toEqual({
      build: "200",
      revision: 2,
      manifest: "200/manifest.r2.json",
    });
    expect(() => parsePointer(Buffer.from('{"version":1,"build":"200"}'))).toThrow(/shape/);
    expect(() =>
      parsePointer(Buffer.from('{"version":1,"build":"201","manifest":"200/manifest.json"}')),
    ).toThrow(/shape/);
  });

  it("orders builds numerically, then revisions", () => {
    expect(compareRevisions({ build: "99", revision: 5 }, { build: "100", revision: 1 })).toBe(-1);
    expect(compareRevisions({ build: "100", revision: 2 }, { build: "100", revision: 1 })).toBe(1);
    expect(compareRevisions({ build: "100", revision: 2 }, { build: "100", revision: 2 })).toBe(0);
  });
});

describe("mergeManifest", () => {
  it("reuses keys whose sha256 did not change and uploads the rest", () => {
    const { manifest, uploads, reused } = mergeManifest({
      build: "200",
      base: previous,
      results: [built("de_mirage", { tri: "t1", view: "v2", callouts: "c1" })],
      createdAt: NOW,
    });
    expect(manifest.maps.de_mirage).toEqual({
      tri: "100/de_mirage.tri.gz",
      view: "200/de_mirage.view.bin.gz",
      callouts: "100/de_mirage.callouts.json",
      sha256: { tri: "t1", view: "v2", callouts: "c1" },
    });
    expect(uploads).toEqual([
      { map: "de_mirage", asset: "view", key: "maps/200/de_mirage.view.bin.gz", sha256: "v2" },
    ]);
    expect(reused).toBe(2);
    expect(manifest.maps.de_nuke).toBe(previous.maps.de_nuke);
    expect(manifest).not.toHaveProperty("failed");
    expect(manifest).not.toHaveProperty("failed_view");
    expect(manifest).not.toHaveProperty("revision");
  });

  it("ships a map whose view failed without one and lists it", () => {
    const { manifest } = mergeManifest({
      build: "200",
      base: previous,
      results: [built("de_mirage", { tri: "t2", callouts: "c1" }, { viewFailed: true })],
      createdAt: NOW,
    });
    expect(manifest.maps.de_mirage).not.toHaveProperty("view");
    expect(manifest.maps.de_mirage.tri).toBe("200/de_mirage.tri.gz");
    expect(manifest.failed_view).toEqual(["de_mirage"]);
    expect(manifest).not.toHaveProperty("failed");
  });

  it("keeps the previous entry of a map whose collision failed", () => {
    const { manifest, uploads } = mergeManifest({
      build: "200",
      base: previous,
      results: [
        built("de_nuke", {}, { triFailed: true }),
        built("de_brand_new", {}, { triFailed: true }),
      ],
      createdAt: NOW,
    });
    expect(manifest.maps.de_nuke).toBe(previous.maps.de_nuke);
    expect(manifest.maps).not.toHaveProperty("de_brand_new");
    expect(manifest.failed).toEqual(["de_brand_new", "de_nuke"]);
    expect(uploads).toEqual([]);
  });

  it("keeps the previous callouts when they failed and lists the map", () => {
    const { manifest } = mergeManifest({
      build: "200",
      base: previous,
      results: [built("de_mirage", { tri: "t2", view: "v1" }, { calloutsFailed: true })],
      createdAt: NOW,
    });
    expect(manifest.maps.de_mirage.callouts).toBe("100/de_mirage.callouts.json");
    expect(manifest.maps.de_mirage.sha256.callouts).toBe("c1");
    expect(manifest.failed).toEqual(["de_mirage"]);
  });

  it("puts a retry's files under r<N> and clears what it fixed", () => {
    const first = mergeManifest({
      build: "200",
      base: previous,
      results: [
        built("de_mirage", { tri: "t1", callouts: "c1" }, { viewFailed: true }),
        built("de_nuke", {}, { triFailed: true }),
      ],
      createdAt: NOW,
    }).manifest;
    expect(retryMaps(first)).toEqual(["de_mirage", "de_nuke"]);

    const { manifest, uploads } = mergeManifest({
      build: "200",
      revision: 2,
      base: first,
      results: [built("de_mirage", { tri: "t1", view: "v1", callouts: "c1" })],
      createdAt: NOW,
    });
    expect(manifest.revision).toBe(2);
    expect(manifest.maps.de_mirage.view).toBe("200/r2/de_mirage.view.bin.gz");
    expect(uploads.map((u: { key: string }) => u.key)).toEqual([
      "maps/200/r2/de_mirage.view.bin.gz",
    ]);
    expect(manifest.failed).toEqual(["de_nuke"]);
    expect(manifest).not.toHaveProperty("failed_view");
    expect(hasFailures(manifest)).toBe(true);
  });

  it("keeps an unchanged map's entry verbatim and records a built map's source", () => {
    const source = { vpk_sha256: "a".repeat(64), pipeline: "b".repeat(64) };
    const { manifest, unchanged, uploads } = mergeManifest({
      build: "200",
      base: previous,
      results: [
        { map: "de_mirage", unchanged: true },
        { ...built("de_nuke", { tri: "n2", callouts: "nc1" }), source },
      ],
      pipeline: { sha256: "b".repeat(64), source_viewer: "20.0", meshoptimizer: "1.1.1" },
      createdAt: NOW,
    });
    expect(unchanged).toEqual(["de_mirage"]);
    expect(manifest.maps.de_mirage).toBe(previous.maps.de_mirage);
    expect(manifest.maps.de_nuke.source).toEqual(source);
    expect(manifest.pipeline.source_viewer).toBe("20.0");
    expect(uploads.map((u: { key: string }) => u.key)).toEqual(["maps/200/de_nuke.tri.gz"]);
  });

  it("drops maps, and their failure listings, that are no longer installed", () => {
    const base = { ...previous, failed_view: ["de_nuke"], failed: ["de_gone"] };
    const { manifest, dropped, carried } = mergeManifest({
      build: "200",
      base,
      results: [],
      installed: ["de_mirage"],
      createdAt: NOW,
    });
    expect(Object.keys(manifest.maps)).toEqual(["de_mirage"]);
    expect(dropped).toEqual(["de_nuke"]);
    expect(carried).toEqual(["de_mirage"]);
    expect(manifest).not.toHaveProperty("failed");
    expect(manifest).not.toHaveProperty("failed_view");
  });

  it("recognises a retry that changed nothing", () => {
    const base = { ...previous, failed_view: ["de_nuke"] };
    const { manifest } = mergeManifest({
      build: "100",
      revision: 2,
      base,
      results: [built("de_nuke", { tri: "n1", callouts: "nc1" }, { viewFailed: true })],
      createdAt: "later",
    });
    expect(sameContent(manifest, base)).toBe(true);
  });
});
