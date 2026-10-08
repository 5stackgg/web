import { describe, expect, it } from "vitest";
import {
  GAMEDATA_STALE_MS,
  MAP_ASSETS_STALE_MS,
  formatDuration,
  gamedataChangeRows,
  gamedataErrorReason,
  gamedataRunStatus,
  mapAssetChangeRows,
  mapAssetsRunStatus,
  nodeIneligibility,
  type Cs2BuildNode,
  type GamedataRunRow,
  type MapAssetsRunRow,
} from "~/types/cs2Build";

const NOW = new Date("2026-09-28T12:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const gamedata = (fields: Partial<GamedataRunRow> = {}): GamedataRunRow => ({
  id: "1",
  build_id: 25537370,
  status: "pass",
  started_at: ago(10 * 60 * 1000),
  validated_at: ago(5 * 60 * 1000),
  trigger: "auto",
  previous_build_id: null,
  changes: null,
  ...fields,
});

const mapAssets = (
  fields: Partial<MapAssetsRunRow> = {},
): MapAssetsRunRow => ({
  build_id: "25537370",
  status: "Published",
  started_at: ago(30 * 60 * 1000),
  finished_at: ago(10 * 60 * 1000),
  created_at: ago(30 * 60 * 1000),
  updated_at: ago(10 * 60 * 1000),
  trigger: "auto",
  previous_build_id: null,
  changes: null,
  failed: [],
  failed_view: [],
  ...fields,
});

const change = (signature: string) => ({
  set: "fivestack",
  kind: "signature",
  signature,
  runtimes: ["swiftlys2"],
  previous_count: 1,
  count: 0,
});

describe("gamedataRunStatus", () => {
  it("has nothing to say about a build never validated", () => {
    expect(gamedataRunStatus(null, NOW)).toBe("none");
  });

  it("calls a pass with non-unique signatures a warning", () => {
    expect(gamedataRunStatus(gamedata(), NOW)).toBe("passed");
    expect(
      gamedataRunStatus(
        gamedata({
          changes: {
            comparable: false,
            counts: { checked: 1, broken: 0, warnings: 2, skipped: 0 },
            newly_broken: [],
            fixed: [],
            new_warnings: [],
            cleared_warnings: [],
          },
        }),
        NOW,
      ),
    ).toBe("warning");
  });

  it("maps fail and error through", () => {
    expect(gamedataRunStatus(gamedata({ status: "fail" }), NOW)).toBe("failed");
    expect(gamedataRunStatus(gamedata({ status: "error" }), NOW)).toBe("error");
  });

  it("treats a run older than the lock as left behind", () => {
    expect(
      gamedataRunStatus(
        gamedata({ status: "running", started_at: ago(60 * 1000) }),
        NOW,
      ),
    ).toBe("running");
    expect(
      gamedataRunStatus(
        gamedata({
          status: "running",
          started_at: ago(GAMEDATA_STALE_MS + 1000),
        }),
        NOW,
      ),
    ).toBe("stale");
  });
});

describe("mapAssetsRunStatus", () => {
  it.each([
    ["Published", "published"],
    ["Partial", "partial"],
    ["Failed", "failed"],
    ["Pending", "pending"],
    ["Building", "building"],
  ])("maps %s to %s", (status, expected) => {
    expect(mapAssetsRunStatus(mapAssets({ status }), NOW)).toBe(expected);
  });

  it("treats a build running past its deadline as left behind", () => {
    expect(
      mapAssetsRunStatus(
        mapAssets({
          status: "Building",
          started_at: ago(MAP_ASSETS_STALE_MS + 1000),
        }),
        NOW,
      ),
    ).toBe("stale");
  });
});

describe("nodeIneligibility", () => {
  const node = (fields: Partial<Cs2BuildNode> = {}): Cs2BuildNode => ({
    id: "node-a",
    label: null,
    status: "Online",
    enabled: true,
    build_id: 25537370,
    update_status: null,
    gpu: false,
    enabled_for_match_making: true,
    ...fields,
  });

  it("accepts an online node on the build", () => {
    expect(nodeIneligibility(node(), 25537370)).toBeNull();
  });

  it.each([
    [{ enabled: false }, { key: "disabled" }],
    [{ status: "Offline" }, { key: "status", status: "Offline" }],
    [{ update_status: "Updating" }, { key: "updating" }],
    [{ build_id: 1 }, { key: "other_build", build: "1" }],
  ])("refuses %o", (fields, reason) => {
    expect(nodeIneligibility(node(fields), 25537370)).toEqual(reason);
  });
});

describe("gamedataChangeRows", () => {
  it("lists what broke before what got better", () => {
    const rows = gamedataChangeRows(
      gamedata({
        status: "fail",
        previous_build_id: 25400000,
        changes: {
          comparable: true,
          counts: { checked: 3, broken: 2, warnings: 0, skipped: 0 },
          newly_broken: [change("New")],
          fixed: [change("Fixed")],
          new_warnings: [],
          cleared_warnings: [],
        },
        results: {
          broken: [
            { set: "fivestack", signature: "New", kind: "signature" },
            { set: "fivestack", signature: "Old", kind: "signature" },
          ],
        },
      }),
    );

    expect(rows.map((row) => `${row.change}:${row.signature}`)).toEqual([
      "broken:New",
      "still_broken:Old",
      "fixed:Fixed",
    ]);
  });

  it("keeps listing warnings the previous build already had", () => {
    const rows = gamedataChangeRows(
      gamedata({
        previous_build_id: 25400000,
        changes: {
          comparable: true,
          counts: { checked: 3, broken: 0, warnings: 2, skipped: 0 },
          newly_broken: [],
          fixed: [],
          new_warnings: [{ ...change("New"), previous_count: 1, count: 2 }],
          cleared_warnings: [],
        },
        results: {
          warnings: [
            { set: "fivestack", signature: "New", kind: "signature", count: 2 },
            { set: "upstream-ccs", signature: "Old", count: 3 },
          ],
        },
      }),
    );

    expect(rows.map((row) => `${row.change}:${row.signature}`)).toEqual([
      "warning:New",
      "warning:Old",
    ]);
  });

  it("lists every broken entry when there is nothing to compare with", () => {
    const rows = gamedataChangeRows(
      gamedata({
        status: "fail",
        results: {
          broken: [{ set: "fivestack", signature: "A", kind: "signature" }],
          warnings: [{ set: "upstream-ccs", signature: "B", count: 2 }],
        },
      }),
    );

    expect(rows.map((row) => row.change)).toEqual(["broken", "warning"]);
  });
});

describe("mapAssetChangeRows", () => {
  it("puts failures and changes before the maps that stayed the same", () => {
    const rows = mapAssetChangeRows(
      mapAssets({
        status: "Partial",
        previous_build_id: "25400000",
        failed_view: ["de_vertigo"],
        maps: {
          de_ancient: { tri: "a" },
          de_mirage: { tri: "b" },
          de_vertigo: { tri: "c" },
          rush_001: { tri: "d", view: "e" },
        },
        changes: {
          comparable: true,
          total: 4,
          added: ["rush_001"],
          removed: ["de_gone"],
          rebuilt: [{ map: "de_mirage", reason: "vpk", assets: ["tri"] }],
          unchanged: 1,
        },
      }),
    );

    expect(rows.map((row) => `${row.change}:${row.map}`)).toEqual([
      "failed:de_vertigo",
      "rebuilt:de_mirage",
      "added:rush_001",
      "removed:de_gone",
      "unchanged:de_ancient",
    ]);
    expect(rows[0].reason).toBe("view");
    expect(rows[2].assets).toEqual(["tri", "view"]);
  });

  it("lists every map with its assets on the first build", () => {
    const rows = mapAssetChangeRows(
      mapAssets({ maps: { de_mirage: { tri: "a", callouts: "b" } } }),
    );

    expect(rows).toEqual([
      {
        map: "de_mirage",
        change: "included",
        tone: "idle",
        reason: null,
        assets: ["tri", "callouts"],
      },
    ]);
  });
});

describe("formatDuration", () => {
  it.each([
    [null, null],
    [42, "42s"],
    [760, "12m 40s"],
    [7260, "2h 1m"],
  ])("formats %s as %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe("gamedataErrorReason", () => {
  it("explains an error the validator reported without a message", () => {
    expect(
      gamedataErrorReason(
        gamedata({
          status: "error",
          results: { swiftly: { error: "could not fetch SwiftlyS2 gamedata" } },
        }),
      ),
    ).toBe("could not fetch SwiftlyS2 gamedata");
    expect(
      gamedataErrorReason(
        gamedata({
          status: "error",
          results: { statuses: { fivestack: "pass", "upstream-ccs": "error" } },
        }),
      ),
    ).toBe("could not verify upstream-ccs");
  });
});
