// What System Metrics calls a problem, kept out of the components so the
// thresholds live in one place and can be tested without mounting anything.
//
// Node and GPU samples come from getNodeStats (one Redis list per metric, a
// sample about every 30 s, 90 minutes kept); service samples from
// getServiceStats. Node CPU `used` is nanocores and `total` the core count,
// disk sizes are KB, memory is bytes.

export const WARN = 75;
export const CRIT = 90;
export const GPU_UTIL_CRIT = 90;
export const GPU_UTIL_SUSTAIN_MS = 5 * 60_000;
export const GPU_VRAM_CRIT = 90;
export const GPU_TEMP_WARN = 85;
export const SERVICE_MEMORY_SHARE_CRIT = 50;
export const SPARK_WINDOW_MS = 30 * 60_000;

export type Severity = "critical" | "warning";

export type CpuSample = {
  time: string;
  used?: number | string | null;
  total?: number | string | null;
};
export type MemorySample = {
  time: string;
  used?: number | string | null;
  total?: number | string | null;
};
export type DiskEntry = {
  mountpoint?: string | null;
  filesystem?: string | null;
  size?: number | string | null;
  used?: number | string | null;
  usedPercent?: number | string | null;
};
export type DiskSample = { time: string; disks?: DiskEntry[] | null };
export type GpuDevice = {
  index?: number | null;
  name?: string | null;
  memory_mb?: number | null;
  memory_used_mb?: number | null;
  temperature_c?: number | null;
  power_w?: number | null;
  utilization_percent?: number | null;
};
export type GpuSample = { time: string; devices?: GpuDevice[] | null };

export type NodeStats = {
  cpu?: CpuSample[] | null;
  memory?: MemorySample[] | null;
  disks?: DiskSample[] | null;
  gpu?: GpuSample[] | null;
};

export type MetricsNode = {
  id: string;
  label?: string | null;
  region?: string | null;
  enabled?: boolean | null;
  offline_at?: string | null;
  gpu?: boolean | null;
  gpu_info?: Array<{
    index?: number;
    name?: string;
    memory_mb?: number;
  }> | null;
  cpu_warnings?: string[] | null;
};

export type ServiceStat = {
  node: string;
  name: string;
  cpu?: CpuSample[] | null;
  memory?: MemorySample[] | null;
};

export type IssueKind =
  | "cpu"
  | "memory"
  | "disk"
  | "cpu_warning"
  | "gpu_util"
  | "gpu_vram"
  | "gpu_temp";

export type MetricIssue = {
  key: string;
  kind: IssueKind;
  severity: Severity;
  nodeId: string;
  gpuIndex?: number;
  gpuName?: string;
  // Percent, or °C for gpu_temp. Null for a cpu_warning row.
  value: number | null;
  threshold: number | null;
  // How long the metric has been over its threshold, trailing samples only.
  aboveForMs: number | null;
  cores?: number | null;
  usedBytes?: number | null;
  totalBytes?: number | null;
  mount?: string | null;
  temperature?: number | null;
  power?: number | null;
  utilization?: number | null;
  warning?: string;
  // The last 30 minutes of the metric the row is about, by time.
  spark: Spark;
  sparkMax: number | null;
  refs: Array<{ value: number; severity: Severity }>;
};

const num = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

const clampPct = (value: number) => Math.min(100, Math.max(0, value));

export function level(value: number | null | undefined): Severity | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  if (value >= CRIT) {
    return "critical";
  }
  if (value >= WARN) {
    return "warning";
  }
  return null;
}

const RANK: Record<Severity, number> = { warning: 1, critical: 2 };

export function worse(a: Severity | null, b: Severity | null): Severity | null {
  if (!a) return b;
  if (!b) return a;
  return RANK[b] > RANK[a] ? b : a;
}

export function cpuPercent(sample?: CpuSample | null): number | null {
  const used = num(sample?.used);
  const total = num(sample?.total);
  if (used == null || !total) {
    return null;
  }
  return clampPct((used / 1_000_000_000 / total) * 100);
}

export function memoryPercent(sample?: MemorySample | null): number | null {
  const used = num(sample?.used);
  const total = num(sample?.total);
  if (used == null || !total) {
    return null;
  }
  return clampPct((used / total) * 100);
}

export function diskPercent(disk?: DiskEntry | null): number | null {
  if (!disk) {
    return null;
  }
  const pct = num(disk.usedPercent);
  if (pct != null) {
    return clampPct(pct);
  }
  const used = num(disk.used);
  const size = num(disk.size);
  if (used == null || !size) {
    return null;
  }
  return clampPct((used / size) * 100);
}

export function worstDisk(sample?: DiskSample | null) {
  let best: DiskEntry | null = null;
  let bestPct = -1;
  for (const disk of sample?.disks ?? []) {
    const pct = diskPercent(disk);
    if (pct != null && pct > bestPct) {
      bestPct = pct;
      best = disk;
    }
  }
  return best ? { disk: best, pct: bestPct } : null;
}

export const last = <T>(list?: T[] | null): T | null =>
  list && list.length ? list[list.length - 1] : null;

const timeOf = (sample: { time: string }) => Date.parse(sample.time);

export type Point = { t: number; v: number | null };
export type Spark = { points: Point[]; from: number; to: number };

export function points<T extends { time: string }>(
  samples: T[] | null | undefined,
  read: (sample: T) => number | null,
): Point[] {
  return (samples ?? [])
    .map((sample) => ({ t: timeOf(sample), v: read(sample) }))
    .filter((point) => Number.isFinite(point.t))
    .sort((a, b) => a.t - b.t);
}

// The window ends at the newest sample, not at the wall clock, so a node that
// reports a little late still draws a full line.
export function sparkOf(list: Point[], ms = SPARK_WINDOW_MS): Spark {
  const to = list.length ? list[list.length - 1].t : 0;
  const from = to - ms;
  return { points: list.filter((point) => point.t >= from), from, to };
}

// How long the trailing run of samples has sat at or over the threshold.
export function aboveFor(list: Point[], threshold: number): number | null {
  let first: number | null = null;
  for (let i = list.length - 1; i >= 0; i--) {
    const v = list[i].v;
    if (v == null || v < threshold) {
      break;
    }
    first = list[i].t;
  }
  if (first == null) {
    return null;
  }
  return list[list.length - 1].t - first;
}

const REFS: MetricIssue["refs"] = [
  { value: WARN, severity: "warning" },
  { value: CRIT, severity: "critical" },
];

const thresholdFor = (severity: Severity) =>
  severity === "critical" ? CRIT : WARN;

export const isOnline = (node: MetricsNode) => !node.offline_at;

export function gpuDeviceCount(node: MetricsNode, stats?: NodeStats | null) {
  const devices = last(stats?.gpu)?.devices;
  if (devices?.length) {
    return devices.length;
  }
  if (!node.gpu) {
    return 0;
  }
  return Math.max(1, node.gpu_info?.length ?? 0);
}

export function nodeIssues(
  node: MetricsNode,
  stats: NodeStats | null | undefined,
): MetricIssue[] {
  // Offline nodes belong to Game Server Nodes: counted in the summary line,
  // never a problem row.
  if (!isOnline(node)) {
    return [];
  }

  const out: MetricIssue[] = [];
  const base = { nodeId: node.id, aboveForMs: null as number | null };

  if (stats) {
    const cpu = points(stats.cpu, cpuPercent);
    const cpuNow = last(cpu)?.v ?? null;
    const cpuLevel = level(cpuNow);
    if (cpuLevel) {
      out.push({
        ...base,
        key: `cpu|${node.id}`,
        kind: "cpu",
        severity: cpuLevel,
        value: cpuNow,
        threshold: thresholdFor(cpuLevel),
        aboveForMs: aboveFor(cpu, thresholdFor(cpuLevel)),
        cores: num(last(stats.cpu)?.total),
        spark: sparkOf(cpu),
        sparkMax: 100,
        refs: REFS,
      });
    }

    const memory = points(stats.memory, memoryPercent);
    const memoryNow = last(memory)?.v ?? null;
    const memoryLevel = level(memoryNow);
    if (memoryLevel) {
      const sample = last(stats.memory);
      out.push({
        ...base,
        key: `memory|${node.id}`,
        kind: "memory",
        severity: memoryLevel,
        value: memoryNow,
        threshold: thresholdFor(memoryLevel),
        aboveForMs: aboveFor(memory, thresholdFor(memoryLevel)),
        usedBytes: num(sample?.used),
        totalBytes: num(sample?.total),
        spark: sparkOf(memory),
        sparkMax: 100,
        refs: REFS,
      });
    }

    const worst = worstDisk(last(stats.disks));
    const diskLevel = level(worst?.pct);
    if (worst && diskLevel) {
      const mount = worst.disk.mountpoint ?? null;
      const disk = points(stats.disks, (sample) => {
        const entry = (sample.disks ?? []).find((d) => d.mountpoint === mount);
        return diskPercent(entry);
      });
      out.push({
        ...base,
        key: `disk|${node.id}`,
        kind: "disk",
        severity: diskLevel,
        value: worst.pct,
        threshold: thresholdFor(diskLevel),
        mount,
        usedBytes: (num(worst.disk.used) ?? 0) * 1024,
        totalBytes: (num(worst.disk.size) ?? 0) * 1024,
        spark: sparkOf(disk),
        sparkMax: 100,
        refs: REFS,
      });
    }

    const snapshot = last(stats.gpu);
    for (const device of snapshot?.devices ?? []) {
      const index = device.index ?? 0;
      const read = (pick: (d: GpuDevice) => number | null) =>
        points(stats.gpu, (sample) => {
          const d = (sample.devices ?? []).find(
            (entry) => (entry.index ?? 0) === index,
          );
          return d ? pick(d) : null;
        });
      const gpu = {
        ...base,
        gpuIndex: index,
        gpuName: device.name ?? "",
        temperature: num(device.temperature_c),
        power: num(device.power_w),
        utilization: num(device.utilization_percent),
      };

      const util = read((d) => num(d.utilization_percent));
      const utilFor = aboveFor(util, GPU_UTIL_CRIT);
      if (utilFor != null && utilFor >= GPU_UTIL_SUSTAIN_MS) {
        out.push({
          ...gpu,
          key: `gpu_util|${node.id}|${index}`,
          kind: "gpu_util",
          severity: "critical",
          value: last(util)?.v ?? null,
          threshold: GPU_UTIL_CRIT,
          aboveForMs: utilFor,
          spark: sparkOf(util),
          sparkMax: 100,
          refs: [{ value: GPU_UTIL_CRIT, severity: "critical" }],
        });
      }

      const total = num(device.memory_mb);
      const used = num(device.memory_used_mb);
      const vramNow =
        total && used != null ? clampPct((used / total) * 100) : null;
      if (vramNow != null && vramNow >= GPU_VRAM_CRIT) {
        const vram = read((d) => {
          const t = num(d.memory_mb);
          const u = num(d.memory_used_mb);
          return t && u != null ? clampPct((u / t) * 100) : null;
        });
        out.push({
          ...gpu,
          key: `gpu_vram|${node.id}|${index}`,
          kind: "gpu_vram",
          severity: "critical",
          value: vramNow,
          threshold: GPU_VRAM_CRIT,
          usedBytes: (used ?? 0) * 1024 * 1024,
          totalBytes: (total ?? 0) * 1024 * 1024,
          spark: sparkOf(vram),
          sparkMax: 100,
          refs: [{ value: GPU_VRAM_CRIT, severity: "critical" }],
        });
      }

      const temp = gpu.temperature;
      if (temp != null && temp >= GPU_TEMP_WARN) {
        const temps = read((d) => num(d.temperature_c));
        out.push({
          ...gpu,
          key: `gpu_temp|${node.id}|${index}`,
          kind: "gpu_temp",
          severity: "warning",
          value: temp,
          threshold: GPU_TEMP_WARN,
          aboveForMs: aboveFor(temps, GPU_TEMP_WARN),
          spark: sparkOf(temps),
          sparkMax: 100,
          refs: [{ value: GPU_TEMP_WARN, severity: "warning" }],
        });
      }
    }
  }

  (node.cpu_warnings ?? []).forEach((warning, index) => {
    const cpu = points(stats?.cpu, cpuPercent);
    out.push({
      ...base,
      key: `cpu_warning|${node.id}|${index}`,
      kind: "cpu_warning",
      severity: "warning",
      value: null,
      threshold: null,
      warning,
      spark: sparkOf(cpu),
      sparkMax: 100,
      refs: REFS,
    });
  });

  return out;
}

export function collectIssues(
  nodes: MetricsNode[],
  statsByNode: Record<string, NodeStats | null | undefined>,
  nameOf: (node: MetricsNode) => string = (node) => node.label || node.id,
): MetricIssue[] {
  const order = new Map(
    [...nodes]
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
      .map((node, index) => [node.id, index]),
  );
  return nodes
    .flatMap((node) => nodeIssues(node, statsByNode[node.id]))
    .sort(
      (a, b) =>
        RANK[b.severity] - RANK[a.severity] ||
        (order.get(a.nodeId) ?? 0) - (order.get(b.nodeId) ?? 0),
    );
}

// The game server named in a cpu_warning, when the warning names one.
export function warnedServer(warning?: string): string | null {
  return warning?.match(/Game server "([^"]+)"/)?.[1] ?? null;
}

export type FleetSummary = {
  total: number;
  online: number;
  offline: number;
  fine: number;
  attention: number;
  gpuTotal: number;
  gpuOnline: number;
  gpuOffline: number;
  gpuFine: number;
};

export function fleetSummary(
  nodes: MetricsNode[],
  statsByNode: Record<string, NodeStats | null | undefined>,
  issues: MetricIssue[],
): FleetSummary {
  const hit = new Set(issues.map((issue) => issue.nodeId));
  const gpuHit = new Set(
    issues
      .filter((issue) => issue.gpuIndex != null)
      .map((issue) => `${issue.nodeId}|${issue.gpuIndex}`),
  );
  const online = nodes.filter(isOnline);
  const fine = online.filter((node) => !hit.has(node.id)).length;

  let gpuTotal = 0;
  let gpuOnline = 0;
  for (const node of nodes) {
    const count = gpuDeviceCount(node, statsByNode[node.id]);
    gpuTotal += count;
    if (isOnline(node)) {
      gpuOnline += count;
    }
  }

  return {
    total: nodes.length,
    online: online.length,
    offline: nodes.length - online.length,
    fine,
    attention: online.length - fine,
    gpuTotal,
    gpuOnline,
    gpuOffline: gpuTotal - gpuOnline,
    gpuFine: Math.max(0, gpuOnline - gpuHit.size),
  };
}

// ---- services ----

export type ServiceRow = {
  key: string;
  service: ServiceStat;
  nodeLabel: string;
  // The line under the service name: the node's label, or a short id.
  nodeShort: string;
  nodeIsId: boolean;
  stale: boolean;
  lastSeen: number | null;
  cpu: number | null;
  memoryBytes: number;
  share: number | null;
  disk: NodeDisk | null;
  severity: Severity | null;
  spark: Spark;
};

export type ServiceSortKey = "name" | "cpu" | "memory" | "disk";

export function serviceCpu(service: ServiceStat): number | null {
  return cpuPercent(last(service.cpu));
}

export function serviceMemoryBytes(service: ServiceStat): number {
  return num(last(service.memory)?.used) ?? 0;
}

// Each memory sample carries the node's capacity, so the share needs nothing
// but the service itself.
export function serviceMemoryShare(service: ServiceStat): number | null {
  return memoryPercent(last(service.memory));
}

export const memoryShareLevel = (share: number | null): Severity | null =>
  share != null && share >= SERVICE_MEMORY_SHARE_CRIT ? "critical" : null;

export function serviceSeverity(service: ServiceStat): Severity | null {
  return worse(
    level(serviceCpu(service)),
    memoryShareLevel(serviceMemoryShare(service)),
  );
}

export const serviceCpuPoints = (service: ServiceStat) =>
  points(service.cpu, cpuPercent);

export const serviceMemoryPoints = (service: ServiceStat) =>
  points(service.memory, (sample) => num(sample.used));

export const serviceCpuSpark = (service: ServiceStat) =>
  sparkOf(serviceCpuPoints(service));

// Pods report no disk of their own; the table shows the fullest disk of the
// node they run on. Sizes come in KB.
export type NodeDisk = {
  pct: number;
  mount: string | null;
  usedBytes: number;
  totalBytes: number;
};

export function nodeDisk(stats?: NodeStats | null): NodeDisk | null {
  const worst = worstDisk(last(stats?.disks));
  if (!worst) {
    return null;
  }
  return {
    pct: worst.pct,
    mount: worst.disk.mountpoint ?? worst.disk.filesystem ?? null,
    usedBytes: (num(worst.disk.used) ?? 0) * 1024,
    totalBytes: (num(worst.disk.size) ?? 0) * 1024,
  };
}

export type MeterTone = "ok" | "warn" | "bad";

export const toneOf = (severity: Severity | null): MeterTone =>
  severity === "critical" ? "bad" : severity === "warning" ? "warn" : "ok";

// Node ids are UUIDs or host names: a UUID shortens to its first block.
export const shortNodeId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id) ? id.slice(0, 8) : id;

export function lastSampleTime(service: ServiceStat): number | null {
  const sample = last(service.cpu) ?? last(service.memory);
  const t = sample ? Date.parse(sample.time) : NaN;
  return Number.isFinite(t) ? t : null;
}

// The Logs page only has tabs for these; every other service still streams in
// the sheet, it just has no tab to hand off to.
export const LOG_TABS = [
  "api",
  "web",
  "game-server-node",
  "demo-parser",
  "hasura",
  "typesense",
  "timescaledb",
  "redis",
  "rustfs",
  "mediamtx",
];

export function logTabFor(service: string): string | null {
  if (service.startsWith("game-server-node-connector")) {
    return "game-server-node";
  }
  return LOG_TABS.includes(service) ? service : null;
}
