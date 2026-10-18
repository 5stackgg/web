// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  aboveFor,
  collectIssues,
  cpuPercent,
  fleetSummary,
  level,
  logTabFor,
  memoryShareLevel,
  nodeDisk,
  nodeIssues,
  serviceCpuSpark,
  serviceSeverity,
  shortNodeId,
  sparkOf,
  toneOf,
  warnedServer,
  type MetricsNode,
  type NodeStats,
} from "~/components/system-metrics/metricRules";

const T0 = Date.parse("2026-10-16T14:00:00Z");
const at = (i: number) => new Date(T0 + i * 30_000).toISOString();
const series = <T>(n: number, make: (i: number) => T) =>
  Array.from({ length: n }, (_, i) => make(i));

// 16 cores; `pct` of them busy, in nanocores.
const cpu = (pcts: number[]) =>
  pcts.map((pct, i) => ({
    time: at(i),
    total: 16,
    used: (pct / 100) * 16 * 1_000_000_000,
  }));

const node = (o: Partial<MetricsNode> = {}): MetricsNode => ({
  id: "chi-03",
  label: null,
  enabled: true,
  offline_at: null,
  gpu: false,
  gpu_info: [],
  cpu_warnings: [],
  ...o,
});

describe("level", () => {
  it("warns from 75 and is critical from 90", () => {
    expect(level(74.9)).toBeNull();
    expect(level(75)).toBe("warning");
    expect(level(89.9)).toBe("warning");
    expect(level(90)).toBe("critical");
    expect(level(null)).toBeNull();
  });
});

describe("cpuPercent", () => {
  it("reads nanocores against the core count and clamps", () => {
    expect(cpuPercent({ time: at(0), total: 4, used: 2_000_000_000 })).toBe(50);
    expect(cpuPercent({ time: at(0), total: 4, used: 9_000_000_000 })).toBe(
      100,
    );
    expect(cpuPercent({ time: at(0), total: 0, used: 1 })).toBeNull();
  });
});

describe("aboveFor", () => {
  it("measures the trailing run only", () => {
    const pts = [40, 95, 50, 92, 93, 94].map((v, i) => ({
      t: T0 + i * 30_000,
      v,
    }));
    expect(aboveFor(pts, 90)).toBe(60_000);
    expect(aboveFor(pts.slice(0, 3), 90)).toBeNull();
  });
});

describe("nodeIssues", () => {
  it("never lists an offline node", () => {
    const stats: NodeStats = { cpu: cpu([99, 99]) };
    expect(
      nodeIssues(node({ offline_at: "2026-10-16T13:00:00Z" }), stats),
    ).toEqual([]);
  });

  it("raises cpu, memory and the fullest disk at their own severity", () => {
    const stats: NodeStats = {
      cpu: cpu([20, 80, 81]),
      memory: [
        { time: at(0), used: 29, total: 31.3 },
        { time: at(1), used: 29.4, total: 31.3 },
      ],
      disks: [
        {
          time: at(1),
          disks: [
            { mountpoint: "/", size: 476, used: 98, usedPercent: 20.6 },
            { mountpoint: "/demos", size: 912, used: 740, usedPercent: 81.1 },
          ],
        },
      ],
    };
    const issues = nodeIssues(node(), stats);
    const by = Object.fromEntries(issues.map((i) => [i.kind, i]));
    expect(by.cpu.severity).toBe("warning");
    expect(by.cpu.threshold).toBe(75);
    expect(by.cpu.aboveForMs).toBe(30_000);
    expect(by.cpu.cores).toBe(16);
    expect(by.memory.severity).toBe("critical");
    expect(by.disk.severity).toBe("warning");
    expect(by.disk.mount).toBe("/demos");
  });

  it("only calls GPU usage a problem once it has held for five minutes", () => {
    const gpu = (n: number) => ({
      gpu: series(n, (i) => ({
        time: at(i),
        devices: [
          {
            index: 0,
            name: "NVIDIA GeForce RTX 5060",
            memory_mb: 8151,
            memory_used_mb: 1800,
            temperature_c: 70,
            utilization_percent: 97,
          },
        ],
      })),
    });
    // 10 samples = 4.5 minutes, 11 = 5 minutes.
    expect(nodeIssues(node(), gpu(10))).toEqual([]);
    const [issue] = nodeIssues(node(), gpu(11));
    expect(issue.kind).toBe("gpu_util");
    expect(issue.severity).toBe("critical");
    expect(issue.gpuIndex).toBe(0);
  });

  it("flags VRAM at 90% and temperature at 85 °C", () => {
    const stats: NodeStats = {
      gpu: [
        {
          time: at(0),
          devices: [
            {
              index: 0,
              name: "RTX 4070",
              memory_mb: 12282,
              memory_used_mb: 11545,
              temperature_c: 86,
              utilization_percent: 38,
            },
          ],
        },
      ],
    };
    const kinds = nodeIssues(node(), stats).map((i) => [i.kind, i.severity]);
    expect(kinds).toEqual([
      ["gpu_vram", "critical"],
      ["gpu_temp", "warning"],
    ]);
  });

  it("turns each cpu warning into a warning row, even before stats arrive", () => {
    const issues = nodeIssues(
      node({
        cpu_warnings: [
          'Game server "dedicated-server-7c1e" is CPU-constrained',
        ],
      }),
      null,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("cpu_warning");
    expect(warnedServer(issues[0].warning)).toBe("dedicated-server-7c1e");
  });
});

describe("collectIssues + fleetSummary", () => {
  it("puts critical first and counts nodes and GPUs once", () => {
    const nodes = [
      node({ id: "a", label: "Alpha" }),
      node({ id: "b", label: "Bravo", gpu: true, gpu_info: [{ index: 0 }] }),
      node({
        id: "c",
        offline_at: "2026-10-16T12:00:00Z",
        gpu: true,
        gpu_info: [{ index: 0 }],
      }),
      node({ id: "d" }),
    ];
    const stats: Record<string, NodeStats> = {
      a: { cpu: cpu([80]) },
      b: {
        cpu: cpu([95]),
        gpu: [
          {
            time: at(0),
            devices: [{ index: 0, memory_mb: 100, memory_used_mb: 95 }],
          },
        ],
      },
      d: { cpu: cpu([10]) },
    };
    const issues = collectIssues(nodes, stats);
    expect(issues.map((i) => i.severity)).toEqual([
      "critical",
      "critical",
      "warning",
    ]);
    expect(fleetSummary(nodes, stats, issues)).toEqual({
      total: 4,
      online: 3,
      offline: 1,
      fine: 1,
      attention: 2,
      gpuTotal: 2,
      gpuOnline: 1,
      gpuOffline: 1,
      gpuFine: 0,
    });
  });
});

describe("services", () => {
  it("is critical when one service holds half its node's memory", () => {
    expect(
      serviceSeverity({
        node: "a",
        name: "demo-parser",
        cpu: cpu([5]),
        memory: [{ time: at(0), used: 60, total: 100 }],
      }),
    ).toBe("critical");
    expect(
      serviceSeverity({
        node: "a",
        name: "api",
        cpu: cpu([5]),
        memory: [{ time: at(0), used: 10, total: 100 }],
      }),
    ).toBeNull();
  });

  it("hands connector logs to the Logs page's game-server-node tab", () => {
    expect(logTabFor("game-server-node-connector-nvidia")).toBe(
      "game-server-node",
    );
    expect(logTabFor("timescaledb")).toBe("timescaledb");
    expect(logTabFor("dedicated-server-7c1e")).toBeNull();
  });
});

describe("sparks", () => {
  it("keeps the last 30 minutes by time, ending at the newest sample", () => {
    // 40 minutes of samples with a 5-minute hole near the end.
    const pts = series(81, (i) => ({ t: T0 + i * 30_000, v: i })).filter(
      (p) => p.v < 60 || p.v > 70,
    );
    const spark = sparkOf(pts);
    expect(spark.to).toBe(T0 + 80 * 30_000);
    expect(spark.from).toBe(spark.to - 30 * 60_000);
    expect(spark.points[0].t).toBe(spark.from);
    // The hole stays a hole: no point is invented for it.
    expect(spark.points.some((p) => p.v === 65)).toBe(false);
  });

  it("orders a service's samples by time", () => {
    const spark = serviceCpuSpark({
      node: "a",
      name: "api",
      cpu: [...cpu([10, 20, 30])].reverse(),
    });
    expect(spark.points.map((p) => Math.round(p.v ?? 0))).toEqual([10, 20, 30]);
  });
});

describe("services table cells", () => {
  it("reads the node's fullest disk from its newest sample, in bytes", () => {
    const disk = nodeDisk({
      disks: [
        {
          time: at(0),
          disks: [{ mountpoint: "/", size: 100, used: 99, usedPercent: 99 }],
        },
        {
          time: at(1),
          disks: [
            { mountpoint: "/", size: 476, used: 98, usedPercent: 20.6 },
            { mountpoint: "/demos", size: 1000, used: 800, usedPercent: 80 },
          ],
        },
      ],
    });
    expect(disk).toEqual({
      pct: 80,
      mount: "/demos",
      usedBytes: 800 * 1024,
      totalBytes: 1000 * 1024,
    });
    expect(nodeDisk(null)).toBeNull();
    expect(nodeDisk({ disks: [] })).toBeNull();
  });

  it("tones meters with the page's thresholds", () => {
    expect(toneOf(level(74))).toBe("ok");
    expect(toneOf(level(75))).toBe("warn");
    expect(toneOf(level(90))).toBe("bad");
    expect(toneOf(memoryShareLevel(49.9))).toBe("ok");
    expect(toneOf(memoryShareLevel(50))).toBe("bad");
  });

  it("shortens a UUID node id but keeps a host name whole", () => {
    expect(shortNodeId("7c1e2a90-5b1f-4d2e-9a0c-3f5e6d7c8b9a")).toBe(
      "7c1e2a90",
    );
    expect(shortNodeId("5stack-panel")).toBe("5stack-panel");
  });
});
