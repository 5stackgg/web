import { describe, expect, it } from "vitest";
import {
  canUpdateCs,
  cpuTone,
  diskTone,
  filterNodes,
  fleetSummary,
  isBuildBehind,
  matchesNodeSearch,
  maxServers,
  nodeIssues,
  nodeSettings,
  nodeStatus,
  type NodeFilters,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";

const node = (fields: Partial<NodeLike> = {}): NodeLike => ({
  id: "e4b1c7d2-5f3a-4e8b-a6c9-0d2f8b3e7a51",
  label: "fra-01",
  status: "Online",
  enabled: true,
  enabled_for_match_making: true,
  region: "eu",
  build_id: 100,
  plugin_supported: true,
  start_port_range: 30000,
  end_port_range: 30020,
  cpu_sockets: 1,
  cpu_cores_per_socket: 4,
  cpu_threads_per_core: 2,
  cpu_frequency_info: { frequency: 4.5 },
  cpu_governor_info: { governor: "performance" },
  total_server_count: 5,
  available_server_count: 4,
  disk_used_percent: 30,
  ...fields,
});

const filters = (fields: Partial<NodeFilters> = {}): NodeFilters => ({
  query: "",
  regions: [],
  onlyEnabled: false,
  hideOffline: false,
  sort: "asc",
  ...fields,
});

describe("node status", () => {
  it("reads setup, offline and disabled before the live status", () => {
    expect(nodeStatus(node({ status: "Setup", enabled: false }))).toBe("setup");
    expect(nodeStatus(node({ offline_at: "2026-10-16T10:00:00Z" }))).toBe(
      "offline",
    );
    expect(nodeStatus(node({ status: "Offline" }))).toBe("offline");
    expect(nodeStatus(node({ enabled: false }))).toBe("disabled");
    expect(nodeStatus(node({ status: "NotAcceptingNewMatches" }))).toBe(
      "not_accepting",
    );
    expect(nodeStatus(node())).toBe("online");
  });
});

describe("node thresholds", () => {
  it("warns under 3 GHz before it warns about the governor", () => {
    expect(
      cpuTone(
        node({
          cpu_frequency_info: { frequency: 2.4 },
          cpu_governor_info: { governor: "powersave" },
        }),
      ),
    ).toBe("bad");
    expect(cpuTone(node({ cpu_governor_info: { governor: "ondemand" } }))).toBe(
      "warn",
    );
    expect(cpuTone(node())).toBeNull();
  });

  it("colours the disk from the configured thresholds", () => {
    const { disk } = nodeSettings([
      { name: "disk_warning_percent", value: "60" },
      { name: "disk_critical_percent", value: "80" },
    ]);
    expect(diskTone(59, disk)).toBe("ok");
    expect(diskTone(60, disk)).toBe("warn");
    expect(diskTone(80, disk)).toBe("bad");
    expect(diskTone(null, disk)).toBeNull();
    expect(diskTone(75)).toBe("warn");
  });

  it("keeps a core for the system and splits the rest under CPU pinning", () => {
    expect(maxServers(node())).toBe(7);
    expect(
      maxServers(node({ supports_cpu_pinning: true }), {
        enabled: true,
        cpusPerServer: 2,
      }),
    ).toBe(3);
  });
});

describe("CS2 builds", () => {
  it("compares a pinned node with its pin and the rest with the current build", () => {
    expect(isBuildBehind(node({ pin_build_id: 90 }), 100)).toBe(true);
    expect(isBuildBehind(node({ pin_build_id: 100 }), 120)).toBe(false);
    expect(isBuildBehind(node(), 120)).toBe(true);
    expect(isBuildBehind(node(), null)).toBe(false);
  });

  it("only updates nodes that are up, idle, hosting and behind or empty", () => {
    expect(canUpdateCs(node(), 120)).toBe(true);
    expect(canUpdateCs(node({ build_id: null }), 120)).toBe(true);
    expect(canUpdateCs(node(), 100)).toBe(false);
    expect(canUpdateCs(node({ status: "Offline" }), 120)).toBe(false);
    expect(canUpdateCs(node({ update_status: "downloading 40%" }), 120)).toBe(
      false,
    );
    expect(
      canUpdateCs(node({ gpu: true, enabled_for_match_making: false }), 120),
    ).toBe(false);
  });

  // Each lineup preview a GPU-only node renders boots a CS2 server on it.
  it("updates a GPU-only node that renders lineup previews", () => {
    const gpuOnly = (fields: Partial<NodeLike> = {}) =>
      node({
        gpu: true,
        enabled_for_match_making: false,
        region: null,
        start_port_range: null,
        end_port_range: null,
        gpu_rendering_enabled: true,
        ...fields,
      });

    expect(canUpdateCs(gpuOnly({ build_id: null }), 120)).toBe(true);
    expect(canUpdateCs(gpuOnly(), 120)).toBe(true);
    expect(canUpdateCs(gpuOnly(), 100)).toBe(false);
    expect(canUpdateCs(gpuOnly({ gpu_rendering_enabled: false }), 120)).toBe(
      false,
    );
  });
});

describe("attention", () => {
  it("asks nothing of a node in setup or switched off", () => {
    expect(nodeIssues(node({ status: "Setup", region: null }))).toEqual([]);
    expect(nodeIssues(node({ enabled: false, region: null }))).toEqual([]);
  });

  it("reports an offline node as offline only", () => {
    expect(
      nodeIssues(node({ offline_at: "2026-10-16T10:00:00Z", region: null })),
    ).toEqual(["offline"]);
  });

  it("collects what a running node needs", () => {
    expect(
      nodeIssues(
        node({
          region: null,
          total_server_count: 12,
          plugin_supported: false,
          cpu_warnings: ["SMT is off"],
          disk_used_percent: 91,
        }),
        { currentBuildId: 120 },
      ),
    ).toEqual([
      "overprovisioned",
      "plugin_unsupported",
      "no_region",
      "update_available",
      "disk",
      "cpu_warnings",
    ]);
    expect(nodeIssues(node(), { currentBuildId: 100 })).toEqual([]);
  });

  it("asks for CS2 on a hosting node without it, unless it is installing", () => {
    expect(nodeIssues(node({ build_id: null }))).toEqual(["no_cs2"]);
    expect(
      nodeIssues(node({ build_id: null, update_status: "downloading 5%" })),
    ).toEqual([]);
  });

  it("sums the fleet: online, free of total where matches land, attention", () => {
    const summary = fleetSummary(
      [
        node(),
        node({ id: "b", available_server_count: 2, total_server_count: 3 }),
        node({ id: "c", offline_at: "2026-10-16T10:00:00Z" }),
        node({ id: "d", gpu: true, enabled_for_match_making: false }),
        node({ id: "e", update_status: "verifying 20%" }),
      ],
      { currentBuildId: 100 },
    );

    expect(summary).toEqual({
      total: 5,
      online: 4,
      free: 10,
      capacity: 13,
      attention: 1,
      updating: 1,
    });
  });
});

describe("filtering", () => {
  const nodes = [
    node({ id: "aaaa1111-0000", label: "zeta", region: "us" }),
    node({ id: "bbbb2222-0000", label: null, region: "eu" }),
    node({ id: "cccc3333-0000", label: "alpha", enabled: false }),
    node({
      id: "dddd4444-0000",
      label: "Beta",
      offline_at: "2026-10-16T10:00:00Z",
    }),
  ];
  const ids = (list: Array<NodeLike>) => list.map((item) => item.id);

  it("searches the label, the node id and the addresses", () => {
    expect(matchesNodeSearch(nodes[0], "ZET")).toBe(true);
    expect(
      matchesNodeSearch(
        node({ lan_ip: "10.50.0.5", public_ip: null }),
        "10.50",
      ),
    ).toBe(true);
    expect(matchesNodeSearch(nodes[1], "bbbb22")).toBe(true);
    expect(matchesNodeSearch(nodes[0], "bbbb")).toBe(false);
    expect(matchesNodeSearch(nodes[0], "  ")).toBe(true);
  });

  it("sorts by label with unlabelled nodes last, and reverses for desc", () => {
    expect(ids(filterNodes(nodes, filters()))).toEqual([
      "cccc3333-0000",
      "dddd4444-0000",
      "aaaa1111-0000",
      "bbbb2222-0000",
    ]);
    expect(ids(filterNodes(nodes, filters({ sort: "desc" }))).at(0)).toBe(
      "bbbb2222-0000",
    );
  });

  it("narrows by region, enabled and online", () => {
    expect(ids(filterNodes(nodes, filters({ regions: ["us"] })))).toEqual([
      "aaaa1111-0000",
    ]);
    expect(
      ids(
        filterNodes(nodes, filters({ onlyEnabled: true, hideOffline: true })),
      ),
    ).toEqual(["aaaa1111-0000", "bbbb2222-0000"]);
  });
});
