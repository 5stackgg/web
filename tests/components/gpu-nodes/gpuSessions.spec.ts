// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildSessions,
  claimFor,
  formatElapsed,
  gpuNodeState,
  gpuShortName,
  matchesSearch,
  nodeMatchesFilters,
  poolHealth,
  rendersWaiting,
  sessionWorkload,
  steamTileStatus,
  waitReason,
  workloadActivity,
  type GpuSession,
} from "~/components/gpu-nodes/gpuSessions";

const node = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  label: id,
  status: "Online",
  enabled: true,
  region: "US-EAST",
  e_region: { description: "US East" },
  gpu_info: [{ name: "NVIDIA GeForce RTX 4080 SUPER", memory_mb: 16376 }],
  gpu_streaming_enabled: true,
  gpu_demos_enabled: true,
  gpu_rendering_enabled: true,
  shader_bake_status: "done",
  ...extra,
});

const match = {
  lineup_1: { name: "Clutch Gods" },
  lineup_2: { name: "Wolfpack Academy" },
};

const account = (username: string, claims: any[] = []) => ({
  username,
  claims,
});

describe("buildSessions", () => {
  it("gives each node one consumer, live first, then demo, then render", () => {
    const sessions = buildSessions({
      nodes: [node("a"), node("b")],
      streams: [
        {
          id: "s1",
          game_server_node_id: "a",
          mode: "tv",
          is_live: true,
          match_id: "m1",
          match,
          status_history: [],
        },
      ],
      demos: [
        {
          id: "d1",
          game_server_node_id: "a",
          status: "playing",
          watcher: { name: "Mira" },
          match,
          match_id: "m1",
        },
        {
          id: "d2",
          game_server_node_id: "b",
          status: "booting",
          watcher: { name: "kerbal" },
          match,
          match_id: "m2",
          status_history: [
            { status: "downloading_demo", at: "2026-10-16T10:00:00Z" },
          ],
        },
      ],
      renders: [],
      accounts: [
        account("render_01", [
          { purpose: "live", node_id: "a", created_at: "2026-10-16T09:00:00Z" },
        ]),
      ],
    });

    expect(sessions.map((s) => [s.nodeId, s.kind])).toEqual([
      ["a", "live"],
      ["b", "demo"],
    ]);
    expect(sessions[0]).toMatchObject({
      liveMode: "tv",
      matchup: "Clutch Gods vs Wolfpack Academy",
      account: "render_01",
      startedAt: Date.parse("2026-10-16T09:00:00Z"),
      booting: false,
    });
    // No claim: the start falls back to the first status it reported.
    expect(sessions[1]).toMatchObject({
      who: "kerbal",
      account: null,
      booting: true,
      startedAt: Date.parse("2026-10-16T10:00:00Z"),
    });
  });

  it("adds running bakes, but not finished or failed ones", () => {
    const sessions = buildSessions({
      nodes: [
        node("a", {
          shader_bake_status: "processing_shaders",
          shader_bake_progress: "65.6",
        }),
        node("b", { shader_bake_status: "errored" }),
        node("c", { shader_bake_status: null }),
      ],
      streams: [],
      demos: [],
      renders: [],
      accounts: [],
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      kind: "bake",
      nodeId: "a",
      booting: false,
      progress: 65.6,
    });
  });

  it("marks a render without a player as the platform's own", () => {
    const [render] = buildSessions({
      nodes: [node("a")],
      streams: [],
      demos: [],
      renders: [
        {
          id: "r1",
          game_server_node_id: "a",
          status: "rendering",
          progress: "0.42",
          user_steam_id: null,
          match_map: { match: { id: "m1", ...match } },
        },
      ],
      accounts: [],
    });
    expect(render).toMatchObject({
      kind: "highlights",
      system: true,
      progress: 0.42,
      booting: false,
      matchId: "m1",
    });
  });
});

describe("claimFor", () => {
  it("prefers the claim for the session's purpose", () => {
    const accounts = [
      account("one", [{ purpose: "bake", node_id: "a" }]),
      account("two", [{ purpose: "demo", node_id: "a" }]),
    ];
    expect(claimFor(accounts, "a", "demo")?.username).toBe("two");
    expect(claimFor(accounts, "a", "live")?.username).toBe("one");
    expect(claimFor(accounts, "b", "live")).toBeNull();
  });
});

describe("gpuNodeState", () => {
  it("orders disabled, offline and setup ahead of work", () => {
    expect(gpuNodeState(node("a", { enabled: false }), null).key).toBe(
      "disabled",
    );
    expect(gpuNodeState(node("a", { status: "Offline" }), null)).toMatchObject({
      key: "offline",
      tone: "bad",
      group: "off",
    });
    expect(gpuNodeState(node("a", { status: "Setup" }), null).key).toBe(
      "setup",
    );
  });

  it("pings only for live work", () => {
    const busy = gpuNodeState(node("a"), {
      kind: "demo",
      booting: false,
    } as any);
    expect(busy).toMatchObject({ key: "playing", live: true, group: "busy" });
    expect(
      gpuNodeState(node("a", { shader_bake_status: "launching_cs2" }), null),
    ).toMatchObject({ key: "baking", tone: "amber", live: true });
    expect(
      gpuNodeState(node("a", { shader_bake_status: "errored" }), null),
    ).toMatchObject({ key: "bake_failed", live: false });
    expect(gpuNodeState(node("a"), null)).toMatchObject({
      key: "idle",
      live: false,
    });
  });
});

describe("poolHealth", () => {
  it("needs one account per enabled GPU", () => {
    const nodes = [node("a"), node("b"), node("c", { enabled: false })];
    expect(poolHealth([], [])).toMatchObject({ key: "no_nodes" });
    expect(poolHealth(nodes, [])).toMatchObject({ key: "empty", tone: "warn" });
    expect(poolHealth(nodes, [account("x")])).toMatchObject({
      key: "short",
      short: 1,
      tone: "warn",
    });
    expect(poolHealth(nodes, [account("x"), account("y")])).toMatchObject({
      key: "enough",
      free: 2,
      total: 2,
      tone: "ok",
    });
  });

  it("warns when every account is held", () => {
    const held = [
      account("x", [{ purpose: "live", node_id: "a" }]),
      account("y", [{ purpose: "demo", node_id: "b" }]),
    ];
    expect(poolHealth([node("a"), node("b")], held)).toMatchObject({
      key: "enough",
      free: 0,
      tone: "warn",
    });
  });
});

describe("renders waiting", () => {
  it("counts queued renders that have no GPU yet", () => {
    const renders = [
      { status: "queued", game_server_node_id: "a" },
      { status: "rendering", game_server_node_id: "b" },
    ];
    expect(rendersWaiting(3, renders)).toBe(2);
    expect(rendersWaiting(0, renders)).toBe(0);
  });

  it("names what the queue is waiting for", () => {
    const nodes = [node("a")];
    expect(
      waitReason({ nodes, sessions: [], accounts: [], pausedForMatch: false }),
    ).toBe("no_accounts");
    expect(
      waitReason({
        nodes,
        sessions: [],
        accounts: [account("x")],
        pausedForMatch: true,
      }),
    ).toBe("paused_for_match");
    expect(
      waitReason({
        nodes,
        sessions: [],
        accounts: [account("x", [{ purpose: "bake", node_id: "z" }])],
        pausedForMatch: false,
      }),
    ).toBe("no_account_free");
    expect(
      waitReason({
        nodes,
        sessions: [{ nodeId: "a" } as any],
        accounts: [account("x")],
        pausedForMatch: false,
      }),
    ).toBe("no_gpu_free");
  });
});

describe("filters and search", () => {
  it("filters by workload, node type and region", () => {
    const matchNode = node("m", {
      start_port_range: 30000,
      end_port_range: 30040,
      enabled_for_match_making: true,
      region: null,
      gpu_demos_enabled: false,
    });
    const empty = { work: "", kind: "", region: "" } as const;
    expect(nodeMatchesFilters(matchNode, { ...empty, work: "demos" })).toBe(
      false,
    );
    expect(nodeMatchesFilters(matchNode, { ...empty, kind: "match" })).toBe(
      true,
    );
    expect(nodeMatchesFilters(node("g"), { ...empty, kind: "match" })).toBe(
      false,
    );
    expect(nodeMatchesFilters(matchNode, { ...empty, region: "none" })).toBe(
      true,
    );
    expect(nodeMatchesFilters(node("g"), { ...empty, region: "US-EAST" })).toBe(
      true,
    );
  });

  it("searches the GPU, the node and who is on it", () => {
    const session = {
      matchup: "NRG vs Sinners",
      who: "Mira",
      account: "render_02",
    };
    expect(matchesSearch("", node("a"))).toBe(true);
    expect(matchesSearch("4080", node("a"))).toBe(true);
    expect(matchesSearch("mira", node("a"), session as any)).toBe(true);
    expect(matchesSearch("render_02", node("a"), session as any)).toBe(true);
    expect(matchesSearch("tesla", node("a"), session as any)).toBe(false);
  });
});

describe("formatting", () => {
  it("shortens GPU names and elapsed times", () => {
    expect(gpuShortName(node("a"))).toBe("RTX 4080 SUPER");
    expect(formatElapsed(20 * 1000)).toBe("<1m");
    expect(formatElapsed(41 * 60 * 1000)).toBe("41m");
    expect(formatElapsed(63 * 60 * 1000)).toBe("1h 3m");
  });
});

describe("workload activity", () => {
  // Echoes the key and its values, so the test reads what was asked for.
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key;

  const session = (extra: Partial<GpuSession>): GpuSession => ({
    id: "x",
    kind: "live",
    nodeId: "a",
    who: null,
    matchup: null,
    matchId: null,
    account: null,
    startedAt: null,
    booting: false,
    statusHistory: null,
    status: null,
    progress: null,
    progressStage: null,
    snapshotKind: "live",
    snapshotId: "x",
    ...extra,
  });

  it("files each session under the switch it runs on", () => {
    expect(sessionWorkload(session({ kind: "live" }))).toBe("streaming");
    expect(sessionWorkload(session({ kind: "demo" }))).toBe("demos");
    expect(sessionWorkload(session({ kind: "highlights" }))).toBe("rendering");
    expect(sessionWorkload(session({ kind: "bake" }))).toBeNull();
    expect(sessionWorkload(null)).toBeNull();
  });

  it("says what is running under that one workload", () => {
    expect(
      workloadActivity(
        session({ kind: "live", matchup: "Clutch Gods vs Wolfpack Academy" }),
        t,
      ),
    ).toEqual({
      streaming:
        'pages.gpu_nodes.workload.now_streaming {"matchup":"Clutch Gods vs Wolfpack Academy"}',
    });
    expect(workloadActivity(session({ kind: "demo", who: "Mira" }), t)).toEqual(
      { demos: 'pages.gpu_nodes.workload.now_demo {"who":"Mira"}' },
    );
  });

  it("adds render progress once the render is going", () => {
    const render = session({
      kind: "highlights",
      who: "kerbal",
      status: "rendering",
      progress: 0.416,
    });
    expect(workloadActivity(render, t).rendering).toBe(
      'pages.gpu_nodes.workload.now_render_pct {"who":"kerbal","pct":42}',
    );
    expect(
      workloadActivity({ ...render, status: "uploading" }, t).rendering,
    ).toBe('pages.gpu_nodes.workload.now_render {"who":"kerbal"}');
  });

  it("names system renders and marks sessions still starting", () => {
    expect(
      workloadActivity(
        session({ kind: "highlights", system: true, booting: true }),
        t,
      ).rendering,
    ).toBe(
      'pages.gpu_nodes.workload.now_render {"who":"common.system"} · pages.gpu_nodes.state.starting',
    );
  });

  it("is empty when the GPU is idle or baking", () => {
    expect(workloadActivity(null, t)).toEqual({});
    expect(workloadActivity(session({ kind: "bake" }), t)).toEqual({});
  });
});

describe("Steam accounts tile", () => {
  it("leads with what the pool needs", () => {
    const nodes = [node("a"), node("b")];
    const free = account("free_01");
    const held = account("held_01", [{ purpose: "live", node_id: "a" }]);

    expect(steamTileStatus(poolHealth(nodes, []))).toBe("empty");
    expect(steamTileStatus(poolHealth([], []))).toBe("empty");
    expect(steamTileStatus(poolHealth([], [free]))).toBe("no_nodes");
    expect(steamTileStatus(poolHealth(nodes, [free]))).toBe("short");
    expect(steamTileStatus(poolHealth([node("a")], [held]))).toBe("busy");
    expect(steamTileStatus(poolHealth(nodes, [free, held]))).toBe("enough");
  });
});
