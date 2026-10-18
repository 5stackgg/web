// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  METRIC_RANGES,
  cpuSeries,
  diskTrend,
  diskUsedSeries,
  gapBands,
  inWindow,
  latest,
  lineSegments,
  nearestTime,
  networkSeries,
  rangeMinutes,
  sampleInterval,
  valueAt,
  vramSeries,
  vramTotalGb,
  type StatPoint,
} from "~/components/game-server-nodes/nodeMetrics";

const T0 = Date.parse("2026-10-17T12:00:00Z");
const S = 30_000;
const at = (i: number) => T0 + i * S;
const points = (indexes: Array<number>, v = 10): Array<StatPoint> =>
  indexes.map((i) => ({ t: at(i), v }));

describe("ranges", () => {
  it("offers only what the api keeps: Live and the last hour", () => {
    expect(METRIC_RANGES.map((range) => range.key)).toEqual(["live", "1h"]);
    expect(rangeMinutes("1h")).toBe(60);
    expect(rangeMinutes("live")).toBeLessThan(60);
  });

  it("windows samples by time, not by count", () => {
    const series = points([0, 1, 2, 3, 4, 5]);
    expect(inWindow(series, at(2), at(4)).map((point) => point.t)).toEqual([
      at(2),
      at(3),
      at(4),
    ]);
  });
});

describe("gaps", () => {
  it("reads the interval as the median spacing", () => {
    expect(sampleInterval(points([0, 1, 2, 10, 11, 12]))).toBe(S);
    expect(sampleInterval([])).toBe(S);
  });

  it("breaks the line where more than two samples are missing", () => {
    const runs = lineSegments(points([0, 1, 2, 4, 5, 9, 10]), S);
    expect(runs.map((run) => run.length)).toEqual([5, 2]);
  });

  it("breaks the line at a missing value instead of drawing a zero", () => {
    const runs = lineSegments(
      [
        { t: at(0), v: 5 },
        { t: at(1), v: null },
        { t: at(2), v: 7 },
      ],
      S,
    );
    expect(runs).toEqual([[{ t: at(0), v: 5 }], [{ t: at(2), v: 7 }]]);
  });

  it("bands the time between samples and the time since the last one", () => {
    const series = points([0, 1, 2, 10, 11]);
    expect(gapBands(series, at(0), at(11), S)).toEqual([
      { from: at(2), to: at(10), open: false },
    ]);
    expect(gapBands(series, at(0), at(20), S).at(-1)).toEqual({
      from: at(11),
      to: at(20),
      open: true,
    });
    expect(gapBands(series, at(5), at(11), S)).toEqual([
      { from: at(5), to: at(10), open: false },
    ]);
  });
});

describe("series", () => {
  it("turns nanocores over cores into a percentage", () => {
    const series = cpuSeries({
      cpu: [
        { time: new Date(at(1)).toISOString(), total: 8, used: 2e9 },
        { time: new Date(at(0)).toISOString(), total: 8, used: 4e9 },
      ],
    });
    expect(series).toEqual([
      { t: at(0), v: 50 },
      { t: at(1), v: 25 },
    ]);
    expect(latest(series)).toBe(25);
  });

  it("sums the interfaces into Mbps", () => {
    const [point] = networkSeries({
      network: [
        {
          time: new Date(at(0)).toISOString(),
          nics: [
            { rx: 125_000, tx: 0 },
            { rx: 0, tx: 125_000 },
          ],
        },
      ],
    });
    expect(point.v).toBe(2);
  });

  it("follows the fullest disk by its mount point, in GB", () => {
    const sample = (i: number, used: number) => ({
      time: new Date(at(i)).toISOString(),
      disks: [
        {
          mountpoint: "/",
          size: 100 * 1024 ** 2,
          used: 10 * 1024 ** 2,
          usedPercent: "10%",
        },
        {
          mountpoint: "/data",
          size: 100 * 1024 ** 2,
          used: used * 1024 ** 2,
          usedPercent: `${used}%`,
        },
      ],
    });
    expect(diskUsedSeries({ disks: [sample(0, 60), sample(1, 61)] })).toEqual([
      { t: at(0), v: 60 },
      { t: at(1), v: 61 },
    ]);
  });
});

describe("disk trend", () => {
  const now = at(120);
  const filling = (gbPerSample: number) =>
    Array.from({ length: 121 }, (_, i) => ({
      t: at(i),
      v: 500 + i * gbPerSample,
    }));

  it("reports growth over the hour and when the disk fills", () => {
    const trend = diskTrend(filling(0.1), 24, 1000, now, 60);
    expect(trend).toMatchObject({ kind: "up", soon: true });
    expect(trend && "deltaGb" in trend && trend.deltaGb).toBeCloseTo(12, 5);
    expect(trend && "fullInHours" in trend && trend.fullInHours).toBeCloseTo(
      2,
      5,
    );
  });

  it("calls a small change flat and skips a short history", () => {
    expect(diskTrend(filling(0.001), 300, 1000, now, 60)).toEqual({
      kind: "flat",
    });
    expect(diskTrend(filling(1).slice(-10), 300, 1000, now, 60)).toBeNull();
  });

  it("names shrinking without a fill time", () => {
    expect(diskTrend(filling(-0.2), 300, 1000, now, 60)).toMatchObject({
      kind: "down",
      fullInHours: null,
      soon: false,
    });
  });
});

describe("vram", () => {
  const sample = (
    i: number,
    devices: Array<Record<string, unknown>> | null,
  ) => ({
    time: new Date(at(i)).toISOString(),
    devices,
  });

  it("reads video memory in use as a percent of every card's total", () => {
    const stats = {
      gpu: [
        sample(0, [{ memory_mb: 8192, memory_used_mb: 2048 }]),
        sample(1, [
          { memory_mb: 8192, memory_used_mb: 4096 },
          { memory_mb: 8192, memory_used_mb: 8192 },
        ]),
      ],
    };
    expect(vramSeries(stats)).toEqual([
      { t: at(0), v: 25 },
      { t: at(1), v: 75 },
    ]);
  });

  it("leaves a gap for a sample without readings instead of a zero", () => {
    const stats = {
      gpu: [
        sample(0, null),
        sample(1, [{ memory_mb: 8192, memory_used_mb: null }]),
      ],
    };
    expect(vramSeries(stats)).toEqual([
      { t: at(0), v: null },
      { t: at(1), v: null },
    ]);
  });

  it("totals the cards in the newest sample that reports them, in GB", () => {
    const stats = {
      gpu: [
        sample(0, [{ memory_mb: 8192 }, { memory_mb: 16384 }]),
        sample(1, []),
      ],
    };
    expect(vramTotalGb(stats)).toBe(24);
    expect(vramTotalGb({ gpu: [] })).toBeNull();
    expect(vramTotalGb(null)).toBeNull();
  });
});

describe("crosshair", () => {
  it("reads the nearest sample within half an interval", () => {
    const series: Array<StatPoint> = [
      { t: at(0), v: 10 },
      { t: at(1), v: null },
      { t: at(2), v: 30 },
    ];
    expect(valueAt(series, at(0) + 5_000, S)).toEqual({ t: at(0), v: 10 });
    expect(valueAt(series, at(2) - 10_000, S)).toEqual({ t: at(2), v: 30 });
    expect(valueAt(series, at(1), S)).toBeNull();
  });

  it("snaps to the nearest time", () => {
    expect(nearestTime([at(0), at(1), at(2)], at(1) + 20_000)).toBe(at(2));
    expect(nearestTime([], at(1))).toBeNull();
  });
});
