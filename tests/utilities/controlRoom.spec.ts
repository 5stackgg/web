// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  currentMapFor,
  defaultPreview,
  matchReadiness,
  onAirClock,
  sortPreviews,
  takeBlock,
  takeMode,
  wentLiveAt,
  type ControlRoomMatch,
} from "~/utilities/controlRoom";

const match = (o: Partial<ControlRoomMatch> = {}): ControlRoomMatch => ({
  id: "m1",
  status: "Live",
  server_id: "s1",
  is_server_online: true,
  match_maps: [],
  ...o,
});

describe("matchReadiness", () => {
  it("is ready when live with an online server", () => {
    expect(matchReadiness(match())).toBeNull();
  });

  it("names the pre-live status first", () => {
    expect(matchReadiness(match({ status: "Veto" }))).toBe("veto");
    expect(matchReadiness(match({ status: "WaitingForServer" }))).toBe(
      "waiting_for_server",
    );
    expect(matchReadiness(match({ status: "WaitingForCheckIn" }))).toBe(
      "check_in",
    );
    expect(matchReadiness(match({ status: "PickingPlayers" }))).toBe(
      "not_live",
    );
  });

  it("then the server", () => {
    expect(matchReadiness(match({ server_id: null }))).toBe("no_server");
    expect(matchReadiness(match({ is_server_online: null }))).toBe(
      "server_offline",
    );
  });
});

describe("takeMode", () => {
  it("switches only when a broadcast runs and there's no room for another", () => {
    expect(takeMode(true, true)).toBe("switch");
    expect(takeMode(true, false)).toBe("start");
    expect(takeMode(false, false)).toBe("start");
  });
});

describe("takeBlock", () => {
  const base = {
    match: match(),
    mode: "start" as const,
    gpuTotal: 1,
    gpuPoolReady: true,
    hasFreeGpu: true,
    atCapacity: false,
  };

  it("lets a ready match start on a free GPU", () => {
    expect(takeBlock(base)).toBeNull();
  });

  it("puts the match's own reason before GPU reasons", () => {
    expect(
      takeBlock({ ...base, match: match({ status: "Veto" }), gpuTotal: 0 }),
    ).toBe("veto");
  });

  it("blocks a start on GPUs and capacity", () => {
    expect(takeBlock({ ...base, gpuTotal: 0, hasFreeGpu: false })).toBe(
      "no_gpu_nodes",
    );
    expect(takeBlock({ ...base, hasFreeGpu: false })).toBe("no_free_gpu");
    expect(takeBlock({ ...base, atCapacity: true })).toBe("at_capacity");
  });

  it("doesn't call a pool it hasn't heard from empty", () => {
    expect(takeBlock({ ...base, gpuPoolReady: false, gpuTotal: 0 })).toBeNull();
  });

  it("lets a switch reuse the pod without a free GPU", () => {
    expect(
      takeBlock({
        ...base,
        mode: "switch",
        hasFreeGpu: false,
        atCapacity: true,
      }),
    ).toBeNull();
  });
});

describe("sortPreviews", () => {
  it("puts on air first, then live, then the rest, keeping order", () => {
    const list = [
      match({ id: "veto", status: "Veto" }),
      match({ id: "live-a" }),
      match({ id: "air" }),
      match({ id: "live-b" }),
    ];
    expect(sortPreviews(list, new Set(["air"])).map((m) => m.id)).toEqual([
      "air",
      "live-a",
      "live-b",
      "veto",
    ]);
  });
});

describe("defaultPreview", () => {
  it("picks the first ready match that isn't on air", () => {
    const list = [
      match({ id: "air" }),
      match({ id: "veto", status: "Veto" }),
      match({ id: "ready" }),
    ];
    expect(defaultPreview(list, new Set(["air"]))).toBe("ready");
    expect(defaultPreview([match({ status: "Veto" })], new Set())).toBeNull();
  });
});

describe("currentMapFor", () => {
  const maps = [
    { id: "a", lineup_1_score: 13, lineup_2_score: 9, map: null },
    { id: "b", lineup_1_score: 4, lineup_2_score: 2, map: null },
    { id: "c", lineup_1_score: 0, lineup_2_score: 0, map: null },
  ];

  it("follows current_match_map_id", () => {
    expect(
      currentMapFor(match({ match_maps: maps, current_match_map_id: "a" }))?.id,
    ).toBe("a");
  });

  it("falls back to the last scored map", () => {
    expect(currentMapFor(match({ match_maps: maps }))?.id).toBe("b");
    expect(currentMapFor(match())).toBeNull();
  });
});

describe("wentLiveAt", () => {
  it("reads the last live entry of the status history", () => {
    expect(
      wentLiveAt({
        is_live: true,
        status_history: [
          { status: "booting", at: "2026-10-16T10:00:00Z" },
          { status: "live", at: "2026-10-16T10:02:00Z" },
        ],
      }),
    ).toBe(Date.parse("2026-10-16T10:02:00Z"));
  });

  it("is null until the stream is live", () => {
    expect(wentLiveAt({ is_live: false, status_history: [] })).toBeNull();
    expect(wentLiveAt(null)).toBeNull();
  });
});

describe("onAirClock", () => {
  it("shows minutes and seconds, then hours", () => {
    expect(onAirClock(0, 83_000)).toBe("1:23");
    expect(onAirClock(0, 3_723_000)).toBe("1:02:03");
    expect(onAirClock(10_000, 0)).toBe("0:00");
  });
});
