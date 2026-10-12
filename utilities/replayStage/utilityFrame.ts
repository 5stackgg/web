import { HE_BLAST_RADIUS } from "~/utils/smokeVolume";
import {
  executeFlightSeconds,
  normalizeTrajectory,
  utilityLanding,
  utilityOrigin,
} from "~/utilities/utilityDisplay";
import { levelAt, levelsFor } from "./mapLevels";
import { normalizeMapName } from "~/utilities/mapAssets";
import type { UtilityLineup, UtilityTrajectoryPoint } from "~/types/utility";
import type {
  StageFlame,
  StageFrame,
  StageGrenadeType,
  StagePlayer,
  StageSmokeVoxels,
  StageTeam,
  Vec3,
} from "./types";

/**
 * The replay stage fed from the utility pages: a lineup is one throw, an
 * execute several on one clock. Nothing here comes from a demo, so what a
 * grenade turns into once it is down (the cloud, the fire, the burst) is
 * timed the way CS2 times it and laid out around the landing.
 */

/** One grenade on the clock. */
export type UtilityStageThrow = {
  key: string;
  gid: number;
  type: StageGrenadeType;
  team: StageTeam;
  /** Where the thrower stands (feet). */
  origin: Vec3;
  /** Release to rest, evenly spaced in time. */
  path: Vec3[];
  /** Where it goes off. */
  landing: Vec3 | null;
  /** Seconds on the clock it leaves the hand. */
  start: number;
  /** Seconds in the air. */
  flight: number;
  /** Valve's smoke grid, when one is known; otherwise the stage floods its own. */
  voxels?: StageSmokeVoxels | null;
};

/** What the camera frames: everyone throwing and everywhere it lands. */
export type UtilityStageShot = {
  /** What has to be on screen, source units. */
  points: Vec3[];
  /** Radians, the camera rig's convention: 0 looks north. */
  heading: number;
  /** The lowest anyone stands or anything lands, for the rig to orbit. */
  floor: number;
};

const SMOKE_SECS = 20;
const INFERNO_SECS = 7.03;
const DECOY_SECS = 15;
const DETONATION_SECS = 3;
const BLAST_SECS = 2;
/** What stays on the ground once it is down, and for how long. */
const LASTS: Partial<Record<StageGrenadeType, number>> = {
  smoke: SMOKE_SECS,
  molotov: INFERNO_SECS,
  incendiary: INFERNO_SECS,
  decoy: DECOY_SECS,
};
/**
 * How old everything is in a still: the cloud has reached its edges, the fire
 * has spread, and a flash or HE has long gone off. A lineup's replay stops
 * here, so its last running frame and the still are the same picture.
 */
export const UTILITY_STILL_SECS = 4;
/** Seconds the fire takes to creep out to its edge. */
const FLAME_SPREAD_SECS = 1.8;
const FLAME_REACH = 150;
/** Room around a landing for what it turns into. */
const BURST: Partial<Record<StageGrenadeType, number>> = {
  smoke: 180,
  molotov: 150,
  incendiary: 150,
};
const BURST_DEFAULT = 110;
/**
 * Over the thrower's shoulder rather than straight down the line: the arc
 * reads as an arc, and a wide screen holds the throw across its diagonal.
 */
const SHOT_SWING = (35 * Math.PI) / 180;
/** A thrower's portrait floats about this high over their feet. */
const PORTRAIT_HEIGHT = 110;

/** CS2 lays flames ~42u apart: the 16 lattice cells nearest the landing. */
const FLAME_CELLS: Array<[number, number]> = (() => {
  const cells: Array<[number, number]> = [];
  for (let row = -4; row <= 4; row++) {
    for (let col = -4; col <= 4; col++) {
      const x = (col + (row % 2) * 0.5) * 42;
      const y = row * 42 * 0.866;
      if (Math.hypot(x, y) <= FLAME_REACH) {
        cells.push([x, y]);
      }
    }
  }
  return cells.sort((a, b) => Math.hypot(...a) - Math.hypot(...b)).slice(0, 16);
})();

const WEAPONS: Record<StageGrenadeType, string> = {
  smoke: "smokegrenade",
  flash: "flashbang",
  he: "hegrenade",
  molotov: "molotov",
  incendiary: "incgrenade",
  decoy: "decoy",
};

function seed(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function utilityStageType(
  lineup: Pick<UtilityLineup, "utility_type" | "side">,
): StageGrenadeType {
  switch (lineup.utility_type) {
    case "Smoke":
      return "smoke";
    case "Flash":
      return "flash";
    case "HighExplosive":
      return "he";
    case "Decoy":
      return "decoy";
    default:
      // A CT buys the incendiary.
      return lineup.side === "CT" ? "incendiary" : "molotov";
  }
}

function teamOf(lineup: Pick<UtilityLineup, "side">): StageTeam {
  return lineup.side === "CT" ? "ct" : "t";
}

/** `points` resampled to even steps of their own `t`, when every one has it. */
function evenInTime(points: UtilityTrajectoryPoint[]): Vec3[] {
  const timed = points.every(
    (point, i) =>
      Number.isFinite(point.t) && (i === 0 || point.t! > points[i - 1].t!),
  );
  if (!timed) {
    return points.map(({ x, y, z }) => ({ x, y, z }));
  }
  const first = points[0].t!;
  const span = points[points.length - 1].t! - first;
  const out: Vec3[] = [];
  let j = 0;
  for (let i = 0; i < points.length; i++) {
    const t = first + (span * i) / (points.length - 1);
    while (j < points.length - 2 && points[j + 1].t! < t) {
      j++;
    }
    const a = points[j];
    const b = points[j + 1];
    const k = Math.min(1, Math.max(0, (t - a.t!) / (b.t! - a.t!)));
    out.push({
      x: a.x + (b.x - a.x) * k,
      y: a.y + (b.y - a.y) * k,
      z: a.z + (b.z - a.z) * k,
    });
  }
  return out;
}

/** A lob from `from` to `to`, for a lineup that recorded no flight. */
function lob(from: Vec3, to: Vec3): Vec3[] {
  const span = Math.hypot(to.x - from.x, to.y - from.y);
  const rise = span * 0.22 + 80;
  const path: Vec3[] = [];
  for (let i = 0; i <= 32; i++) {
    const k = i / 32;
    path.push({
      x: from.x + (to.x - from.x) * k,
      y: from.y + (to.y - from.y) * k,
      z: from.z + (to.z - from.z) * k + rise * 4 * k * (1 - k),
    });
  }
  return path;
}

/**
 * A lineup as a throw on the clock. `points` is the detailed flight when it
 * has loaded; without it the lineup's preview flies, and without that a lob
 * from the eye to the landing. Null when there is nothing to fly to.
 */
export function utilityStageThrow(
  lineup: Pick<
    UtilityLineup,
    | "utility_type"
    | "side"
    | "origin_x"
    | "origin_y"
    | "origin_z"
    | "eye_z"
    | "land_x"
    | "land_y"
    | "land_z"
    | "trajectory_preview"
    | "flight_time_ms"
  >,
  options: {
    key: string;
    gid: number;
    start?: number;
    points?: UtilityTrajectoryPoint[] | null;
    voxels?: StageSmokeVoxels | null;
  },
): UtilityStageThrow | null {
  const origin = utilityOrigin(lineup);
  const landing = utilityLanding(lineup);
  const recorded =
    options.points && options.points.length >= 2
      ? options.points
      : normalizeTrajectory(lineup.trajectory_preview);
  let path: Vec3[];
  if (recorded.length >= 2) {
    path = evenInTime(recorded);
    const last = path[path.length - 1];
    // The preview can stop a few ticks short of where it goes off.
    if (
      landing &&
      Math.hypot(landing.x - last.x, landing.y - last.y, landing.z - last.z) >
        16
    ) {
      path.push({ x: landing.x, y: landing.y, z: landing.z });
    }
  } else if (landing) {
    const eye = lineup.eye_z != null ? Number(lineup.eye_z) : origin.z + 64;
    path = lob({ x: origin.x, y: origin.y, z: eye }, landing);
  } else {
    return null;
  }
  return {
    key: options.key,
    gid: options.gid,
    type: utilityStageType(lineup),
    team: teamOf(lineup),
    origin: { x: origin.x, y: origin.y, z: origin.z },
    path,
    landing: landing ? { x: landing.x, y: landing.y, z: landing.z } : null,
    start: options.start ?? 0,
    flight: executeFlightSeconds(lineup),
    voxels: options.voxels ?? null,
  };
}

/** Whoever throws a lineup, standing where it is thrown from. */
export function utilityStageThrower(
  lineup: Pick<
    UtilityLineup,
    | "utility_type"
    | "side"
    | "technique"
    | "origin_x"
    | "origin_y"
    | "origin_z"
    | "eye_z"
    | "view_yaw"
    | "view_pitch"
  >,
  options: { id: string; name: string; avatarUrl?: string | null },
): StagePlayer {
  const origin = utilityOrigin(lineup);
  return {
    id: options.id,
    name: options.name,
    team: teamOf(lineup),
    avatarUrl: options.avatarUrl ?? null,
    alive: true,
    x: origin.x,
    y: origin.y,
    z: origin.z,
    yaw: Number(lineup.view_yaw ?? 0),
    pitch: Number(lineup.view_pitch ?? 0),
    health: 100,
    armor: 0,
    helmet: false,
    weapon: WEAPONS[utilityStageType(lineup)],
    hasBomb: false,
    hasKit: false,
    ducked: lineup.technique === "Crouch" || lineup.technique === "CrouchJump",
    blind: 0,
    hurtAge: null,
    diedAge: null,
    selected: false,
  };
}

function flames(at: Vec3, since: number, key: number): StageFlame[] {
  const out: StageFlame[] = [];
  FLAME_CELLS.forEach(([dx, dy], i) => {
    const caught = (Math.hypot(dx, dy) / FLAME_REACH) * FLAME_SPREAD_SECS;
    const age = since - caught;
    const lasts = INFERNO_SECS - caught;
    if (age < 0 || age > lasts) {
      return;
    }
    const life = age / lasts;
    out.push({
      x: at.x + dx,
      y: at.y + dy,
      z: at.z,
      life,
      intensity: Math.min(1, age / 0.35, (1 - life) / 0.1),
      age,
      seed: seed(key * 31 + i),
    });
  });
  return out;
}

/**
 * The moment `time` seconds into the run: who is throwing, what is in the
 * air and what is down. -1 is before anything is thrown. Null is a still of
 * the finished picture: every grenade down, each cloud and fire as it looks
 * `UTILITY_STILL_SECS` in, no burst, and no timers, since nothing is running.
 */
export function buildUtilityFrame(
  throws: UtilityStageThrow[],
  throwers: StagePlayer[],
  time: number | null,
): StageFrame {
  const frame: StageFrame = {
    time: time ?? 0,
    tickRate: 64,
    players: throwers,
    shots: [],
    damages: [],
    kills: [],
    projectiles: [],
    detonations: [],
    smokes: [],
    infernos: [],
    blasts: [],
    bomb: null,
    throws: [],
  };
  const still = time === null;
  for (const entry of throws) {
    const age = still ? Infinity : time - entry.start;
    if (age < 0) {
      continue;
    }
    if (age < entry.flight) {
      frame.projectiles.push({
        key: entry.key,
        gid: entry.gid,
        type: entry.type,
        team: entry.team,
        path: entry.path,
        progress: age / entry.flight,
        age,
      });
      continue;
    }
    const at = entry.landing;
    if (!at) {
      continue;
    }
    const since = still ? UTILITY_STILL_SECS : age - entry.flight;
    const left = (secs: number) => (still ? null : secs - since);
    // Down: its flight stays drawn, from the hand to where it went off, and
    // the landing is ringed unless a cloud or a fire is standing on it.
    const lasts = LASTS[entry.type];
    frame.throws!.push({
      key: entry.key,
      gid: entry.gid,
      type: entry.type,
      team: entry.team,
      path: entry.path,
      at,
      landing: !lasts || since >= lasts,
    });
    switch (entry.type) {
      case "smoke":
        if (since < SMOKE_SECS) {
          frame.smokes.push({
            key: `${entry.key}:smoke`,
            gid: entry.gid,
            team: entry.team,
            at,
            age: since,
            remaining: left(SMOKE_SECS),
            voxels: entry.voxels ?? null,
          });
        }
        break;
      case "molotov":
      case "incendiary":
        if (since < INFERNO_SECS) {
          frame.infernos.push({
            key: `${entry.key}:fire`,
            team: entry.team,
            type: entry.type,
            flames: flames(at, since, entry.gid),
            age: since,
            remaining: left(INFERNO_SECS),
          });
        }
        break;
      case "decoy":
        if (since < DECOY_SECS) {
          frame.detonations.push({
            key: `${entry.key}:decoy`,
            gid: entry.gid,
            type: "decoy",
            team: entry.team,
            at,
            age: since,
            remaining: left(DECOY_SECS),
          });
        }
        break;
      default:
        if (!still && since < DETONATION_SECS) {
          frame.detonations.push({
            key: `${entry.key}:burst`,
            gid: entry.gid,
            type: entry.type,
            team: entry.team,
            at,
            age: since,
          });
          if (entry.type === "he" && since < BLAST_SECS) {
            frame.blasts.push({ ...at, age: since, radius: HE_BLAST_RADIUS });
          }
        }
    }
  }
  return frame;
}

/**
 * What has to be in view, and from where: every thrower (portrait included),
 * every flight with its height (a pop flash thrown straight up barely moves
 * across the ground), and the room each grenade takes once it is down,
 * looked at from behind the throwers toward where it all lands.
 */
export function utilityStageShot(
  throws: UtilityStageThrow[],
): UtilityStageShot | null {
  if (!throws.length) {
    return null;
  }
  const points: Vec3[] = [];
  const from = { x: 0, y: 0 };
  const to = { x: 0, y: 0 };
  let floor = Infinity;
  let landed = 0;
  for (const entry of throws) {
    const { origin, landing } = entry;
    points.push(origin, { ...origin, z: origin.z + PORTRAIT_HEIGHT });
    points.push(...entry.path);
    from.x += origin.x;
    from.y += origin.y;
    floor = Math.min(floor, origin.z);
    if (landing) {
      const burst = BURST[entry.type] ?? BURST_DEFAULT;
      for (const [dx, dy] of [
        [burst, 0],
        [-burst, 0],
        [0, burst],
        [0, -burst],
      ]) {
        points.push({ x: landing.x + dx, y: landing.y + dy, z: landing.z });
      }
      points.push({ ...landing, z: landing.z + burst });
      to.x += landing.x;
      to.y += landing.y;
      floor = Math.min(floor, landing.z);
      landed++;
    }
  }
  let heading = 0;
  if (landed) {
    const ux = to.x / landed - from.x / throws.length;
    const uy = to.y / landed - from.y / throws.length;
    if (Math.hypot(ux, uy) > 1) {
      // The rig looks along (-sin h, cos h) in source units.
      heading = Math.atan2(-ux, uy) + SHOT_SWING;
    }
  }
  return { points, heading, floor };
}

/**
 * Where the camera rig (camera.ts) has to aim, and how far back it has to
 * be, for `points` to fill the screen with a margin, seen at `heading` and
 * `pitch` through a lens of half-height `tanV` (tan of half the vertical
 * field of view) and `aspect` width over height, keeping the `inset` shares
 * of the screen's height clear at the top and bottom (badges and controls
 * sit there). The target ends on the
 * `floor`, slid along the line of sight, so the rig orbits the ground.
 */
export function fitStageShot(
  points: Vec3[],
  heading: number,
  pitch: number,
  tanV: number,
  aspect: number,
  floor: number,
  inset: { top?: number; bottom?: number } = {},
  margin = 0.86,
): { target: Vec3; distance: number } {
  const ch = Math.cos(heading);
  const sh = Math.sin(heading);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  // The rig's forward, right and up, in source units.
  const f = { x: -sh * cp, y: ch * cp, z: -sp };
  const r = { x: ch, y: sh, z: 0 };
  const u = { x: -sh * sp, y: ch * sp, z: cp };
  const tH = tanV * aspect * margin;
  // The screen left between the insets, as a centre and half-height.
  const above = inset.top ?? 0;
  const below = inset.bottom ?? 0;
  const middle = (below - above) * tanV;
  const half = (1 - above - below) * tanV * margin;
  const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

  const target = { x: 0, y: 0, z: 0 };
  for (const point of points) {
    target.x += point.x / points.length;
    target.y += point.y / points.length;
    target.z += point.z / points.length;
  }
  let distance = 0;
  const offset = { x: 0, y: 0, z: 0 };
  // Back far enough for every point, then centre what that shows; twice
  // more settles it.
  for (let pass = 0; pass < 3; pass++) {
    distance = 0;
    for (const point of points) {
      offset.x = point.x - target.x;
      offset.y = point.y - target.y;
      offset.z = point.z - target.z;
      const c = dot(offset, f);
      const b = dot(offset, u);
      distance = Math.max(
        distance,
        Math.abs(dot(offset, r)) / tH - c,
        b / (b >= 0 ? middle + half : middle - half) - c,
      );
    }
    let left = Infinity;
    let right = -Infinity;
    let bottom = Infinity;
    let top = -Infinity;
    for (const point of points) {
      offset.x = point.x - target.x;
      offset.y = point.y - target.y;
      offset.z = point.z - target.z;
      const depth = Math.max(1, distance + dot(offset, f));
      const x = dot(offset, r) / depth;
      const y = dot(offset, u) / depth;
      left = Math.min(left, x);
      right = Math.max(right, x);
      bottom = Math.min(bottom, y);
      top = Math.max(top, y);
    }
    const across = ((left + right) / 2) * distance;
    const up = ((bottom + top) / 2 - middle) * distance;
    target.x += r.x * across + u.x * up;
    target.y += r.y * across + u.y * up;
    target.z += r.z * across + u.z * up;
  }
  // The same view, aimed at the floor instead of somewhere in the air.
  const slide = (target.z - floor) / sp;
  return {
    target: {
      x: target.x + f.x * slide,
      y: target.y + f.y * slide,
      z: floor,
    },
    distance: distance + slide,
  };
}

/**
 * The storey to show on a stacked map (Nuke, Vertigo): the lower one when
 * every thrower and landing is on it, else the whole map.
 */
export function utilityStageLevel(
  mapName: string,
  throws: UtilityStageThrow[],
): string | null {
  const map = normalizeMapName(mapName);
  const levels = levelsFor(map);
  if (levels.length < 2 || !throws.length) {
    return null;
  }
  const lower = levels[levels.length - 1].id;
  const all = throws.every(
    (entry) =>
      levelAt(map, entry.origin.z) === lower &&
      (!entry.landing || levelAt(map, entry.landing.z) === lower),
  );
  return all ? lower : null;
}
