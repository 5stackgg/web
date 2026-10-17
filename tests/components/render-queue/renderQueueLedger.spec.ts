import { describe, expect, it } from "vitest";
import {
  batchesOf,
  buildLedgerRows,
  clipBatchSummary,
  clipStatus,
  countInView,
  lineupsToRender,
  pageWindow,
  rowInView,
  type LedgerClipJob,
  type LedgerUtilityRender,
} from "~/components/render-queue/renderQueueLedger";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const iso = (minutesAgo: number) =>
  new Date(NOW - minutesAgo * 60_000).toISOString();

const clip = (overrides: Partial<LedgerClipJob> = {}): LedgerClipJob => ({
  id: "c1",
  match_map_id: "mm1",
  status: "queued",
  progress: null,
  error_message: null,
  clip_id: null,
  created_at: iso(10),
  sort_index: 0,
  last_status_at: iso(10),
  spec: { title: "nyx 4K on B", target_name: "nyx" },
  match_map: {
    id: "mm1",
    map: { name: "de_mirage", label: "Mirage" },
    match: {
      id: "m1",
      lineup_1: { name: "Northside Gaming" },
      lineup_2: { name: "Kraken Academy" },
    },
  },
  ...overrides,
});

const render = (
  overrides: Partial<LedgerUtilityRender> = {},
): LedgerUtilityRender => ({
  id: "u1",
  utility_lineup_id: "l1",
  map_name: "de_nuke",
  status: "queued",
  created_at: iso(5),
  last_status_at: iso(5),
  lineup: { name: "Outside smoke from T roof" },
  ...overrides,
});

describe("clipStatus", () => {
  it("reads a done clip without output as missing", () => {
    expect(clipStatus({ status: "done", clip_id: null })).toBe("missing");
    expect(clipStatus({ status: "done", clip_id: "x" })).toBe("done");
  });
});

describe("rowInView", () => {
  it("splits in flight, failed and finished", () => {
    expect(rowInView("flight", "clip", "rendering")).toBe(true);
    expect(rowInView("flight", "clip", "done")).toBe(false);
    expect(rowInView("failed", "clip", "missing")).toBe(true);
    expect(rowInView("failed", "clip", "cancelled")).toBe(false);
    expect(rowInView("done", "clip", "cancelled")).toBe(true);
    expect(rowInView("done", "utility", "skipped")).toBe(true);
    expect(rowInView("failed", "utility", "error")).toBe(true);
    expect(rowInView("flight", "utility", "uploading")).toBe(true);
  });
});

describe("buildLedgerRows", () => {
  const clipJobs = [
    clip({ id: "c2", sort_index: 1, status: "rendering" }),
    clip({ id: "c1", sort_index: 0 }),
    clip({
      id: "c3",
      status: "error",
      last_status_at: iso(2),
      match_map: {
        id: "mm2",
        map: { name: "de_inferno", label: "Inferno" },
        match: null,
      },
    }),
  ];
  const utilityRenders = [
    render(),
    render({ id: "u2", status: "error", last_status_at: iso(1) }),
  ];

  it("keeps queue order in flight across both queues", () => {
    const rows = buildLedgerRows({ clipJobs, utilityRenders, view: "flight" });
    expect(rows.map((row) => row.key)).toEqual([
      "clip:c1",
      "clip:c2",
      "utility:u1",
    ]);
  });

  it("lists failures newest first", () => {
    const rows = buildLedgerRows({ clipJobs, utilityRenders, view: "failed" });
    expect(rows.map((row) => row.key)).toEqual(["utility:u2", "clip:c3"]);
  });

  it("searches teams, players and lineups", () => {
    const byTeam = buildLedgerRows({
      clipJobs,
      utilityRenders,
      view: "flight",
      query: "kraken",
    });
    expect(byTeam.every((row) => row.kind === "clip")).toBe(true);

    const byLineup = buildLedgerRows({
      clipJobs,
      utilityRenders,
      view: "flight",
      query: "t roof",
    });
    expect(byLineup.map((row) => row.key)).toEqual(["utility:u1"]);
  });

  it("filters by queue and map", () => {
    expect(
      buildLedgerRows({
        clipJobs,
        utilityRenders,
        view: "flight",
        kinds: new Set(["utility"]),
      }).map((row) => row.key),
    ).toEqual(["utility:u1"]);

    expect(
      buildLedgerRows({
        clipJobs,
        utilityRenders,
        view: "failed",
        maps: new Set(["de_inferno"]),
      }).map((row) => row.key),
    ).toEqual(["clip:c3"]);
  });

  it("counts what a view holds", () => {
    expect(countInView(clipJobs, utilityRenders, "failed")).toBe(2);
    expect(countInView(clipJobs, utilityRenders, "flight")).toBe(3);
  });
});

describe("clipBatchSummary", () => {
  it("adds up a batch and its progress", () => {
    const summary = clipBatchSummary(
      "mm1",
      [
        clip({ id: "a", status: "done", clip_id: "x" }),
        clip({ id: "b", status: "rendering", progress: "0.5" }),
        clip({ id: "c", status: "done", clip_id: null }),
        clip({ id: "d" }),
      ],
      NOW,
    );
    expect(summary).toMatchObject({
      total: 4,
      done: 1,
      failed: 1,
      terminal: 2,
      inFlight: 2,
      activeJobId: "b",
    });
    expect(summary.progress).toBeCloseTo(1.5 / 4);
    expect(summary.boot).toBeNull();
  });

  it("reads the pod boot from booting ticks on queued rows", () => {
    const summary = clipBatchSummary(
      "mm1",
      [
        clip({
          last_status_at: iso(0.5),
          status_history: [
            { status: "booting", at: iso(3), boot_stage: "downloading_cs2" },
            {
              status: "booting",
              at: iso(1),
              boot_stage: "launching_steam:Starting",
              boot_progress: 0.4,
            },
          ],
        }),
      ],
      NOW,
    );
    expect(summary.boot).toEqual({
      stage: "launching_steam",
      progress: 0.4,
      at: Date.parse(iso(1)),
    });
  });

  it("drops a boot the pod stopped talking about", () => {
    const summary = clipBatchSummary(
      "mm1",
      [
        clip({
          last_status_at: iso(20),
          status_history: [
            { status: "booting", at: iso(20), boot_stage: "logging_in" },
          ],
        }),
      ],
      NOW,
    );
    expect(summary.boot).toBeNull();
  });
});

describe("bulk helpers", () => {
  it("cancels each batch once", () => {
    expect(
      batchesOf([
        { match_map_id: "a" },
        { match_map_id: "b" },
        { match_map_id: "a" },
      ]),
    ).toEqual(["a", "b"]);
  });

  it("renders each lineup once and skips ones already rendering", () => {
    expect(
      lineupsToRender(
        [
          { utility_lineup_id: "l1" },
          { utility_lineup_id: "l2" },
          { utility_lineup_id: "l1" },
        ],
        new Set(["l2"]),
      ),
    ).toEqual(["l1"]);
  });
});

describe("pageWindow", () => {
  it("elides the middle of a long run", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
  });
});
