import type { StageView, Vec3 } from "./types";

/**
 * A moment in a replay, as a share link carries it in the URL hash:
 * `#r=12&t=48210&v=3d&lv=lower&f=76561198000000000&c=ex,ey,ez,tx,ty,tz`.
 * The hash never reaches the router's page key, so applying it cannot
 * remount the page.
 */
export type ReplayMoment = {
  round: number;
  tick: number;
  view?: StageView;
  /** The storey shown on a stacked map. */
  level?: string;
  /** The player the camera follows. */
  follow?: string;
  /** Eye and look-at point, source units. */
  camera?: { eye: Vec3; target: Vec3 };
};

const ID = /^[A-Za-z0-9_-]{1,32}$/;

function whole(value: string | null) {
  if (value === null || !/^\d{1,10}$/.test(value)) {
    return null;
  }
  return Number(value);
}

export function encodeMoment(moment: ReplayMoment): string {
  const parts = [
    `r=${Math.max(0, Math.round(moment.round))}`,
    `t=${Math.max(0, Math.round(moment.tick))}`,
  ];
  if (moment.view) {
    parts.push(`v=${moment.view}`);
  }
  if (moment.level && ID.test(moment.level)) {
    parts.push(`lv=${moment.level}`);
  }
  if (moment.follow && ID.test(moment.follow)) {
    parts.push(`f=${moment.follow}`);
  }
  const camera = moment.camera;
  if (camera) {
    const numbers = [
      camera.eye.x,
      camera.eye.y,
      camera.eye.z,
      camera.target.x,
      camera.target.y,
      camera.target.z,
    ];
    if (numbers.every(Number.isFinite)) {
      parts.push(`c=${numbers.map((n) => Math.round(n)).join(",")}`);
    }
  }
  return parts.join("&");
}

/** Reads a moment from a URL hash (with or without the `#`); null when it holds none. */
export function decodeMoment(
  hash: string | null | undefined,
): ReplayMoment | null {
  const body = (hash ?? "").replace(/^#/, "");
  if (!body) {
    return null;
  }
  const params = new URLSearchParams(body);
  const round = whole(params.get("r"));
  const tick = whole(params.get("t"));
  if (round === null || tick === null) {
    return null;
  }
  const moment: ReplayMoment = { round, tick };
  const view = params.get("v");
  if (view === "2d" || view === "3d") {
    moment.view = view;
  }
  const level = params.get("lv");
  if (level && ID.test(level)) {
    moment.level = level;
  }
  const follow = params.get("f");
  if (follow && ID.test(follow)) {
    moment.follow = follow;
  }
  const numbers = (params.get("c") ?? "").split(",").map((n) => Number(n));
  if (
    numbers.length === 6 &&
    numbers.every((n) => Number.isFinite(n) && Math.abs(n) < 1e6)
  ) {
    const [ex, ey, ez, tx, ty, tz] = numbers;
    moment.camera = {
      eye: { x: ex, y: ey, z: ez },
      target: { x: tx, y: ty, z: tz },
    };
  }
  return moment;
}

/**
 * Where a tick falls among a round's samples: the sample at or before it and
 * how far it is toward the next one, the viewer's `tickIndex`/`fractional`.
 */
export function locateTick(ticks: number[], tick: number) {
  if (!ticks.length || tick <= ticks[0]) {
    return { index: 0, fraction: 0 };
  }
  const last = ticks.length - 1;
  if (tick >= ticks[last]) {
    return { index: last, fraction: 0 };
  }
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ticks[mid] <= tick) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const span = ticks[hi] - ticks[lo];
  return { index: lo, fraction: span > 0 ? (tick - ticks[lo]) / span : 0 };
}
