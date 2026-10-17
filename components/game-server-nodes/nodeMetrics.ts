// Live metrics for the inspector: the ranges the Live section offers, the one
// fetch behind them, and the series drawn from getNodeStats -- by time, with
// breaks where samples are missing, never a drop to zero.
export type StatPoint = { t: number; v: number | null };

export const SAMPLE_INTERVAL_MS = 30_000;

// getNodeStats keeps about 90 minutes (a sample every 30s) and takes no time
// range, so only Live and 1h can be filled honestly. When the api takes a
// range, add 6h/24h/7d here and pass the window through fetchNodeStats.
export const METRIC_RANGES = [
  { key: "live", minutes: 10 },
  { key: "1h", minutes: 60 },
] as const;

export type MetricRangeKey = (typeof METRIC_RANGES)[number]["key"];

export function rangeMinutes(key: MetricRangeKey) {
  return METRIC_RANGES.find((range) => range.key === key)?.minutes ?? 10;
}

type QueryClient = {
  query: (options: Record<string, any>) => Promise<{ data?: any }>;
};

// Slim is CPU and memory for a table row; full adds disks, network and GPUs
// for the inspector.
export async function fetchNodeStats(
  client: QueryClient,
  nodeId: string,
  full: boolean,
) {
  // Loaded on first use so the series helpers stay free of the codegen.
  const { FULL_QUERY, SLIM_QUERY } =
    await import("~/components/game-server-nodes/nodeStatsQuery");
  const { data } = await client.query({
    query: full ? FULL_QUERY : SLIM_QUERY,
    variables: { node: nodeId },
    fetchPolicy: "network-only",
  });
  return data?.getNodeStats ?? null;
}

const time = (sample: any) => {
  const t = Date.parse(sample?.time);
  return Number.isFinite(t) ? t : null;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

function series(
  samples: unknown,
  read: (sample: any) => number | null,
): Array<StatPoint> {
  if (!Array.isArray(samples)) {
    return [];
  }
  const points: Array<StatPoint> = [];
  for (const sample of samples) {
    const t = time(sample);
    if (t == null) {
      continue;
    }
    const v = read(sample);
    points.push({ t, v: v != null && Number.isFinite(v) ? v : null });
  }
  return points.sort((a, b) => a.t - b.t);
}

// used is in nanocores, total in cores.
export const cpuSeries = (stats: any) =>
  series(stats?.cpu, (sample) =>
    sample?.total && sample.used != null
      ? clampPercent(((Number(sample.used) / 1e9) * 100) / Number(sample.total))
      : null,
  );

export const memorySeries = (stats: any) =>
  series(stats?.memory, (sample) =>
    sample?.total
      ? clampPercent((Number(sample.used || 0) / Number(sample.total)) * 100)
      : null,
  );

export function memoryTotalGb(stats: any): number | null {
  const last = Array.isArray(stats?.memory) ? stats.memory.at(-1) : null;
  return last?.total ? Number(last.total) / 1024 ** 3 : null;
}

// rx/tx are bytes per second, summed over the node's interfaces.
function networkPart(stats: any, part: "rx" | "tx") {
  return series(stats?.network, (sample) =>
    Array.isArray(sample?.nics)
      ? (sample.nics.reduce(
          (sum: number, nic: any) => sum + Number(nic?.[part] || 0),
          0,
        ) *
          8) /
        1_000_000
      : null,
  );
}

export const networkInSeries = (stats: any) => networkPart(stats, "rx");
export const networkOutSeries = (stats: any) => networkPart(stats, "tx");

export function networkSeries(stats: any): Array<StatPoint> {
  const outs = networkOutSeries(stats);
  return networkInSeries(stats).map((point, index) => ({
    t: point.t,
    v:
      point.v == null || outs[index]?.v == null
        ? point.v
        : point.v + (outs[index].v as number),
  }));
}

export const gpuSeries = (stats: any) =>
  series(stats?.gpu, (sample) => {
    const values = (sample?.devices ?? [])
      .map((device: any) => device?.utilization_percent)
      .filter((value: any) => typeof value === "number");
    return values.length
      ? clampPercent(
          values.reduce((sum: number, value: number) => sum + value, 0) /
            values.length,
        )
      : null;
  });

const diskPercentOf = (disk: any) => {
  const percent = parseFloat(String(disk?.usedPercent ?? "").replace("%", ""));
  if (Number.isFinite(percent)) {
    return percent;
  }
  return disk?.size && disk?.used
    ? (Number(disk.used) / Number(disk.size)) * 100
    : -1;
};

// The fullest disk in the newest sample, followed through the history by its
// mount point. Sizes come in KiB; the series is used GB.
export function diskUsedSeries(stats: any): Array<StatPoint> {
  const samples = Array.isArray(stats?.disks) ? stats.disks : [];
  const last = samples.at(-1)?.disks ?? [];
  let pick: any = null;
  for (const disk of last) {
    if (!pick || diskPercentOf(disk) > diskPercentOf(pick)) {
      pick = disk;
    }
  }
  if (!pick) {
    return [];
  }
  const key = pick.mountpoint ?? pick.filesystem;
  return series(samples, (sample) => {
    const disk = (sample?.disks ?? []).find(
      (entry: any) => (entry?.mountpoint ?? entry?.filesystem) === key,
    );
    return disk?.used != null ? Number(disk.used) / 1024 ** 2 : null;
  });
}

export function latest(points: Array<StatPoint>): number | null {
  for (let index = points.length - 1; index >= 0; index--) {
    if (points[index].v != null) {
      return points[index].v;
    }
  }
  return null;
}

// The spacing the node actually reports at: the median gap, so one outage
// doesn't stretch it.
export function sampleInterval(points: Array<StatPoint>) {
  const gaps: Array<number> = [];
  for (let index = 1; index < points.length; index++) {
    const gap = points[index].t - points[index - 1].t;
    if (gap > 0) {
      gaps.push(gap);
    }
  }
  if (!gaps.length) {
    return SAMPLE_INTERVAL_MS;
  }
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

// Samples further apart than this mean the node stopped reporting.
export const gapThreshold = (interval: number) => interval * 2.5;

export function inWindow(points: Array<StatPoint>, from: number, to: number) {
  return points.filter((point) => point.t >= from && point.t <= to);
}

// The runs a line is drawn in: it breaks at a missing value and wherever two
// samples sit more than ~2 intervals apart.
export function lineSegments(
  points: Array<StatPoint>,
  interval = sampleInterval(points),
): Array<Array<{ t: number; v: number }>> {
  const segments: Array<Array<{ t: number; v: number }>> = [];
  let run: Array<{ t: number; v: number }> = [];
  let previous: number | null = null;
  for (const point of points) {
    const broken =
      point.v == null ||
      (previous != null && point.t - previous > gapThreshold(interval));
    if (broken && run.length) {
      segments.push(run);
      run = [];
    }
    if (point.v != null) {
      run.push({ t: point.t, v: point.v });
    }
    previous = point.t;
  }
  if (run.length) {
    segments.push(run);
  }
  return segments;
}

export type GapBand = { from: number; to: number; open: boolean };

// Time the node was gone inside [from, to]: gaps between samples and, when it
// has stopped reporting, the stretch from its last sample to now (`open`).
export function gapBands(
  points: Array<StatPoint>,
  from: number,
  to: number,
  interval = sampleInterval(points),
): Array<GapBand> {
  const limit = gapThreshold(interval);
  const bands: Array<GapBand> = [];
  const times = points.map((point) => point.t).filter((t) => t <= to);
  for (let index = 1; index < times.length; index++) {
    const a = times[index - 1];
    const b = times[index];
    if (b - a > limit && b > from) {
      bands.push({ from: Math.max(a, from), to: b, open: false });
    }
  }
  const last = times.at(-1);
  if (last != null && to - last > limit) {
    bands.push({ from: Math.max(last, from), to, open: true });
  }
  return bands;
}

export type DiskTrend =
  | { kind: "flat" }
  | {
      kind: "up" | "down";
      deltaGb: number;
      fullInHours: number | null;
      soon: boolean;
    };

// Whether the disk really moved over the last `minutes`. Needs a quarter of
// an hour of samples; a change under 0.5 GB (or 0.1% of the disk) is flat.
export function diskTrend(
  usedGb: Array<StatPoint>,
  freeGb: number | null,
  totalGb: number | null,
  now: number,
  minutes = 60,
): DiskTrend | null {
  const recent = usedGb.filter(
    (point) => point.v != null && point.t >= now - minutes * 60_000,
  );
  if (recent.length < 2) {
    return null;
  }
  const first = recent[0];
  const last = recent[recent.length - 1];
  const spanMinutes = (last.t - first.t) / 60_000;
  if (spanMinutes < 15) {
    return null;
  }
  const delta = (last.v as number) - (first.v as number);
  if (Math.abs(delta) < Math.max(0.5, (totalGb ?? 0) * 0.001)) {
    return { kind: "flat" };
  }
  let fullInHours: number | null = null;
  if (delta > 0 && freeGb != null) {
    const hours = freeGb / ((delta / spanMinutes) * 60);
    fullInHours = hours < 14 * 24 ? hours : null;
  }
  return {
    kind: delta > 0 ? "up" : "down",
    deltaGb: Math.abs(delta),
    fullInHours,
    soon: fullInHours != null && fullInHours < 72,
  };
}

// A round axis top: 1, 2, 2.5, 5 or 10 times a power of ten.
export function niceCeil(value: number) {
  if (value <= 0) {
    return 1;
  }
  const exponent = Math.pow(10, Math.floor(Math.log10(value)));
  const fraction = value / exponent;
  const step =
    fraction <= 1
      ? 1
      : fraction <= 2
        ? 2
        : fraction <= 2.5
          ? 2.5
          : fraction <= 5
            ? 5
            : 10;
  return step * exponent;
}

export function formatGb(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} TB`;
  }
  if (value >= 10) {
    return `${Math.round(value)} GB`;
  }
  return `${value.toFixed(1)} GB`;
}
