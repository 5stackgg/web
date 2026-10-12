import type { ReplayBlob } from "~/composables/useReplayBlob";
import type { Inferno, SmokeVolume } from "~/utils/smokeVolume";
import type {
  StageGrenadeType,
  StageSmokeVoxels,
  StageTeam,
  StageTrails,
  Vec3,
} from "./types";

/**
 * Everything `buildStageFrame` needs for one round, sorted and joined once so
 * that a frame costs what is on screen rather than what is in the blob. Built
 * on first use and cached per blob.
 */

export type PositionRow = {
  round: number;
  tick: number;
  attacker_steam_id: string | null;
  attacker_team: string | null;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number | null;
  pitch?: number | null;
  health: number | null;
  armor?: number | null;
  helmet?: boolean;
  has_bomb?: boolean;
  has_defuser?: boolean;
  active_weapon?: string | null;
  ducked?: boolean;
};

export type ShotRow = {
  round: number;
  tick: number;
  attacker_steam_id: string | null;
  attacker_team: string | null;
  with: string | null;
  yaw?: number | null;
  pitch?: number | null;
  eye_x?: number | null;
  eye_y?: number | null;
  eye_z?: number | null;
  result?: "hit" | "headshot" | null;
  impact_x?: number | null;
  impact_y?: number | null;
  impact_z?: number | null;
  miss_x?: number | null;
  miss_y?: number | null;
  miss_z?: number | null;
};

export type DamageRow = {
  round: number;
  /** The tick, as a string (it shares a column with the stats rows). */
  time: string | number;
  attacker_steam_id: string | null;
  attacked_steam_id: string | null;
  damage: number;
  health: number | null;
  weapon?: string | null;
  /** Source hit group; 0 (generic) is what an unknown one reads as. */
  hitgroup?: number | null;
  damage_armor?: number | null;
};

export type GrenadeRow = {
  round: number;
  tick: number;
  grenade_id: number | string | null;
  thrower_steam_id: string | null;
  thrower_team: string | null;
  type: string;
  phase: "thrown" | "detonated";
  x: number;
  y: number;
  z: number;
};

export type KillRow = {
  tick: number;
  killer?: string;
  victim?: string;
  killer_team?: string;
  victim_team?: string;
  weapon?: string;
  headshot?: boolean;
  victim_x?: number;
  victim_y?: number;
  victim_z?: number;
};

export type BombRow = {
  tick: number;
  type: string;
  player?: string;
  site?: string;
  x?: number;
  y?: number;
  z?: number;
};

/** A defuse kit a CT dropped on dying. */
export type KitDropRow = {
  tick: number;
  round?: number;
  player?: string;
  x: number;
  y: number;
  z: number;
};

export type FlashRow = {
  round: number;
  tick: number;
  attacker_steam_id: string | null;
  attacked_steam_id: string;
  /** Seconds. */
  duration: number;
  team_flash: boolean;
};

/** CS2's own smoke grid (blob schema 11+). */
export type SmokeVoxelRow = {
  gid: number | null;
  round: number;
  start_tick: number;
  end_tick?: number;
  ox: number;
  oy: number;
  oz: number;
  vs: number;
  dx: number;
  dy: number;
  dz: number;
  /** base64, dx*dy*dz bytes. */
  arr: string;
};

/** The blob, with the fields newer parsers add. */
export type StageBlob = ReplayBlob & {
  smoke_voxels?: SmokeVoxelRow[];
  flashes?: FlashRow[];
  kit_drops?: KitDropRow[];
};

/** Per-player samples, sorted by tick. */
export type Track = {
  id: string;
  team: StageTeam;
  ticks: Float64Array;
  rows: PositionRow[];
  /** When they died (kill event first, else the first dead sample). */
  deathTick: number | null;
  deathAt: Vec3 | null;
  /** Damage taken, by tick. */
  hurt: IndexedDamage[];
  flashes: FlashRow[];
};

export type IndexedShot = {
  key: string;
  tick: number;
  shooterId: string;
  team: StageTeam;
  weapon: string;
  from: Vec3;
  to: Vec3;
  hit: boolean;
  headshot: boolean;
  victimId: string | null;
  damage: number | null;
};

export type IndexedDamage = {
  key: string;
  tick: number;
  attackerId: string | null;
  victimId: string;
  amount: number;
  healthAfter: number;
  headshot: boolean;
  weapon: string | null;
  at: Vec3;
};

export type IndexedKill = {
  key: string;
  tick: number;
  killerId: string | null;
  victimId: string;
  team: StageTeam;
  headshot: boolean;
  weapon: string | null;
  at: Vec3;
};

export type IndexedGrenade = {
  key: string;
  gid: number;
  type: StageGrenadeType;
  team: StageTeam;
  throwTick: number | null;
  /** Detonation, or the end of the recorded flight when it never went off. */
  endTick: number | null;
  detonated: boolean;
  /** Evenly spaced in time from `throwTick` to `endTick`. */
  path: Vec3[] | null;
  at: Vec3;
};

export type IndexedSmoke = {
  key: string;
  gid: number | null;
  team: StageTeam;
  tick: number;
  /** Last tick it is drawn: its expiry, or the round's end cutting it short. */
  endTick: number;
  /** When it would expire on its own, for the timer. */
  expireTick: number;
  at: Vec3;
  volume: SmokeVolume | null;
  voxelRow: SmokeVoxelRow | null;
  voxels: StageSmokeVoxels | null | undefined;
};

export type IndexedFire = {
  x: number;
  y: number;
  z: number;
  s: number;
  e: number;
  seed: number;
};

export type IndexedInferno = {
  key: string;
  /** The molotov or incendiary that started it, when one matches. */
  gid: number | null;
  team: StageTeam;
  type: "molotov" | "incendiary";
  startTick: number;
  endTick: number;
  fires: IndexedFire[];
};

export type IndexedBlast = Vec3 & { tick: number; radius: number };

export type IndexedKitDrop = Vec3 & {
  key: string;
  tick: number;
  /** When a CT picked it up again, if one did. */
  pickupTick: number | null;
};

export type RoundRange = {
  round: number;
  startTick: number;
  freezeEndTick: number;
  endTick: number;
  /** Rows at or past this belong to the next round. */
  limit: number;
  winner: StageTeam | null;
};

export type RoundIndex = {
  round: number;
  range: RoundRange;
  rate: number;
  tracks: Track[];
  trackById: Map<string, Track>;
  shots: IndexedShot[];
  shotTicks: Float64Array;
  damages: IndexedDamage[];
  damageTicks: Float64Array;
  kills: IndexedKill[];
  grenades: IndexedGrenade[];
  smokes: IndexedSmoke[];
  infernos: IndexedInferno[];
  blasts: IndexedBlast[];
  bombs: BombRow[];
  /** Flash detonations, for guessing blindness when the blob has no flashes. */
  flashBangs: Array<Vec3 & { tick: number }>;
  realFlashes: boolean;
  kitDrops: IndexedKitDrop[];
  /** Built on first use by `roundTrails`. */
  trails?: StageTrails;
};

type Partition = {
  positions: PositionRow[];
  shots: ShotRow[];
  damages: DamageRow[];
  grenades: GrenadeRow[];
  kills: KillRow[];
  bombs: BombRow[];
  volumes: SmokeVolume[];
  voxels: SmokeVoxelRow[];
  infernos: Inferno[];
  flashes: FlashRow[];
  kitDrops: KitDropRow[];
};

type BlobIndex = {
  rate: number;
  ranges: Map<number, RoundRange>;
  partitions: Map<number, Partition>;
  rounds: Map<number, RoundIndex>;
  trajectories: Map<
    number,
    Array<{ t: number; x: number; y: number; z: number }>
  >;
  names: Map<string, string>;
};

/** A bullet's round can be credited for damage this long after it was fired. */
export const SHOT_CLAIM_SECS = 0.25;
/** How far a miss with no wall behind it is drawn. */
const MISS_RANGE = 1600;
/** Smokes whose end the demo did not record. */
const SMOKE_FALLBACK_SECS = 20;
/** No smoke that expired on its own lasted less than this. */
const SMOKE_MIN_SECS = 18;
const HE_BLAST_RADIUS = 250;
const C4_BLAST_RADIUS = 600;
/** Longer than any real throw: a detonation this far off is a stale position. */
const MAX_FLIGHT_DIST = 2500;

const cache = new WeakMap<object, BlobIndex>();

export function teamOf(
  value: string | number | null | undefined,
): StageTeam | null {
  if (value == null || value === "") {
    return null;
  }
  const v = String(value).toLowerCase();
  if (v === "ct" || v === "counterterrorist" || v === "3") {
    return "ct";
  }
  if (v === "t" || v === "terrorist" || v === "2") {
    return "t";
  }
  return null;
}

export function grenadeType(
  type: string,
  team: StageTeam | null,
): StageGrenadeType | null {
  switch (type.toLowerCase()) {
    case "smoke":
      return "smoke";
    case "flash":
      return "flash";
    case "he":
      return "he";
    case "decoy":
      return "decoy";
    case "incendiary":
      return "incendiary";
    case "molotov":
      // The parser folds both into "Molotov"; CTs can only buy the incendiary.
      return team === "ct" ? "incendiary" : "molotov";
  }
  return null;
}

/** Index of the first element greater than `value`. */
export function upperBound(sorted: ArrayLike<number>, value: number) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= value) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** Index of the first element at or above `value`. */
export function lowerBound(sorted: ArrayLike<number>, value: number) {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

export function lerpAngle(a: number, b: number, k: number) {
  const diff = ((((b - a + 540) % 360) + 360) % 360) - 180;
  return a + diff * k;
}

function hash01(x: number, y: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

/** Valve's arrival grid, or null when it does not hold a whole box. */
export function decodeSmokeVoxels(row: SmokeVoxelRow): StageSmokeVoxels | null {
  const cells = row.dx * row.dy * row.dz;
  if (!row.arr || !cells) {
    return null;
  }
  const arrival = decodeBase64(row.arr);
  if (arrival.length < cells) {
    return null;
  }
  return {
    ox: row.ox,
    oy: row.oy,
    oz: row.oz,
    vs: row.vs,
    dx: row.dx,
    dy: row.dy,
    dz: row.dz,
    arrival: arrival.length === cells ? arrival : arrival.subarray(0, cells),
  };
}

function blobIndex(blob: StageBlob): BlobIndex {
  let index = cache.get(blob);
  if (index) {
    return index;
  }
  const rate = blob.tick_rate || 64;
  const ranges = roundRanges(blob, rate);
  const partitions = new Map<number, Partition>();
  const part = (round: number) => {
    let p = partitions.get(round);
    if (!p) {
      p = {
        positions: [],
        shots: [],
        damages: [],
        grenades: [],
        kills: [],
        bombs: [],
        volumes: [],
        voxels: [],
        infernos: [],
        flashes: [],
        kitDrops: [],
      };
      partitions.set(round, p);
    }
    return p;
  };
  // A restarted match reuses round numbers; the tick range says which one a
  // row really belongs to.
  const inRound = (round: number, tick: number) => {
    const range = ranges.get(round);
    return !range || (tick >= range.startTick && tick < range.limit);
  };
  // Rows without a round of their own (kills, bombs) go by tick: into the
  // round_ticks ranges, else each round's span of position samples.
  const spans: Array<{ round: number; start: number; limit: number }> = [];
  const roundAt = (tick: number) => {
    for (const range of ranges.values()) {
      if (tick >= range.startTick && tick < range.limit) {
        return range.round;
      }
    }
    for (const span of spans) {
      if (tick >= span.start && tick < span.limit) {
        return span.round;
      }
    }
    return 0;
  };
  const byRound = <T>(
    rows: T[] | undefined,
    get: (row: T) => { round: number; tick: number },
    into: (p: Partition) => T[],
  ) => {
    for (const row of rows ?? []) {
      const { round, tick } = get(row);
      if (round > 0 && inRound(round, tick)) {
        into(part(round)).push(row);
      }
    }
  };

  byRound(
    blob.positions as PositionRow[],
    (r) => r,
    (p) => p.positions,
  );
  for (const [round, p] of partitions) {
    const range = ranges.get(round);
    if (range && Number.isFinite(range.endTick)) {
      continue;
    }
    let first = Infinity;
    let last = -Infinity;
    for (const row of p.positions) {
      first = Math.min(first, row.tick);
      last = Math.max(last, row.tick);
    }
    if (range) {
      // The last round of a demo whose end was never written.
      range.endTick = Math.max(range.startTick, last);
    } else {
      spans.push({ round, start: first, limit: last + 1 });
    }
  }
  spans.sort((a, b) => a.start - b.start);
  spans.forEach((span, i) => {
    span.limit = spans[i + 1]?.start ?? span.limit + 30 * rate;
  });
  byRound(
    blob.shots_fired as ShotRow[],
    (r) => r,
    (p) => p.shots,
  );
  byRound(
    blob.damages as DamageRow[],
    (r) => ({ round: r.round, tick: Number(r.time) }),
    (p) => p.damages,
  );
  byRound(
    blob.grenade_throws as GrenadeRow[],
    (r) => r,
    (p) => p.grenades,
  );
  byRound(
    blob.smoke_volumes,
    (r) => ({ round: r.round ?? roundAt(r.start_tick), tick: r.start_tick }),
    (p) => p.volumes,
  );
  byRound(
    blob.smoke_voxels,
    (r) => ({ round: r.round ?? roundAt(r.start_tick), tick: r.start_tick }),
    (p) => p.voxels,
  );
  byRound(
    blob.infernos,
    (r) => ({ round: r.round ?? roundAt(r.start_tick), tick: r.start_tick }),
    (p) => p.infernos,
  );
  byRound(
    blob.flashes,
    (r) => r,
    (p) => p.flashes,
  );
  byRound(
    blob.kills as KillRow[],
    (r) => ({ round: roundAt(r.tick), tick: r.tick }),
    (p) => p.kills,
  );
  byRound(
    blob.bombs as BombRow[],
    (r) => ({ round: roundAt(r.tick), tick: r.tick }),
    (p) => p.bombs,
  );
  byRound(
    blob.kit_drops,
    (r) => ({ round: r.round ?? roundAt(r.tick), tick: r.tick }),
    (p) => p.kitDrops,
  );

  const trajectories = new Map<
    number,
    Array<{ t: number; x: number; y: number; z: number }>
  >();
  for (const trajectory of blob.grenade_trajectories ?? []) {
    if (trajectory?.pts?.length) {
      trajectories.set(
        Number(trajectory.gid),
        [...trajectory.pts].sort((a, b) => a.t - b.t),
      );
    }
  }
  const names = new Map<string, string>();
  for (const player of blob.players ?? []) {
    if (player?.steam_id) {
      names.set(String(player.steam_id), player.name ?? "");
    }
  }

  index = {
    rate,
    ranges,
    partitions,
    rounds: new Map(),
    trajectories,
    names,
  };
  cache.set(blob, index);
  return index;
}

function roundRanges(blob: StageBlob, rate: number) {
  const ranges = new Map<number, RoundRange>();
  const rows = [...(blob.round_ticks ?? [])]
    .filter((r) => r && typeof r.round === "number")
    .sort((a, b) => (a.start_tick ?? 0) - (b.start_tick ?? 0));
  rows.forEach((r, i) => {
    const start = r.start_tick ?? -Infinity;
    const next = rows[i + 1]?.start_tick;
    // The viewer's blob says 0 for a total it does not know.
    const end =
      r.end_tick != null && r.end_tick > start
        ? r.end_tick
        : (next ?? (blob.total_ticks || Infinity));
    ranges.set(r.round, {
      round: r.round,
      startTick: start,
      freezeEndTick: r.freeze_end_tick ?? start,
      endTick: end,
      limit:
        next != null && next > start ? next : Math.max(end, start) + 30 * rate,
      winner: teamOf(r.winner),
    });
  });
  return ranges;
}

/** The blob's rounds that have anything to play, in order. */
export function indexedRounds(blob: StageBlob): RoundRange[] {
  const index = blobIndex(blob);
  const out: RoundRange[] = [];
  for (const [round, p] of index.partitions) {
    if (!p.positions.length) {
      continue;
    }
    const known = index.ranges.get(round);
    if (known) {
      out.push(known);
      continue;
    }
    let first = Infinity;
    let last = -Infinity;
    for (const row of p.positions) {
      first = Math.min(first, row.tick);
      last = Math.max(last, row.tick);
    }
    out.push({
      round,
      startTick: first,
      freezeEndTick: first,
      endTick: last,
      limit: Infinity,
      winner: null,
    });
  }
  return out.sort((a, b) => a.round - b.round);
}

export function playerNames(blob: StageBlob) {
  return blobIndex(blob).names;
}

export function roundIndex(blob: StageBlob, round: number): RoundIndex | null {
  const index = blobIndex(blob);
  const hit = index.rounds.get(round);
  if (hit) {
    return hit;
  }
  const p = index.partitions.get(round);
  if (!p) {
    return null;
  }
  const range =
    index.ranges.get(round) ??
    indexedRounds(blob).find((r) => r.round === round)!;
  const built = buildRound(blob, index, round, range, p);
  index.rounds.set(round, built);
  return built;
}

/** Where a track is at a tick, interpolated by tick. */
export function trackAt(
  track: Track,
  tick: number,
  out: Vec3 = { x: 0, y: 0, z: 0 },
) {
  const rows = track.rows;
  const i = upperBound(track.ticks, tick) - 1;
  if (i < 0 || i >= rows.length - 1) {
    const row = rows[Math.max(0, Math.min(rows.length - 1, i))];
    out.x = row.x;
    out.y = row.y;
    out.z = row.z;
    return out;
  }
  const a = rows[i];
  const b = rows[i + 1];
  const k = (tick - a.tick) / Math.max(1, b.tick - a.tick);
  out.x = a.x + (b.x - a.x) * k;
  out.y = a.y + (b.y - a.y) * k;
  out.z = a.z + (b.z - a.z) * k;
  return out;
}

function buildRound(
  blob: StageBlob,
  index: BlobIndex,
  round: number,
  range: RoundRange,
  p: Partition,
): RoundIndex {
  const rate = index.rate;

  const kills = [...p.kills].sort((a, b) => a.tick - b.tick);
  const tracks = buildTracks(p.positions);
  const trackById = new Map(tracks.map((track) => [track.id, track]));
  // Steam ids can arrive as numbers; tracks are keyed by the string.
  const idOf = (id: string | number | null | undefined) =>
    id == null || id === "" ? null : String(id);
  const teamOfPlayer = (id: string | number | null | undefined) => {
    const key = idOf(id);
    return (key && trackById.get(key)?.team) || null;
  };

  for (const kill of kills) {
    const victim = idOf(kill.victim);
    const track = victim ? trackById.get(victim) : null;
    if (track && (track.deathTick === null || kill.tick < track.deathTick)) {
      track.deathTick = kill.tick;
    }
  }
  for (const track of tracks) {
    if (track.deathTick === null) {
      continue;
    }
    const kill = kills.find(
      (k) => idOf(k.victim) === track.id && k.tick === track.deathTick,
    );
    track.deathAt =
      kill?.victim_x != null && kill.victim_y != null
        ? { x: kill.victim_x, y: kill.victim_y, z: kill.victim_z ?? 0 }
        : trackAt(track, track.deathTick);
  }

  const { shots, damages } = joinShotsAndDamages(p.shots, p.damages, rate, {
    position(id, tick) {
      const track = trackById.get(id);
      if (!track) {
        return null;
      }
      const row = track.rows[Math.max(0, upperBound(track.ticks, tick) - 1)];
      return { ...trackAt(track, tick), ducked: !!row.ducked };
    },
    team: teamOfPlayer,
  });
  for (const damage of damages) {
    trackById.get(damage.victimId)?.hurt.push(damage);
  }

  const indexedKills: IndexedKill[] = [];
  for (const kill of kills) {
    const victim = idOf(kill.victim);
    if (!victim) {
      continue;
    }
    const track = trackById.get(victim);
    const at =
      kill.victim_x != null && kill.victim_y != null
        ? { x: kill.victim_x, y: kill.victim_y, z: kill.victim_z ?? 0 }
        : track
          ? trackAt(track, kill.tick)
          : null;
    if (!at) {
      continue;
    }
    indexedKills.push({
      key: `k${kill.tick}-${victim}`,
      tick: kill.tick,
      killerId: idOf(kill.killer),
      victimId: victim,
      team: teamOf(kill.victim_team) ?? track?.team ?? "ct",
      headshot: !!kill.headshot,
      weapon: kill.weapon ?? null,
      at,
    });
  }

  const realFlashes = Array.isArray(blob.flashes);
  for (const flash of [...p.flashes].sort((a, b) => a.tick - b.tick)) {
    trackById.get(String(flash.attacked_steam_id))?.flashes.push(flash);
  }

  const { grenades, smokes, blasts, flashBangs } = buildGrenades(
    round,
    p,
    index,
    teamOfPlayer,
  );

  const infernos: IndexedInferno[] = [];
  const claimedFires = new Set<number>();
  for (const inferno of p.infernos) {
    const fires = (inferno.fires ?? []).map((f) => ({
      x: f.x,
      y: f.y,
      z: f.z,
      s: f.s,
      e: f.e,
      seed: hash01(f.x, f.y),
    }));
    let end = inferno.end_tick ?? inferno.start_tick;
    for (const f of fires) {
      end = Math.max(end, f.e);
    }
    const team =
      teamOf(inferno.thrower_team) ?? teamOfPlayer(inferno.thrower) ?? "t";
    infernos.push({
      key: `inf${inferno.id}`,
      gid: infernoGid(inferno, grenades, rate, claimedFires),
      team,
      type: team === "ct" ? "incendiary" : "molotov",
      startTick: inferno.start_tick,
      endTick: end,
      fires,
    });
  }

  for (const bomb of p.bombs) {
    if (bomb.type === "exploded") {
      const plant = p.bombs.find((b) => b.type === "planted");
      const at = bomb.x || bomb.y ? bomb : plant?.x || plant?.y ? plant : null;
      if (at) {
        blasts.push({
          x: at.x ?? 0,
          y: at.y ?? 0,
          z: at.z ?? 0,
          tick: bomb.tick,
          radius: C4_BLAST_RADIUS,
        });
      }
    }
  }

  return {
    round,
    range,
    rate,
    tracks,
    trackById,
    shots,
    shotTicks: Float64Array.from(shots, (s) => s.tick),
    damages,
    damageTicks: Float64Array.from(damages, (d) => d.tick),
    kills: indexedKills,
    grenades,
    smokes,
    infernos,
    blasts,
    bombs: [...p.bombs].sort((a, b) => a.tick - b.tick),
    flashBangs,
    realFlashes,
    kitDrops: indexKitDrops(round, p.kitDrops, tracks),
  };
}

/**
 * The molotov an inferno came from: the inferno's own id never matches the
 * grenade's, so the one that went off when it caught, nearest in time, from
 * the same thrower when the inferno says who.
 */
function infernoGid(
  inferno: Inferno,
  grenades: IndexedGrenade[],
  rate: number,
  claimed: Set<number>,
) {
  const first = inferno.fires?.[0];
  let best: number | null = null;
  let bestScore = Infinity;
  for (const g of grenades) {
    if (
      (g.type !== "molotov" && g.type !== "incendiary") ||
      !g.detonated ||
      g.endTick === null ||
      g.gid < 0 ||
      claimed.has(g.gid)
    ) {
      continue;
    }
    const dt = Math.abs(g.endTick - inferno.start_tick);
    if (dt > rate) {
      continue;
    }
    const dist = first ? Math.hypot(g.at.x - first.x, g.at.y - first.y) : 0;
    if (dist > 600) {
      continue;
    }
    const score = dt + dist / 50;
    if (score < bestScore) {
      bestScore = score;
      best = g.gid;
    }
  }
  if (best !== null) {
    claimed.add(best);
  }
  return best;
}

/** How near a CT has to come to a kit to have picked it up. */
const KIT_PICKUP_RANGE = 96;

/**
 * Dropped kits for the round. The parser records no kit pickups: a CT who
 * gains a kit while standing on one picked it up.
 */
function indexKitDrops(
  round: number,
  drops: KitDropRow[],
  tracks: Track[],
): IndexedKitDrop[] {
  const out: IndexedKitDrop[] = [];
  const taken = new Set<string>();
  for (const drop of [...drops].sort((a, b) => a.tick - b.tick)) {
    let pickupTick: number | null = null;
    for (const track of tracks) {
      if (track.team !== "ct" || track.id === String(drop.player ?? "")) {
        continue;
      }
      const rows = track.rows;
      for (
        let i = Math.max(1, upperBound(track.ticks, drop.tick));
        i < rows.length;
        i++
      ) {
        const row = rows[i];
        if (!row.alive || !row.has_defuser || rows[i - 1].has_defuser) {
          continue;
        }
        const key = `${track.id}:${row.tick}`;
        if (
          !taken.has(key) &&
          Math.hypot(row.x - drop.x, row.y - drop.y) <= KIT_PICKUP_RANGE &&
          (pickupTick === null || row.tick < pickupTick)
        ) {
          pickupTick = row.tick;
          taken.add(key);
        }
        break;
      }
    }
    out.push({
      key: `kit${round}-${drop.tick}-${drop.player ?? out.length}`,
      tick: drop.tick,
      x: drop.x,
      y: drop.y,
      z: drop.z,
      pickupTick,
    });
  }
  return out;
}

/** Breaks a walk: a gap in the samples this long, or a jump this far. */
const TRAIL_GAP_SECS = 2.5;
const TRAIL_JUMP = 1800;
/** Samples closer than this to the last point kept are dropped. */
const TRAIL_STEP = 12;
const TRAIL_LIFT = 3;

/**
 * Everyone's walk this round as polylines, once: alive samples only, broken
 * at gaps and teleports, ending where they died. Times are seconds after
 * freeze time, the frame's own clock.
 */
export function roundTrails(index: RoundIndex): StageTrails {
  if (index.trails) {
    return index.trails;
  }
  const rate = index.rate;
  const zero = index.range.freezeEndTick;
  const points: number[] = [];
  const strips: StageTrails["strips"] = [];
  for (const track of index.tracks) {
    let start = points.length / 4;
    let lastTick = -Infinity;
    let lastX = 0;
    let lastY = 0;
    let lastZ = 0;
    // The last sample skipped as too close, kept if the walk then moves on
    // after a pause, so the trail does not creep forward while they stand.
    let held: PositionRow | null = null;
    const push = (x: number, y: number, z: number, tick: number) => {
      points.push(x, y, z + TRAIL_LIFT, (tick - zero) / rate);
      lastTick = tick;
      lastX = x;
      lastY = y;
      lastZ = z;
    };
    const flush = () => {
      const count = points.length / 4 - start;
      if (count >= 2) {
        strips.push({ id: track.id, team: track.team, start, count });
      } else {
        points.length = start * 4;
      }
      start = points.length / 4;
      lastTick = -Infinity;
      held = null;
    };
    for (const row of track.rows) {
      if (track.deathTick !== null && row.tick >= track.deathTick) {
        break;
      }
      if (!row.alive) {
        flush();
        continue;
      }
      if (lastTick > -Infinity) {
        const jump = Math.hypot(row.x - lastX, row.y - lastY);
        const gap = row.tick - (held?.tick ?? lastTick);
        if (gap > TRAIL_GAP_SECS * rate || jump > TRAIL_JUMP) {
          flush();
        } else if (jump < TRAIL_STEP && Math.abs(row.z - lastZ) < TRAIL_STEP) {
          held = row;
          continue;
        }
      }
      if (held && (row.tick - lastTick) / rate > 0.5) {
        push(held.x, held.y, held.z, held.tick);
      }
      held = null;
      push(row.x, row.y, row.z, row.tick);
    }
    if (held && lastTick > -Infinity) {
      const last: PositionRow = held;
      push(last.x, last.y, last.z, last.tick);
    }
    if (track.deathTick !== null && track.deathAt && lastTick > -Infinity) {
      push(track.deathAt.x, track.deathAt.y, track.deathAt.z, track.deathTick);
    }
    flush();
  }
  index.trails = { points: Float32Array.from(points), strips };
  return index.trails;
}

function buildTracks(positions: PositionRow[]): Track[] {
  const byId = new Map<string, PositionRow[]>();
  for (const row of positions) {
    if (!row.attacker_steam_id) {
      continue;
    }
    const id = String(row.attacker_steam_id);
    let rows = byId.get(id);
    if (!rows) {
      rows = [];
      byId.set(id, rows);
    }
    rows.push(row);
  }
  const tracks: Track[] = [];
  for (const [id, raw] of byId) {
    raw.sort((a, b) => a.tick - b.tick);
    const rows: PositionRow[] = [];
    for (const row of raw) {
      if (rows.length && rows[rows.length - 1].tick === row.tick) {
        continue;
      }
      rows.push(row);
    }
    let team: StageTeam | null = null;
    let deathTick: number | null = null;
    let wasAlive = false;
    for (const row of rows) {
      team = teamOf(row.attacker_team) ?? team;
      if (row.alive) {
        wasAlive = true;
      } else if (deathTick === null && (wasAlive || row === rows[0])) {
        deathTick = row.tick;
      }
    }
    if (!team) {
      continue;
    }
    tracks.push({
      id,
      team,
      ticks: Float64Array.from(rows, (r) => r.tick),
      rows,
      deathTick,
      deathAt: null,
      hurt: [],
      flashes: [],
    });
  }
  return tracks;
}

/** Damage that never came out of a barrel. */
const NOT_BULLETS = new Set([
  "hegrenade",
  "inferno",
  "molotov",
  "incgrenade",
  "flashbang",
  "smokegrenade",
  "decoy",
  "c4",
  "world",
]);

/** Height above the feet each hit group sits at (the parser's `hitGroupHeight`). */
function hitGroupHeight(
  hitgroup: number | null | undefined,
  headshot: boolean,
) {
  switch (hitgroup || (headshot ? 1 : 2)) {
    case 1:
      return 68;
    case 3:
      return 44;
    case 6:
    case 7:
      return 22;
    default:
      return 55;
  }
}

/**
 * Pairs every damage with the bullet that dealt it.
 *
 * Bullets are hitscan, so a damage lands on the tick its round was fired: the
 * attacker's unclaimed shot on that tick, else their latest within 250ms.
 * The blob's own `result` cannot be trusted for this. The parser credits each
 * damage to the oldest unclaimed shot in the window (damages.go
 * `claimShotForDamage`), but PlayerHurt arrives before WeaponFire on the same
 * tick, so it marks the round before the real one, or nothing at all.
 *
 * That pairing is still replayed, because for blobs older than `hitgroup` the
 * shot it marked is the only record of a headshot, and its `impact_*` is the
 * victim's body point for that damage.
 */
export function joinShotsAndDamages(
  shotRows: ShotRow[],
  damageRows: DamageRow[],
  rate: number,
  players: {
    position(id: string, tick: number): (Vec3 & { ducked?: boolean }) | null;
    team(id: string): StageTeam | null;
  },
) {
  const positionOf = players.position;
  const window = SHOT_CLAIM_SECS * rate;
  const sorted = [...shotRows].sort((a, b) => a.tick - b.tick);
  // Rounds with nowhere to start from (no eye, no shooter on the map) still
  // take part in the pairing, but are not drawn.
  const placed = new Uint8Array(sorted.length);
  const shots: IndexedShot[] = sorted.map((s, i) => {
    const shooterId = String(s.attacker_steam_id ?? "");
    const eye =
      s.eye_x != null && s.eye_y != null && s.eye_z != null
        ? { x: s.eye_x, y: s.eye_y, z: s.eye_z }
        : null;
    const from = eye ?? lift(positionOf(shooterId, s.tick), 64);
    placed[i] = from ? 1 : 0;
    let to: Vec3 | null =
      s.miss_x != null && s.miss_y != null && s.miss_z != null
        ? { x: s.miss_x, y: s.miss_y, z: s.miss_z }
        : null;
    if (!to && from && s.yaw != null) {
      const yaw = (s.yaw * Math.PI) / 180;
      const pitch = ((s.pitch ?? 0) * Math.PI) / 180;
      const c = Math.cos(pitch);
      to = {
        x: from.x + c * Math.cos(yaw) * MISS_RANGE,
        y: from.y + c * Math.sin(yaw) * MISS_RANGE,
        z: from.z - Math.sin(pitch) * MISS_RANGE,
      };
    }
    return {
      key: `s${s.tick}-${i}`,
      tick: s.tick,
      shooterId,
      team: teamOf(s.attacker_team) ?? players.team(shooterId) ?? "t",
      weapon: s.with ?? "",
      from: from ?? { x: 0, y: 0, z: 0 },
      to: to ?? from ?? { x: 0, y: 0, z: 0 },
      hit: false,
      headshot: false,
      victimId: null,
      damage: null,
    };
  });

  const byShooter = new Map<string, number[]>();
  const marked = new Map<string, number[]>();
  sorted.forEach((s, i) => {
    const id = shots[i].shooterId;
    let all = byShooter.get(id);
    if (!all) {
      all = [];
      byShooter.set(id, all);
    }
    all.push(i);
    if (s.result) {
      let queue = marked.get(id);
      if (!queue) {
        queue = [];
        marked.set(id, queue);
      }
      queue.push(i);
    }
  });
  const claimed = new Uint8Array(shots.length);

  const bulletFor = (attackerId: string, tick: number) => {
    const all = byShooter.get(attackerId);
    if (!all) {
      return -1;
    }
    let sameTick = false;
    for (let j = all.length - 1; j >= 0; j--) {
      const shot = shots[all[j]];
      if (shot.tick > tick) {
        continue;
      }
      if (shot.tick === tick) {
        sameTick = true;
      } else if (sameTick || tick - shot.tick > window) {
        // A second victim of one bullet does not steal an earlier miss.
        return -1;
      }
      if (!claimed[all[j]]) {
        return all[j];
      }
    }
    return -1;
  };

  const rows = damageRows
    .map((d, i) => ({ d, i, tick: Number(d.time) }))
    .filter((r) => Number.isFinite(r.tick) && r.d.attacked_steam_id)
    .sort((a, b) => a.tick - b.tick || a.i - b.i);
  const damages: IndexedDamage[] = [];
  rows.forEach(({ d, tick }, i) => {
    const attackerId = d.attacker_steam_id ? String(d.attacker_steam_id) : null;
    const victimId = String(d.attacked_steam_id);

    let parserShot: ShotRow | null = null;
    const queue = attackerId ? marked.get(attackerId) : undefined;
    if (queue) {
      while (queue.length && tick - sorted[queue[0]].tick > window) {
        queue.shift();
      }
      if (queue.length && sorted[queue[0]].tick <= tick) {
        parserShot = sorted[queue.shift()!];
      }
    }
    const headshot = d.hitgroup
      ? d.hitgroup === 1
      : parserShot?.result === "headshot";
    const victim = positionOf(victimId, tick);

    const weapon = d.weapon ?? null;
    const index =
      attackerId && !(weapon && NOT_BULLETS.has(weapon))
        ? bulletFor(attackerId, tick)
        : -1;
    if (index >= 0) {
      claimed[index] = 1;
      const shot = shots[index];
      shot.hit = true;
      shot.headshot = headshot;
      shot.victimId = victimId;
      shot.damage = d.damage;
      if (
        parserShot?.impact_x != null &&
        parserShot.impact_y != null &&
        parserShot.impact_z != null
      ) {
        shot.to = {
          x: parserShot.impact_x,
          y: parserShot.impact_y,
          z: parserShot.impact_z,
        };
      } else if (victim) {
        shot.to = bodyPoint(victim, d.hitgroup, headshot, shot.from);
      }
    }
    const at = victim
      ? { x: victim.x, y: victim.y, z: victim.z }
      : index >= 0 && placed[index]
        ? shots[index].to
        : null;
    if (!at) {
      return;
    }
    damages.push({
      key: `d${tick}-${i}`,
      tick,
      attackerId,
      victimId,
      amount: d.damage,
      healthAfter: Math.max(0, d.health ?? 0),
      headshot,
      weapon: weapon ?? (index >= 0 ? shots[index].weapon : null),
      at,
    });
  });
  return { shots: shots.filter((_, i) => placed[i]), damages };
}

/**
 * Where a round met the victim: their body at the hit group's height, on the
 * near side (the parser's `impactPoint`).
 */
function bodyPoint(
  victim: Vec3 & { ducked?: boolean },
  hitgroup: number | null | undefined,
  headshot: boolean,
  from: Vec3,
): Vec3 {
  const height =
    hitGroupHeight(hitgroup, headshot) * (victim.ducked ? 0.72 : 1);
  const x = victim.x;
  const y = victim.y;
  const z = victim.z + height;
  const dx = from.x - x;
  const dy = from.y - y;
  const dz = from.z - z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 1) {
    return { x, y, z };
  }
  return {
    x: x + (dx / dist) * 16,
    y: y + (dy / dist) * 16,
    z: z + (dz / dist) * 16,
  };
}

function lift(p: Vec3 | null, dz: number): Vec3 | null {
  return p ? { x: p.x, y: p.y, z: p.z + dz } : null;
}

function buildGrenades(
  round: number,
  p: Partition,
  index: BlobIndex,
  teamOfPlayer: (id: string | number | null | undefined) => StageTeam | null,
) {
  const rate = index.rate;
  const rows = [...p.grenades].sort((a, b) => a.tick - b.tick);
  const throws = rows.filter((g) => g.phase === "thrown");
  const dets = rows.filter((g) => g.phase === "detonated");
  const gidOf = (g: GrenadeRow) =>
    g.grenade_id == null || g.grenade_id === "" ? null : Number(g.grenade_id);

  const pairs = new Map<GrenadeRow, GrenadeRow | null>();
  const claimed = new Set<GrenadeRow>();
  const detByGid = new Map<number, GrenadeRow>();
  for (const det of dets) {
    const gid = gidOf(det);
    if (gid !== null) {
      detByGid.set(gid, det);
    }
  }
  for (const thr of throws) {
    const gid = gidOf(thr);
    const det = gid !== null ? detByGid.get(gid) : undefined;
    if (det && !claimed.has(det)) {
      pairs.set(thr, det);
      claimed.add(det);
    }
  }
  // Older blobs without ids: the soonest same-type detonation in reach,
  // preferring one from the same thrower.
  for (const thr of throws) {
    if (pairs.has(thr)) {
      continue;
    }
    let best: GrenadeRow | null = null;
    let bestScore = Infinity;
    for (const det of dets) {
      if (claimed.has(det) || det.type !== thr.type || det.tick < thr.tick) {
        continue;
      }
      if ((det.x - thr.x) ** 2 + (det.y - thr.y) ** 2 > MAX_FLIGHT_DIST ** 2) {
        continue;
      }
      const same =
        !!thr.thrower_steam_id &&
        String(thr.thrower_steam_id) === String(det.thrower_steam_id);
      const score = det.tick - thr.tick - (same ? 1e6 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = det;
      }
    }
    pairs.set(thr, best);
    if (best) {
      claimed.add(best);
    }
  }

  const grenades: IndexedGrenade[] = [];
  const smokes: IndexedSmoke[] = [];
  const blasts: IndexedBlast[] = [];
  const flashBangs: Array<Vec3 & { tick: number }> = [];

  const volumesByGid = new Map<number, SmokeVolume>();
  for (const v of p.volumes) {
    if (v.gid != null) {
      volumesByGid.set(Number(v.gid), v);
    }
  }
  const smokeGids = new Set<number>();
  for (const det of dets) {
    const gid = gidOf(det);
    if (gid !== null && det.type.toLowerCase() === "smoke") {
      smokeGids.add(gid);
    }
  }
  const usedVoxels = new Set<SmokeVoxelRow>();
  // By id, else the unclaimed grid popped with it whose centre (Valve's box is
  // centred on the detonation) is nearest: two smokes can pop together.
  const findVoxels = (gid: number | null, tick: number, at: Vec3) => {
    let best: SmokeVoxelRow | null = null;
    let bestDist = Infinity;
    for (const v of p.voxels) {
      if (v.gid != null && gid !== null && Number(v.gid) === gid) {
        usedVoxels.add(v);
        return v;
      }
      if (
        usedVoxels.has(v) ||
        (v.gid != null && (gid !== null || smokeGids.has(Number(v.gid)))) ||
        Math.abs(v.start_tick - tick) > 32
      ) {
        continue;
      }
      const half = v.vs / 2;
      const dist = Math.hypot(
        v.ox + v.dx * half - at.x,
        v.oy + v.dy * half - at.y,
        v.oz + v.dz * half - at.z,
      );
      if (dist < bestDist && dist <= Math.max(v.dx, v.dy, v.dz) * v.vs) {
        best = v;
        bestDist = dist;
      }
    }
    if (best) {
      usedVoxels.add(best);
    }
    return best;
  };
  const findVolume = (gid: number | null, tick: number) =>
    (gid !== null ? volumesByGid.get(gid) : undefined) ??
    p.volumes.find(
      (v) => v.gid == null && Math.abs(v.start_tick - tick) <= 32,
    ) ??
    null;

  // Some demos log a flash going off twice, once without its id: the copy
  // would burst a second time on the same spot.
  const echoes = (det: GrenadeRow) => {
    for (const other of claimed) {
      if (
        other.type === det.type &&
        Math.abs(other.tick - det.tick) <= 2 &&
        (other.x - det.x) ** 2 + (other.y - det.y) ** 2 <= 32 ** 2
      ) {
        return true;
      }
    }
    return false;
  };
  const entries: Array<[GrenadeRow | null, GrenadeRow | null]> = [
    ...throws.map(
      (thr) => [thr, pairs.get(thr) ?? null] as [GrenadeRow, GrenadeRow | null],
    ),
    ...dets
      .filter((det) => !claimed.has(det) && !echoes(det))
      .map((det) => [null, det] as [null, GrenadeRow]),
  ];
  let seq = 0;
  for (const [thr, det] of entries) {
    const any = (thr ?? det)!;
    const team =
      teamOf(thr?.thrower_team) ??
      teamOf(det?.thrower_team) ??
      teamOfPlayer(thr?.thrower_steam_id ?? det?.thrower_steam_id) ??
      "t";
    const type = grenadeType(any.type, team);
    if (!type) {
      continue;
    }
    const gid = gidOf(any) ?? -++seq;
    const trajectory = gid >= 0 ? index.trajectories.get(gid) : undefined;
    const at = detonationPoint(thr, det, trajectory);
    const endTick =
      det?.tick ?? (trajectory ? trajectory[trajectory.length - 1].t : null);
    const throwTick = thr?.tick ?? null;
    grenades.push({
      key: `g${round}-${gid}`,
      gid,
      type,
      team,
      throwTick,
      endTick,
      detonated: !!det,
      path:
        throwTick !== null && endTick !== null && endTick > throwTick
          ? flightPath(thr!, endTick, at, trajectory)
          : null,
      at,
    });
    if (!det) {
      continue;
    }
    if (type === "smoke") {
      const volume = findVolume(gidOf(det), det.tick);
      const voxelRow = findVoxels(gidOf(det), det.tick, at);
      const end =
        voxelRow?.end_tick ??
        volume?.end_tick ??
        det.tick + SMOKE_FALLBACK_SECS * rate;
      smokes.push({
        key: `smoke${round}-${gid}`,
        gid: gid >= 0 ? gid : null,
        team,
        tick: det.tick,
        endTick: end,
        // Nothing puts a smoke out early: an end this soon is the round ending.
        expireTick:
          end - det.tick >= SMOKE_MIN_SECS * rate
            ? end
            : det.tick + SMOKE_FALLBACK_SECS * rate,
        at,
        volume,
        voxelRow,
        voxels: undefined,
      });
    } else if (type === "he") {
      blasts.push({ ...at, tick: det.tick, radius: HE_BLAST_RADIUS });
    } else if (type === "flash") {
      flashBangs.push({ ...at, tick: det.tick });
    }
  }
  return { grenades, smokes, blasts, flashBangs };
}

/**
 * Where it went off. Source 2 sometimes leaves a detonation at the origin or
 * on a stale spot, so the recorded flight and then the throw stand in.
 */
function detonationPoint(
  thr: GrenadeRow | null,
  det: GrenadeRow | null,
  trajectory: Array<{ t: number; x: number; y: number; z: number }> | undefined,
): Vec3 {
  const fromTrajectory = () => {
    if (!trajectory) {
      return null;
    }
    const at = det
      ? sampleTrajectory(trajectory, det.tick)
      : trajectory[trajectory.length - 1];
    return { x: at.x, y: at.y, z: at.z };
  };
  if (det && !(det.x === 0 && det.y === 0)) {
    const far =
      thr && (det.x - thr.x) ** 2 + (det.y - thr.y) ** 2 > MAX_FLIGHT_DIST ** 2;
    if (!far) {
      return { x: det.x, y: det.y, z: det.z };
    }
  }
  return (
    fromTrajectory() ??
    (thr
      ? { x: thr.x, y: thr.y, z: thr.z }
      : { x: det!.x, y: det!.y, z: det!.z })
  );
}

function sampleTrajectory(
  pts: Array<{ t: number; x: number; y: number; z: number }>,
  tick: number,
) {
  if (tick <= pts[0].t) {
    return pts[0];
  }
  const last = pts[pts.length - 1];
  if (tick >= last.t) {
    return last;
  }
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].t <= tick) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const a = pts[lo];
  const b = pts[hi];
  const k = (tick - a.t) / Math.max(1e-6, b.t - a.t);
  return {
    t: tick,
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    z: a.z + (b.z - a.z) * k,
  };
}

/**
 * The flight from release to detonation, resampled every two ticks (the
 * recorder's own rate) so `progress` maps linearly onto the array.
 */
function flightPath(
  thr: GrenadeRow,
  endTick: number,
  at: Vec3,
  trajectory: Array<{ t: number; x: number; y: number; z: number }> | undefined,
): Vec3[] {
  const start = thr.tick;
  if (!trajectory) {
    return [
      { x: thr.x, y: thr.y, z: thr.z },
      { x: at.x, y: at.y, z: at.z },
    ];
  }
  const pts = trajectory.filter((pt) => pt.t <= endTick);
  if (!pts.length || pts[0].t > start) {
    pts.unshift({ t: start, x: thr.x, y: thr.y, z: thr.z });
  }
  if (pts[pts.length - 1].t < endTick) {
    pts.push({ t: endTick, ...at });
  }
  const steps = Math.max(1, Math.round((endTick - start) / 2));
  const path: Vec3[] = [];
  for (let i = 0; i <= steps; i++) {
    const pt = sampleTrajectory(pts, start + ((endTick - start) * i) / steps);
    path.push({ x: pt.x, y: pt.y, z: pt.z });
  }
  return path;
}
