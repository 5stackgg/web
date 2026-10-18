import { describe, expect, it } from "vitest";
import {
  GROUP_AFTER,
  alertSignals,
  areaTone,
  dbSignals,
  gpuNodeLink,
  gpuSignals,
  groupSignals,
  metricSignals,
  metricsNodeLink,
  needCount,
  nodeLink,
  nodeSignals,
  pluginSignals,
  queryLink,
  renderSignals,
  serverSignals,
  settingsSignals,
  sortSignals,
  type AreaKey,
  type Severity,
  type Signal,
} from "~/components/admin-home/adminSignals";
import type { MetricIssue } from "~/components/system-metrics/metricRules";

const sig = (
  area: AreaKey,
  severity: Severity,
  key = `${area}-${severity}`,
): Signal => ({
  key,
  area,
  severity,
  message: "x",
  count: 1,
  subjects: [],
  more: 0,
  to: "/",
});

// A node that can host matches and has nothing wrong with it.
const node = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  label: id,
  status: "Online",
  enabled: true,
  enabled_for_match_making: true,
  region: "US-EAST",
  start_port_range: 30000,
  end_port_range: 30100,
  build_id: 100,
  plugin_supported: true,
  cpu_sockets: 1,
  cpu_cores_per_socket: 8,
  cpu_threads_per_core: 2,
  total_server_count: 4,
  disk_used_percent: 40,
  ...extra,
});

const context = { currentBuildId: 100 };
const nameOf = (n: { id: string; label?: string | null }) => n.label || n.id;

describe("sortSignals", () => {
  it("puts danger before warnings and notices last", () => {
    const sorted = sortSignals([
      sig("settings", "notice"),
      sig("renders", "warning"),
      sig("seasons", "danger"),
    ]);
    expect(sorted.map((s) => s.severity)).toEqual([
      "danger",
      "warning",
      "notice",
    ]);
  });

  it("breaks severity ties by the area that stops matches first", () => {
    const sorted = sortSignals([
      sig("renders", "warning"),
      sig("database", "warning"),
      sig("nodes", "warning"),
      sig("gpus", "warning"),
    ]);
    expect(sorted.map((s) => s.area)).toEqual([
      "nodes",
      "gpus",
      "database",
      "renders",
    ]);
  });

  it("keeps an area's own order within a severity", () => {
    const sorted = sortSignals([
      sig("nodes", "warning", "a"),
      sig("nodes", "warning", "b"),
      sig("nodes", "warning", "c"),
    ]);
    expect(sorted.map((s) => s.key)).toEqual(["a", "b", "c"]);
  });
});

describe("groupSignals", () => {
  it("is one list without headings up to the limit", () => {
    const list = sortSignals(
      Array.from({ length: GROUP_AFTER }, (_, i) =>
        sig("nodes", "warning", `n${i}`),
      ),
    );
    const groups = groupSignals(list);
    expect(groups).toHaveLength(1);
    expect(groups[0].area).toBeNull();
    expect(groups[0].signals).toHaveLength(GROUP_AFTER);
  });

  it("groups by area past the limit, worst area first", () => {
    const list = sortSignals([
      sig("renders", "warning", "r1"),
      sig("renders", "warning", "r2"),
      sig("renders", "warning", "r3"),
      sig("database", "danger", "d1"),
      sig("nodes", "warning", "n1"),
      sig("nodes", "warning", "n2"),
      sig("nodes", "danger", "n3"),
      sig("settings", "notice", "s1"),
      sig("alerts", "notice", "a1"),
    ]);
    const groups = groupSignals(list);
    expect(groups.map((g) => g.area)).toEqual([
      "nodes",
      "database",
      "renders",
      "alerts",
      "settings",
    ]);
    expect(groups.map((g) => g.worst)).toEqual([
      "danger",
      "danger",
      "warning",
      "notice",
      "notice",
    ]);
    // Inside a group the rows stay worst first.
    expect(groups[0].signals.map((s) => s.key)).toEqual(["n3", "n1", "n2"]);
  });

  it("is empty with nothing to show", () => {
    expect(groupSignals([])).toEqual([]);
  });
});

describe("needCount and areaTone", () => {
  const list = [
    sig("nodes", "danger"),
    sig("nodes", "warning", "w"),
    sig("alerts", "notice"),
  ];

  it("counts what needs you, not notices", () => {
    expect(needCount(list)).toBe(2);
    expect(needCount([sig("alerts", "notice")])).toBe(0);
  });

  it("takes an area's worst row", () => {
    expect(areaTone(list, "nodes")).toBe("bad");
    expect(areaTone([sig("gpus", "warning")], "gpus")).toBe("warn");
    expect(areaTone(list, "alerts")).toBe("ok");
    expect(areaTone(list, "database")).toBe("ok");
  });
});

describe("nodeSignals", () => {
  it("says nothing about a healthy fleet", () => {
    expect(nodeSignals([node("a"), node("b")], context, nameOf)).toEqual([]);
  });

  it("rolls one problem up across nodes, naming the first few", () => {
    const nodes = ["a", "b", "c", "d", "e"].map((id) =>
      node(id, { offline_at: "2026-10-17T10:00:00Z" }),
    );
    const [offline] = nodeSignals(nodes, context, nameOf);
    expect(offline.key).toBe("nodes:offline");
    expect(offline.severity).toBe("danger");
    expect(offline.count).toBe(5);
    expect(offline.subjects.map((s) => s.label)).toEqual(["a", "b", "c"]);
    expect(offline.more).toBe(2);
    expect(offline.to).toBe("/game-server-nodes");
  });

  it("links straight to the node when only one is hit", () => {
    const [only] = nodeSignals(
      [node("fra-01", { region: null })],
      context,
      nameOf,
    );
    expect(only.key).toBe("nodes:not_ready_region");
    expect(only.to).toBe(nodeLink("fra-01"));
    expect(only.subjects[0].to).toBe("/game-server-nodes?node=fra-01");
  });

  it("files a node that isn't ready under the first thing it lacks", () => {
    const keys = nodeSignals(
      [
        node("a", { region: null, build_id: null }),
        node("b", { start_port_range: null }),
        node("c", { build_id: null }),
      ],
      context,
      nameOf,
    ).map((s) => s.key);
    expect(keys).toEqual([
      "nodes:not_ready_region",
      "nodes:not_ready_ports",
      "nodes:not_ready_cs2",
    ]);
  });

  it("leaves an offline GPU-only node to the GPU area", () => {
    const gpuOnly = node("gpu-1", {
      gpu: true,
      enabled_for_match_making: false,
      offline_at: "2026-10-17T10:00:00Z",
    });
    expect(nodeSignals([gpuOnly], context, nameOf)).toEqual([]);
    const [offline] = gpuSignals({
      nodes: [gpuOnly],
      accounts: [{ username: "a" }],
      waiting: 0,
      nameOf,
    });
    expect(offline.key).toBe("gpus:offline");
    expect(offline.to).toBe("/gpu-nodes?node=gpu-1");
  });

  it("splits disks by how full they are, fullest first", () => {
    const signals = nodeSignals(
      [
        node("a", { disk_used_percent: 80 }),
        node("b", { disk_used_percent: 95 }),
        node("c", { disk_used_percent: 97 }),
      ],
      context,
      nameOf,
    );
    const full = signals.find((s) => s.key === "nodes:disk_full")!;
    const filling = signals.find((s) => s.key === "nodes:disk_filling")!;
    expect(full.severity).toBe("danger");
    expect(full.subjects.map((s) => `${s.label} ${s.detail}`)).toEqual([
      "c 97%",
      "b 95%",
    ]);
    expect(filling.severity).toBe("warning");
    expect(filling.count).toBe(1);
  });

  it("asks nothing of a node that is off or still setting up", () => {
    expect(
      nodeSignals(
        [
          node("a", { enabled: false, offline_at: "2026-10-17T10:00:00Z" }),
          node("b", { status: "Setup", region: null }),
        ],
        context,
        nameOf,
      ),
    ).toEqual([]);
  });
});

describe("gpuSignals", () => {
  const gpu = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    label: id,
    status: "Online",
    enabled: true,
    gpu: true,
    gpu_rendering_enabled: true,
    ...extra,
  });

  it("offers the fix in place when the Steam pool is empty", () => {
    const [empty] = gpuSignals({
      nodes: [gpu("g1")],
      accounts: [],
      waiting: 3,
      nameOf,
    });
    expect(empty.key).toBe("gpus:pool_empty");
    expect(empty.severity).toBe("danger");
    expect(empty.action).toBe("steam_accounts");
  });

  it("warns when the pool is short of one account per GPU", () => {
    const [short] = gpuSignals({
      nodes: [gpu("g1"), gpu("g2"), gpu("g3")],
      accounts: [{ username: "a" }],
      waiting: 0,
      nameOf,
    });
    expect(short.key).toBe("gpus:pool_short");
    expect(short.severity).toBe("warning");
    expect(short.count).toBe(2);
  });

  it("only calls waiting renders a problem when no GPU takes them", () => {
    const moving = gpuSignals({
      nodes: [gpu("g1")],
      accounts: [{ username: "a" }],
      waiting: 4,
      nameOf,
    });
    expect(moving).toEqual([]);

    const stuck = gpuSignals({
      nodes: [gpu("g1", { gpu_rendering_enabled: false })],
      accounts: [{ username: "a" }],
      waiting: 4,
      nameOf,
    });
    expect(stuck.map((s) => [s.key, s.count])).toEqual([
      ["gpus:renders_stuck", 4],
    ]);
  });

  it("opens the GPU's panel when one is hit, the page when several are", () => {
    const failed = { shader_bake_status: "errored" };
    const [one] = gpuSignals({
      nodes: [gpu("g1", failed), gpu("g2")],
      accounts: [{ username: "a" }, { username: "b" }],
      waiting: 0,
      nameOf,
    });
    expect(one.key).toBe("gpus:bake_failed");
    expect(one.to).toBe(gpuNodeLink("g1"));
    expect(one.subjects[0].to).toBe("/gpu-nodes?node=g1");

    const [both] = gpuSignals({
      nodes: [gpu("g1", failed), gpu("g2", failed)],
      accounts: [{ username: "a" }, { username: "b" }],
      waiting: 0,
      nameOf,
    });
    expect(both.count).toBe(2);
    expect(both.to).toBe("/gpu-nodes");
    expect(both.subjects.map((s) => s.to)).toEqual([
      "/gpu-nodes?node=g1",
      "/gpu-nodes?node=g2",
    ]);
  });

  it("says nothing without GPU nodes", () => {
    expect(gpuSignals({ nodes: [], accounts: [], waiting: 0, nameOf })).toEqual(
      [],
    );
  });
});

describe("metricSignals", () => {
  const issue = (extra: Partial<MetricIssue>): MetricIssue => ({
    key: "k",
    kind: "cpu",
    severity: "critical",
    nodeId: "n1",
    value: 95,
    threshold: 90,
    aboveForMs: null,
    spark: { points: [], from: 0, to: 0 },
    sparkMax: 100,
    refs: [],
    ...extra,
  });

  it("leaves CPU warnings and already-flagged disks to the nodes area", () => {
    const signals = metricSignals(
      [
        issue({ kind: "cpu_warning", severity: "warning" }),
        issue({ kind: "disk", nodeId: "n1" }),
        issue({ kind: "disk", nodeId: "n2", value: 92 }),
        issue({ kind: "memory", severity: "warning", threshold: 75 }),
      ],
      new Set(["n1"]),
      (id) => id,
    );
    expect(signals.map((s) => [s.key, s.severity, s.count])).toEqual([
      ["metrics:disk:danger", "danger", 1],
      ["metrics:memory:warning", "warning", 1],
    ]);
    expect(signals[0].to).toBe(metricsNodeLink("n2"));
    expect(signals[0].to).toBe("/system-metrics?node=n2");
    expect(signals[1].params).toEqual({ threshold: 75 });
  });

  it("sends one GPU to its panel and several nodes to the page", () => {
    const signals = metricSignals(
      [
        issue({ kind: "gpu_temp", severity: "warning", gpuIndex: 0 }),
        issue({ kind: "cpu", nodeId: "n1" }),
        issue({ kind: "cpu", nodeId: "n2" }),
      ],
      new Set(),
      (id) => id,
    );
    const temp = signals.find((s) => s.key === "metrics:gpu_temp:warning")!;
    expect(temp.to).toBe(gpuNodeLink("n1"));
    expect(temp.subjects[0].to).toBe("/gpu-nodes?node=n1");
    const cpu = signals.find((s) => s.key === "metrics:cpu:danger")!;
    expect(cpu.count).toBe(2);
    expect(cpu.to).toBe("/system-metrics");
    expect(cpu.subjects[0].to).toBe(nodeLink("n1"));
  });
});

describe("renderSignals", () => {
  const coverage = {
    version: 4,
    total: 100,
    current: 80,
    missing: 5,
    outdated: 15,
  };

  it("names failures, missing and outdated previews", () => {
    const keys = renderSignals({ failed: 2, coverage }).map((s) => s.key);
    expect(keys).toEqual([
      "renders:failed",
      "renders:missing",
      "renders:outdated",
    ]);
  });
});

describe("dbSignals", () => {
  it("calls lock waits and very slow statements critical", () => {
    const signals = dbSignals({
      queries: [
        {
          queryid: "1",
          query: "",
          calls: 10,
          mean_exec_time: 12_000,
          max_exec_time: 20_000,
          total_exec_time: 1,
        },
        {
          queryid: "2",
          query: "",
          calls: 10,
          mean_exec_time: 10,
          max_exec_time: 30,
          total_exec_time: 1,
        },
      ],
      active: [],
      locks: [
        { pid: 1, granted: true },
        { pid: 2, granted: false },
        { pid: 2, granted: false },
      ],
      threshold: 1000,
    });
    expect(signals.map((s) => [s.key, s.severity, s.count])).toEqual([
      ["database:locks", "danger", 1],
      ["database:slow", "danger", 1],
    ]);
    expect(signals[0].to).toBe("/database?tab=locks");
    expect(signals[1].to).toBe(queryLink("1"));
    expect(signals[1].to).toBe("/database?tab=queries&query=1");
  });

  it("opens slow-only for several slow statements and Connections for running ones", () => {
    const stat = (queryid: string) => ({
      queryid,
      query: "",
      calls: 10,
      mean_exec_time: 2_000,
      max_exec_time: 3_000,
      total_exec_time: 1,
    });
    const signals = dbSignals({
      queries: [stat("-42"), stat("7")],
      active: [
        { pid: 9, state: "active", duration_seconds: 5, query: "select 1" },
      ],
      locks: [],
      threshold: 1000,
    });
    expect(signals.map((s) => [s.key, s.to])).toEqual([
      ["database:running", "/database?tab=connections"],
      ["database:slow", "/database?tab=queries&slow=1"],
    ]);
    expect(queryLink("-42")).toBe("/database?tab=queries&query=-42");
  });
});

describe("alerts, settings, plugins and servers", () => {
  const now = Date.parse("2026-10-17T12:00:00Z");

  it("lists banners players see right now as a notice", () => {
    const [showing] = alertSignals(
      [
        { id: "a", title: "Maintenance tonight", is_active: true },
        {
          id: "b",
          title: "Old",
          is_active: true,
          expires_at: "2026-10-17T11:00:00Z",
        },
        { id: "c", title: "Off", is_active: false },
      ],
      now,
    );
    expect(showing.severity).toBe("notice");
    expect(showing.count).toBe(1);
    expect(showing.subjects[0].label).toBe("Maintenance tonight");
  });

  it("lists settings sections that aren't set up as a notice", () => {
    const [missing] = settingsSignals([
      {
        path: "/settings/application/twitch",
        label: "Twitch",
        attention: true,
      },
      { path: "/settings/application/chat", label: "Chat", attention: false },
    ]);
    expect(missing.severity).toBe("notice");
    expect(missing.to).toBe("/settings/application/twitch");
  });

  it("splits plugin trouble by what it needs", () => {
    const versions = [
      { runtime: "swiftlys2", version: "1.5.1", published_at: "2026-06-29" },
    ];
    const signals = pluginSignals(
      [
        { slug: "a", kind: "game", install_state: "Failed", versions },
        { slug: "b", kind: "game", install_state: "Installed", versions },
        { slug: "c", kind: "game", install_state: "Manual", versions },
        { slug: "d", kind: "game", install_state: "Installed", versions },
      ],
      [{ plugin_slug: "b", version: "1.5.0", channel: "Pinned" }],
      "swiftlys2",
    );
    expect(signals.map((s) => [s.key, s.severity])).toEqual([
      ["plugins:failed", "danger"],
      ["plugins:update", "warning"],
      ["plugins:manual", "notice"],
    ]);
    expect(signals[1].subjects[0].detail).toBe("1.5.0 → 1.5.1");
    expect(signals[0].to).toBe("/plugins/a");
  });

  it("sends several plugins with one problem to the attention tab", () => {
    const versions = [
      { runtime: "swiftlys2", version: "1.5.1", published_at: "2026-06-29" },
    ];
    const [failed] = pluginSignals(
      [
        { slug: "a", kind: "game", install_state: "Failed", versions },
        { slug: "b", kind: "game", install_state: "Failed", versions },
      ],
      [],
      "swiftlys2",
    );
    expect(failed.count).toBe(2);
    expect(failed.to).toBe("/plugins?tab=attention");
    expect(failed.subjects.map((s) => s.to)).toEqual([
      "/plugins/a",
      "/plugins/b",
    ]);
  });

  it("splits dedicated servers needing attention by reason", () => {
    const ctx = { currentPluginVersion: "1.8.3", pluginRuntime: "swiftlys2" };
    const signals = serverSignals(
      [
        {
          id: "s1",
          label: "One",
          enabled: true,
          connected: true,
          rcon_status: false,
        },
        {
          id: "s2",
          label: "Two",
          type: "Ranked",
          enabled: true,
          connected: true,
          rcon_status: true,
          plugin_version: "1.8.0",
        },
        { id: "s3", label: "Off", enabled: true, connected: false },
      ],
      ctx,
    );
    expect(signals.map((s) => [s.key, s.to])).toEqual([
      ["servers:no_rcon", "/dedicated-servers/s1"],
      ["servers:plugin_outdated", "/dedicated-servers/s2"],
    ]);
  });
});
