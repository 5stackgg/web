// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  cs2State,
  csgoState,
  diskLevel,
  diskSize,
  idRange,
  linkedNodeId,
  needsAttention,
  nextStep,
  nodeAttention,
  portsError,
  readinessNeeds,
  serversFit,
  updateProgress,
  updateStep,
  warningInfo,
} from "~/components/game-server-nodes/nodeInspector";
import type { NodeLike } from "~/components/game-server-nodes/nodeState";

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
  disk_available_gb: 700,
  ...fields,
});

const disk = { warning: 75, critical: 90 };
const keys = (items: Array<{ key: string }>) => items.map((item) => item.key);

describe("next step", () => {
  it("walks a fresh node through region, ports, then CS2", () => {
    const fresh = node({
      region: null,
      start_port_range: null,
      end_port_range: null,
      build_id: null,
    });
    expect(nextStep(fresh)).toBe("assign_region");
    expect(nextStep({ ...fresh, region: "eu" })).toBe("set_ports");
    expect(nextStep(node({ build_id: null }))).toBe("install_cs2");
  });

  it("offers nothing while in setup or offline, and Enable when switched off", () => {
    expect(nextStep(node({ status: "Setup" }))).toBeNull();
    expect(nextStep(node({ offline_at: "2026-10-16T10:00:00Z" }))).toBeNull();
    expect(nextStep(node({ enabled: false, region: null }))).toBe("enable");
  });

  it("retries a failed update before anything else, updates a node behind", () => {
    expect(
      nextStep(
        node({ update_failed_at: "2026-10-16T10:00:00Z", region: null }),
      ),
    ).toBe("retry_update");
    expect(nextStep(node(), { currentBuildId: 120 })).toBe("update_cs2");
    expect(
      nextStep(node({ update_status: "downloading 10%" }), {
        currentBuildId: 120,
      }),
    ).toBeNull();
  });

  it("changes an unsupported plugin, then edits overprovisioned ports", () => {
    expect(nextStep(node({ plugin_supported: false }))).toBe("change_plugin");
    expect(nextStep(node({ total_server_count: 12 }))).toBe("edit_ports");
  });

  it("opens the files when the disk is past the critical threshold", () => {
    expect(
      nextStep(node({ disk_used_percent: 91 }), { diskThresholds: disk }),
    ).toBe("open_files");
    expect(
      nextStep(node({ disk_used_percent: 80 }), { diskThresholds: disk }),
    ).toBeNull();
    expect(
      nextStep(node({ disk_used_percent: 60 }), {
        diskThresholds: { warning: 50, critical: 60 },
      }),
    ).toBe("open_files");
  });

  it("never asks a GPU-only node for a region or ports", () => {
    expect(
      nextStep(
        node({
          gpu: true,
          enabled_for_match_making: false,
          region: null,
          start_port_range: null,
          end_port_range: null,
        }),
      ),
    ).toBeNull();
  });

  // Each lineup preview a GPU-only node renders boots a CS2 server on it, and
  // a fresh one otherwise only gets CS2 when a CS2 update ships.
  it("installs and updates CS2 on a GPU-only node that renders", () => {
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

    expect(nextStep(gpuOnly({ build_id: null }))).toBe("install_cs2");
    expect(nextStep(gpuOnly(), { currentBuildId: 120 })).toBe("update_cs2");
    expect(
      nextStep(gpuOnly({ update_failed_at: "2026-10-16T10:00:00Z" }), {
        currentBuildId: 120,
      }),
    ).toBe("retry_update");
    expect(nextStep(gpuOnly({ plugin_supported: false }))).toBeNull();
    expect(
      nextStep(gpuOnly({ build_id: null, gpu_rendering_enabled: false })),
    ).toBeNull();
    expect(cs2State(gpuOnly({ build_id: null }))).toBe("missing");
    expect(cs2State(gpuOnly({ gpu_rendering_enabled: false }))).toBe("none");
  });
});

describe("attention list", () => {
  it("folds a missing region, ports and CS2 into one item", () => {
    const items = nodeAttention(
      node({
        region: null,
        start_port_range: null,
        end_port_range: null,
        build_id: null,
      }),
    );
    expect(keys(items)).toEqual(["not_ready"]);
    expect(items[0].params?.needs).toEqual(["region", "ports", "cs2"]);
    expect(readinessNeeds(node({ start_port_range: null }))).toEqual(["ports"]);
  });

  it("asks a node out of matchmaking only for CS2", () => {
    const items = nodeAttention(
      node({
        enabled_for_match_making: false,
        region: null,
        start_port_range: null,
        end_port_range: null,
        build_id: null,
      }),
    );
    expect(keys(items)).toEqual(["not_ready"]);
    expect(items[0].params?.needs).toEqual(["cs2"]);
    expect(
      nextStep(node({ enabled_for_match_making: false, region: null })),
    ).toBeNull();
  });

  it("puts the worst first and keeps the order within a tone", () => {
    const items = nodeAttention(
      node({
        cpu_warnings: ["SMT is off"],
        plugin_supported: false,
        disk_used_percent: 80,
        gpu: true,
        gpu_streaming_enabled: true,
        gpu_demos_enabled: false,
        gpu_rendering_enabled: true,
      }),
      { currentBuildId: 120, diskThresholds: disk },
    );
    expect(items.map((item) => [item.key, item.tone])).toEqual([
      ["plugin_unsupported", "bad"],
      ["update_available", "warn"],
      ["disk", "warn"],
      ["cpu_warning", "warn"],
      ["workloads", "info"],
    ]);
    expect(items.at(-1)?.params?.off).toEqual(["demos"]);
  });

  it("reads the disk tone from the configured thresholds", () => {
    const [item] = nodeAttention(node({ disk_used_percent: 92 }), {
      diskThresholds: disk,
    });
    expect([item.key, item.tone]).toEqual(["disk", "bad"]);
    expect(
      nodeAttention(node({ disk_used_percent: 80 }), {
        diskThresholds: { warning: 85, critical: 95 },
      }),
    ).toEqual([]);
  });

  it("only waits on a node in setup and asks nothing of a disabled one", () => {
    expect(nodeAttention(node({ status: "Setup" }))).toEqual([
      { key: "setup", tone: "info" },
    ]);
    expect(nodeAttention(node({ enabled: false, region: null }))).toEqual([]);
    expect(
      keys(nodeAttention(node({ offline_at: "2026-10-16T10:00:00Z" }))),
    ).toEqual(["offline"]);
  });

  it("counts a node as needing attention only for warnings and worse", () => {
    expect(needsAttention(node({ status: "Setup" }))).toBe(false);
    expect(
      needsAttention(
        node({
          gpu: true,
          gpu_streaming_enabled: false,
          gpu_demos_enabled: true,
        }),
      ),
    ).toBe(false);
    expect(needsAttention(node({ build_id: null }))).toBe(true);
  });

  it("calls a powersave governor bad and any other a warning", () => {
    expect(
      nodeAttention(node({ cpu_governor_info: { governor: "powersave" } }))[0]
        .tone,
    ).toBe("bad");
    expect(
      nodeAttention(node({ cpu_governor_info: { governor: "ondemand" } }))[0]
        .tone,
    ).toBe("warn");
  });
});

describe("CS2 state", () => {
  it("reads updating, missing, failed, behind, pinned and current", () => {
    expect(cs2State(node({ update_status: "downloading 3%" }), 120)).toBe(
      "updating",
    );
    expect(cs2State(node({ build_id: null }), 120)).toBe("missing");
    expect(
      cs2State(node({ update_failed_at: "2026-10-16T10:00:00Z" }), 120),
    ).toBe("failed");
    expect(cs2State(node(), 120)).toBe("behind");
    expect(cs2State(node({ pin_build_id: 100 }), 120)).toBe("pinned");
    expect(cs2State(node(), 100)).toBe("current");
    expect(cs2State(node({ status: "Setup" }), 100)).toBe("none");
  });

  it("reads a trailing percentage from the update status", () => {
    expect(updateProgress("downloading 40%")).toBe(40);
    expect(updateProgress("verifying install")).toBeNull();
    expect(updateProgress(null)).toBeNull();
  });

  it("reads the step without its percentage", () => {
    expect(updateStep("Downloading depot 2/3 41%")).toBe(
      "Downloading depot 2/3",
    );
    expect(updateStep("verifying install 49.5%")).toBe("Verifying install");
    expect(updateStep("Initializing")).toBe("Initializing");
    expect(updateStep(null)).toBe("");
  });
});

describe("CS:GO state", () => {
  it("stays hidden until CS:GO is installed or being installed", () => {
    expect(csgoState(node(), 12426148)).toBe("none");
    expect(csgoState(node({ csgo_update_status: "Initializing" }), null)).toBe(
      "updating",
    );
    expect(
      csgoState(node({ csgo_update_failed_at: "2026-10-18T10:00:00Z" }), null),
    ).toBe("failed");
  });

  it("compares the installed build with the latest one", () => {
    expect(csgoState(node({ csgo_build_id: 12426148 }), 12426148)).toBe(
      "current",
    );
    expect(csgoState(node({ csgo_build_id: 12426148 }), "12430215")).toBe(
      "behind",
    );
    expect(csgoState(node({ csgo_build_id: 12426148 }), null)).toBe(
      "installed",
    );
  });

  it("reads CS2's update as CS2's only", () => {
    expect(
      csgoState(
        node({ csgo_build_id: 12426148, update_status: "downloading 3%" }),
        12426148,
      ),
    ).toBe("current");
  });
});

describe("disk", () => {
  it("works out the size from the fill and the free space", () => {
    expect(
      diskSize(node({ disk_used_percent: 75, disk_available_gb: 250 })),
    ).toEqual({ percent: 75, freeGb: 250, totalGb: 1000, usedGb: 750 });
    expect(diskSize(node({ disk_used_percent: null }))).toBeNull();
    expect(
      diskSize(node({ disk_used_percent: 100, disk_available_gb: 0 }))?.totalGb,
    ).toBeNull();
  });

  it("levels the fill against the thresholds", () => {
    expect(diskLevel(74, disk)).toBeNull();
    expect(diskLevel(75, disk)).toBe("warn");
    expect(diskLevel(90, disk)).toBe("bad");
    expect(diskLevel(null, disk)).toBeNull();
  });
});

describe("ports", () => {
  it("checks the range and the order, and counts two ports a server", () => {
    expect(portsError(30000, 30017)).toBeNull();
    expect(portsError(29999, 30017)).toBe("range");
    expect(portsError(30000, 40000)).toBe("range");
    expect(portsError(30000, 30001)).toBe("order");
    expect(portsError(null, 30010)).toBe("range");
    expect(serversFit(30000, 30017)).toBe(9);
  });
});

describe("node warnings", () => {
  it("names the known warnings and lifts the docs URL out", () => {
    const kernel = warningInfo(
      'This node runs Ubuntu\'s legacy "lowlatency" kernel, which Ubuntu no longer builds. Switch to the generic kernel booted with preempt=full: https://docs.5stack.gg/servers/low-latency-kernel',
    );
    expect(kernel.kind).toBe("lowlatency");
    expect(kernel.url).toBe(
      "https://docs.5stack.gg/servers/low-latency-kernel",
    );
    expect(kernel.body).toBe(
      'This node runs Ubuntu\'s legacy "lowlatency" kernel, which Ubuntu no longer builds. Switch to the generic kernel booted with preempt=full.',
    );

    const constrained = warningInfo(
      'Game server "fra-02-3" is CPU-constrained: using 97% of its CPU quota.',
    );
    expect(constrained).toMatchObject({
      kind: "constrained",
      subject: "fra-02-3",
      url: null,
    });

    expect(
      warningInfo(
        'CPU pinning is enabled but the scaling governor is "powersave". Pinned game-server cores may downclock.',
      ),
    ).toMatchObject({ kind: "governor", subject: "powersave" });
  });

  it("titles anything else by its first sentence", () => {
    expect(warningInfo("SMT is off. Enable it in the BIOS.")).toMatchObject({
      kind: "other",
      title: "SMT is off",
      body: "SMT is off. Enable it in the BIOS.",
    });
    expect(warningInfo("x".repeat(80)).title).toHaveLength(62);
  });
});

describe("picking", () => {
  const ids = ["a", "b", "c", "d"];

  it("takes a Shift-click range in either direction", () => {
    expect(idRange(ids, "b", "d")).toEqual(["b", "c", "d"]);
    expect(idRange(ids, "d", "b")).toEqual(["b", "c", "d"]);
    expect(idRange(ids, "gone", "c")).toEqual(["c"]);
  });

  it("follows a deep link only to a node that exists", () => {
    const nodes = ids.map((id) => ({ id }));
    expect(linkedNodeId("c", nodes)).toBe("c");
    expect(linkedNodeId(["b", "c"], nodes)).toBe("b");
    expect(linkedNodeId("zzz", nodes)).toBeNull();
    expect(linkedNodeId(undefined, nodes)).toBeNull();
  });
});
