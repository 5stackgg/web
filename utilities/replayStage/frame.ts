import {
  decodeSmokeVoxels,
  indexedRounds,
  lerpAngle,
  lowerBound,
  playerNames,
  roundIndex,
  roundTrails,
  upperBound,
} from "./frameIndex";
import type { RoundIndex, RoundRange, StageBlob, Track } from "./frameIndex";
import { visionPast } from "./visionFrame";
import {
  BLAST_SECS,
  DECOY_SECS,
  DETONATION_SECS,
  FLAME_DIE_SECS,
  FLAME_IGNITE_SECS,
  INFERNO_BURN_SECS,
} from "./grenadeEffects";
import type {
  StageBomb,
  StageBombAction,
  StageFlame,
  StageFrame,
  StageGrenadeType,
  StageGroundItem,
  StageHeatPoint,
  StagePlayer,
  StageTeam,
  StageThrowPath,
  Vec3,
} from "./types";

/**
 * The replay blob → what the stage draws at one moment. Pure: the same
 * (blob, round, tick) always gives the same frame, so scrubbing, pausing and
 * stepping back need nothing special. The first call for a round indexes it;
 * after that a frame costs what is on screen.
 */

export type StageFrameOptions = {
  /** Display names by steam id; the blob's own names fill the gaps. */
  names?: ReadonlyMap<string, string> | Record<string, string>;
  avatars?: ReadonlyMap<string, string | null> | Record<string, string | null>;
  /** 1-5 per steam id, handed to players drawn without a portrait. */
  slots?: ReadonlyMap<string, number> | Record<string, number>;
  selectedId?: string | null;
  /**
   * Utility types to draw; one set false is left out everywhere: in flight,
   * going off, burning, on the heatmap, and its timer.
   */
  utility?: Partial<Record<StageGrenadeType, boolean>>;
  /**
   * Grenades picked in the viewer, by id. They are drawn with their whole
   * flight, and while any are picked the rest of the round's utility is not.
   */
  selectedGids?: ReadonlySet<number> | readonly number[] | null;
  /** Every detonation of the round as a disc on the floor. */
  heatmap?: boolean;
  /** Everyone's walk so far this round. */
  trails?: boolean;
  /** Off: the dead leave the frame, and their mark the floor, once the death has played. */
  deaths?: boolean;
  /** The bomb lying loose or planted. */
  groundBomb?: boolean;
  /** Kits dropped by dead CTs. */
  groundKits?: boolean;
  callouts?: boolean;
  /** The storey in view on a stacked map, source-unit z; players off it dim. */
  levelBand?: { min: number; max: number } | null;
  /** Fog of war and who sees whom. */
  vision?: boolean;
  /**
   * Whose sight the fog shows. Unset, the followed player's side, or both
   * sides while nobody is followed.
   */
  visionSide?: StageTeam | "both" | null;
  /** The C4's damage zones while it is planted ("Blast radius"). */
  blastZones?: boolean;
};

export type StageRound = RoundRange;

/** How long things stay in a frame after they happen, seconds. */
const SHOT_SECS = 1;
const DAMAGE_SECS = 2;
const HURT_SECS = 1.5;
/**
 * Planted to bomb_exploded in CS2 demos: the 40s mp_c4timer plus the second
 * the event lands after it (41.00s on every explosion measured).
 */
export const C4_SECS = 41;
/** CS2 keeps the screen fully white until this much of a flash is left. */
const FLASH_FULL_SECS = 3;
/**
 * With deaths hidden, how long the dead stay: their fall, the shots that
 * killed them and the portrait fading out all play first.
 */
const DEATH_BEAT_SECS = 1;

export function stageRounds(blob: StageBlob): StageRound[] {
  return indexedRounds(blob);
}

/** The tick `seconds` after the round went live (freeze time is negative). */
export function roundTick(blob: StageBlob, round: number, seconds: number) {
  const range = roundIndex(blob, round)?.range;
  const rate = blob.tick_rate || 64;
  return (range ? range.freezeEndTick : 0) + seconds * rate;
}

function lookup<T>(
  from: ReadonlyMap<string, T> | Record<string, T> | undefined,
  id: string,
): T | undefined {
  if (!from) {
    return undefined;
  }
  return from instanceof Map ? from.get(id) : (from as Record<string, T>)[id];
}

export function buildStageFrame(
  blob: StageBlob,
  round: number,
  tick: number,
  options: StageFrameOptions = {},
): StageFrame {
  const index = roundIndex(blob, round);
  const rate = blob.tick_rate || 64;
  const frame: StageFrame = {
    time: index ? (tick - index.range.freezeEndTick) / rate : 0,
    tick,
    tickRate: rate,
    players: [],
    shots: [],
    damages: [],
    kills: [],
    projectiles: [],
    detonations: [],
    smokes: [],
    infernos: [],
    blasts: [],
    bomb: null,
  };
  if (!index) {
    return frame;
  }
  const ago = (at: number) => (tick - at) / rate;
  const typeShown = (type: StageGrenadeType) =>
    options.utility?.[type] !== false;
  const picked = options.selectedGids;
  const isPicked = (gid: number | null) =>
    gid !== null &&
    !!picked &&
    ("has" in picked ? picked.has(gid) : picked.includes(gid));
  // While grenades of this round are picked, only theirs is drawn. Picks
  // outlive the round they were made in.
  let focus = false;
  if (picked && ("size" in picked ? picked.size : picked.length) > 0) {
    for (const g of index.grenades) {
      if (isPicked(g.gid)) {
        focus = true;
        break;
      }
    }
  }
  const shown = (type: StageGrenadeType, gid: number | null) =>
    typeShown(type) && (!focus || isPicked(gid));

  const bomb = bombState(index, tick);
  const blobNames = playerNames(blob);
  const actions = bombActions(index, tick);
  for (const track of index.tracks) {
    const player = playerAt(
      index,
      track,
      tick,
      bomb.carrier,
      options,
      blobNames,
    );
    if (player.alive && actions.has(player.id)) {
      player.bombAction = actions.get(player.id);
    }
    if (
      options.deaths === false &&
      player.diedAge !== null &&
      player.diedAge > DEATH_BEAT_SECS
    ) {
      continue;
    }
    frame.players.push(player);
  }

  for (
    let i = lowerBound(index.shotTicks, tick - SHOT_SECS * rate);
    i < index.shots.length && index.shots[i].tick <= tick;
    i++
  ) {
    const s = index.shots[i];
    frame.shots.push({
      key: s.key,
      team: s.team,
      shooterId: s.shooterId,
      weapon: s.weapon,
      from: s.from,
      to: s.to,
      hit: s.hit,
      headshot: s.headshot,
      victimId: s.victimId,
      damage: s.damage,
      age: ago(s.tick),
    });
  }

  for (
    let i = lowerBound(index.damageTicks, tick - DAMAGE_SECS * rate);
    i < index.damages.length && index.damages[i].tick <= tick;
    i++
  ) {
    const d = index.damages[i];
    frame.damages.push({
      key: d.key,
      attackerId: d.attackerId,
      victimId: d.victimId,
      amount: d.amount,
      healthAfter: d.healthAfter,
      headshot: d.headshot,
      weapon: d.weapon,
      at: d.at,
      age: ago(d.tick),
    });
  }

  for (const k of index.kills) {
    if (k.tick > tick) {
      break;
    }
    frame.kills.push({
      key: k.key,
      killerId: k.killerId,
      victimId: k.victimId,
      team: k.team,
      headshot: k.headshot,
      weapon: k.weapon,
      at: k.at,
      age: ago(k.tick),
    });
  }

  for (const g of index.grenades) {
    if (!shown(g.type, g.gid)) {
      continue;
    }
    if (
      g.path &&
      g.throwTick !== null &&
      g.endTick !== null &&
      tick >= g.throwTick &&
      tick < g.endTick
    ) {
      frame.projectiles.push({
        key: g.key,
        gid: g.gid,
        type: g.type,
        team: g.team,
        path: g.path,
        progress: (tick - g.throwTick) / (g.endTick - g.throwTick),
        age: ago(g.throwTick),
      });
      continue;
    }
    if (
      !g.detonated ||
      g.endTick === null ||
      tick < g.endTick ||
      (g.type !== "flash" && g.type !== "he" && g.type !== "decoy")
    ) {
      continue;
    }
    const age = ago(g.endTick);
    if (age <= (g.type === "decoy" ? DECOY_SECS : DETONATION_SECS)) {
      frame.detonations.push({
        key: g.key,
        gid: g.gid,
        type: g.type,
        team: g.team,
        at: g.at,
        age,
        // The blob records no expiry for a decoy; CS2's runs its full time.
        remaining: g.type === "decoy" ? DECOY_SECS - age : null,
      });
    }
  }

  for (const s of index.smokes) {
    if (tick < s.tick || tick > s.endTick || !shown("smoke", s.gid)) {
      continue;
    }
    if (s.voxels === undefined) {
      s.voxels = s.voxelRow ? decodeSmokeVoxels(s.voxelRow) : null;
    }
    frame.smokes.push({
      key: s.key,
      gid: s.gid,
      team: s.team,
      at: s.at,
      age: ago(s.tick),
      remaining: (s.expireTick - tick) / rate,
      voxels: s.voxels,
    });
  }

  for (const inf of index.infernos) {
    if (
      tick < inf.startTick ||
      tick > inf.endTick ||
      !shown(inf.type, inf.gid)
    ) {
      continue;
    }
    const flames: StageFlame[] = [];
    for (const f of inf.fires) {
      if (tick < f.s || tick > f.e) {
        continue;
      }
      const intensity = Math.min(
        1,
        ago(f.s) / FLAME_IGNITE_SECS,
        (f.e - tick) / rate / FLAME_DIE_SECS,
      );
      if (intensity <= 0) {
        continue;
      }
      flames.push({
        x: f.x,
        y: f.y,
        z: f.z,
        life: (tick - f.s) / Math.max(1, f.e - f.s),
        intensity,
        age: ago(f.s),
        seed: f.seed,
      });
    }
    frame.infernos.push({
      key: inf.key,
      team: inf.team,
      type: inf.type,
      flames,
      age: ago(inf.startTick),
      remaining:
        inf.endTick > inf.startTick
          ? (inf.endTick - tick) / rate
          : Math.max(0, INFERNO_BURN_SECS - ago(inf.startTick)),
    });
  }

  for (const b of index.blasts) {
    const age = ago(b.tick);
    if (age >= 0 && age < BLAST_SECS) {
      frame.blasts.push({ x: b.x, y: b.y, z: b.z, age, radius: b.radius });
    }
  }

  frame.bomb = bomb.state ? bombFrame(bomb, frame.players, index, tick) : null;

  if (options.heatmap) {
    frame.heat = heatPoints(index, typeShown, isPicked);
  }
  if (focus) {
    frame.throws = throwPaths(index, typeShown, isPicked);
  }
  if (options.trails) {
    frame.trails = roundTrails(index);
  }
  const ground: StageGroundItem[] = [];
  const b = frame.bomb;
  if (
    options.groundBomb !== false &&
    b &&
    (b.state === "dropped" || b.state === "planted" || b.state === "defusing")
  ) {
    ground.push({
      key: "bomb",
      kind: b.state === "dropped" ? "bomb" : "planted",
      at: b.at,
      age: bomb.plantTick !== null ? ago(bomb.plantTick) : b.age,
      timer: b.timer,
    });
  }
  if (options.groundKits !== false) {
    for (const kit of index.kitDrops) {
      if (kit.tick > tick) {
        break;
      }
      if (kit.pickupTick === null || tick < kit.pickupTick) {
        ground.push({ key: kit.key, kind: "kit", at: kit, age: ago(kit.tick) });
      }
    }
  }
  if (ground.length) {
    frame.ground = ground;
  }
  if (options.callouts) {
    frame.callouts = true;
  }
  if (options.levelBand) {
    frame.levelBand = options.levelBand;
  }
  if (options.vision) {
    frame.vision = visionPast(index, tick);
    frame.visionSide =
      options.visionSide ??
      frame.players.find((p) => p.selected)?.team ??
      "both";
  }
  if (options.blastZones) {
    frame.blastZones = true;
  }
  return frame;
}

/** The heatmap for one filter and pick, kept so frames of a round share it. */
const heatCache = new WeakMap<
  RoundIndex,
  { key: string; heat: StageHeatPoint[] }
>();

function heatPoints(
  index: RoundIndex,
  typeShown: (type: StageGrenadeType) => boolean,
  isPicked: (gid: number | null) => boolean,
) {
  let key = "";
  for (const g of index.grenades) {
    if (g.detonated) {
      key += typeShown(g.type) ? (isPicked(g.gid) ? "2" : "1") : "0";
    }
  }
  const hit = heatCache.get(index);
  if (hit?.key === key) {
    return hit.heat;
  }
  const heat: StageHeatPoint[] = [];
  for (const g of index.grenades) {
    if (g.detonated && typeShown(g.type)) {
      heat.push({
        key: g.key,
        gid: g.gid,
        type: g.type,
        team: g.team,
        at: g.at,
        selected: isPicked(g.gid),
      });
    }
  }
  heatCache.set(index, { key, heat });
  return heat;
}

const throwCache = new WeakMap<
  RoundIndex,
  { key: string; throws: StageThrowPath[] }
>();

function throwPaths(
  index: RoundIndex,
  typeShown: (type: StageGrenadeType) => boolean,
  isPicked: (gid: number | null) => boolean,
) {
  let key = "";
  for (const g of index.grenades) {
    if (isPicked(g.gid) && typeShown(g.type)) {
      key += `${g.gid},`;
    }
  }
  const hit = throwCache.get(index);
  if (hit?.key === key) {
    return hit.throws;
  }
  const throws: StageThrowPath[] = [];
  for (const g of index.grenades) {
    if (isPicked(g.gid) && typeShown(g.type)) {
      throws.push({
        key: g.key,
        gid: g.gid,
        type: g.type,
        team: g.team,
        path: g.path ?? [],
        at: g.at,
      });
    }
  }
  throwCache.set(index, { key, throws });
  return throws;
}

function playerAt(
  index: RoundIndex,
  track: Track,
  tick: number,
  carrier: string | null | undefined,
  options: StageFrameOptions,
  blobNames: Map<string, string>,
): StagePlayer {
  const rate = index.rate;
  const rows = track.rows;
  const i = upperBound(track.ticks, tick) - 1;
  const a = rows[Math.max(0, Math.min(rows.length - 1, i))];
  const b = i >= 0 && i < rows.length - 1 ? rows[i + 1] : a;
  const k = b === a ? 0 : (tick - a.tick) / (b.tick - a.tick);

  const dead = track.deathTick !== null && tick >= track.deathTick;
  const at = dead && track.deathAt ? track.deathAt : null;

  let health = dead ? 0 : (a.health ?? 100);
  let hurtAge: number | null = null;
  const hurt = track.hurt;
  if (hurt.length) {
    let j = hurt.length - 1;
    while (j >= 0 && hurt[j].tick > tick) {
      j--;
    }
    if (j >= 0) {
      const last = hurt[j];
      if (!dead && last.tick > a.tick) {
        health = last.healthAfter;
      }
      const age = (tick - last.tick) / rate;
      hurtAge = age <= HURT_SECS ? age : null;
    }
  }

  // A body keeps the facing it died with: the knock-back reads it.
  let yaw = lerpAngle(a.yaw ?? 0, b.yaw ?? a.yaw ?? 0, k);
  if (dead) {
    const d = upperBound(track.ticks, track.deathTick!) - 1;
    const da = rows[Math.max(0, Math.min(rows.length - 1, d))];
    const db = d >= 0 && d < rows.length - 1 ? rows[d + 1] : da;
    const dk =
      db === da ? 0 : (track.deathTick! - da.tick) / (db.tick - da.tick);
    yaw = lerpAngle(
      da.yaw ?? 0,
      db.yaw ?? da.yaw ?? 0,
      Math.min(1, Math.max(0, dk)),
    );
  }
  const x = at ? at.x : a.x + (b.x - a.x) * k;
  const y = at ? at.y : a.y + (b.y - a.y) * k;
  const id = track.id;
  return {
    id,
    name: lookup(options.names, id) || blobNames.get(id) || id,
    team: track.team,
    avatarUrl: lookup(options.avatars, id) ?? null,
    slot: lookup(options.slots, id) ?? null,
    alive: !dead,
    x,
    y,
    z: at ? at.z : a.z + (b.z - a.z) * k,
    yaw,
    pitch: (a.pitch ?? 0) + ((b.pitch ?? a.pitch ?? 0) - (a.pitch ?? 0)) * k,
    health,
    armor: a.armor ?? 0,
    helmet: !!a.helmet,
    weapon: shownWeapon(rows, Math.max(0, Math.min(rows.length - 1, i)), rate),
    hasBomb: carrier === undefined ? !!a.has_bomb : carrier === id,
    hasKit: !!a.has_defuser,
    ducked: !!a.ducked,
    blind: dead
      ? 0
      : index.realFlashes
        ? blindFromFlashes(track, tick, rate)
        : guessBlind(index, x, y, yaw, tick),
    hurtAge,
    diedAge: dead ? (tick - track.deathTick!) / rate : null,
    selected: !!options.selectedId && String(options.selectedId) === id,
    speed:
      dead || b === a
        ? 0
        : Math.hypot(b.x - a.x, b.y - a.y) / ((b.tick - a.tick) / rate),
    weaponAge: dead ? null : weaponAge(track, i, tick, rate),
  };
}

/** A weapon out for less than this between two others is a quick switch. */
const FLICK_SECS = 0.3;

/**
 * The weapon to show at row `j`: the one in hand, unless it was only out
 * for a quick switch (a q-q, a flick to the knife), when the one before it
 * stays up. Scans only a few rows either side.
 */
function shownWeapon(rows: Track["rows"], j: number, rate: number) {
  const window = FLICK_SECS * rate;
  for (let guard = 0; guard < 8 && j >= 0; guard++) {
    const held = rows[j].active_weapon ?? null;
    const same = (k: number) => (rows[k].active_weapon ?? null) === held;
    let s = j;
    while (s > 0 && same(s - 1) && rows[j].tick - rows[s - 1].tick < window) {
      s--;
    }
    let e = j;
    while (
      e < rows.length - 1 &&
      same(e + 1) &&
      rows[e + 1].tick - rows[j].tick < window
    ) {
      e++;
    }
    const flick =
      s > 0 &&
      e < rows.length - 1 &&
      !same(s - 1) &&
      !same(e + 1) &&
      rows[e + 1].tick - rows[s].tick < window;
    if (!flick) {
      return held;
    }
    j = s - 1;
  }
  return rows[Math.max(0, j)]?.active_weapon ?? null;
}

/** Seconds since the weapon shown at row `i` came up, under a second. */
function weaponAge(track: Track, i: number, tick: number, rate: number) {
  const rows = track.rows;
  if (i <= 0 || i >= rows.length) {
    return null;
  }
  const shown = shownWeapon(rows, i, rate);
  for (let j = i; j > 0 && tick - rows[j].tick < rate; j--) {
    if (shownWeapon(rows, j - 1, rate) !== shown) {
      return (tick - rows[j].tick) / rate;
    }
  }
  return null;
}

const PLANT_SECS = 3.2;
const DEFUSE_SECS = 10;
const DEFUSE_KIT_SECS = 5;

/**
 * Plants and defuses under way at `tick`, by player: from their begin
 * events to the abort, plant, defuse or explosion that ends them.
 */
function bombActions(index: RoundIndex, tick: number) {
  const open = new Map<
    string,
    { kind: "plant" | "defuse"; tick: number; kit: boolean }
  >();
  for (const b of index.bombs) {
    if (b.tick > tick) {
      break;
    }
    const id = b.player != null ? String(b.player) : null;
    switch (b.type) {
      case "plant_begin":
        if (id) {
          open.set(id, { kind: "plant", tick: b.tick, kit: false });
        }
        break;
      case "defuse_begin":
        if (id) {
          open.set(id, { kind: "defuse", tick: b.tick, kit: !!b.has_kit });
        }
        break;
      case "plant_abort":
      case "defuse_abort":
        if (id) {
          open.delete(id);
        }
        break;
      case "planted":
      case "defused":
      case "exploded":
        open.clear();
        break;
    }
  }
  const actions = new Map<string, StageBombAction>();
  for (const [id, a] of open) {
    const duration =
      a.kind === "plant" ? PLANT_SECS : a.kit ? DEFUSE_KIT_SECS : DEFUSE_SECS;
    const age = (tick - a.tick) / index.rate;
    // A begin whose end the demo lost stops a little after it would have.
    if (age <= duration + 0.5) {
      actions.set(id, { kind: a.kind, age, duration, kit: a.kit });
    }
  }
  return actions;
}

/** The demo's own flash durations, on CS2's overlay curve. */
export function blindFromFlashes(track: Track, tick: number, rate: number) {
  let blind = 0;
  for (const f of track.flashes) {
    if (f.tick > tick) {
      break;
    }
    const left = f.duration - (tick - f.tick) / rate;
    if (left <= 0) {
      continue;
    }
    const v = left >= FLASH_FULL_SECS ? 1 : (left / FLASH_FULL_SECS) ** 2;
    blind = Math.max(blind, v);
  }
  return blind;
}

const GUESS_RANGE = 1500;
const GUESS_MAX_SECS = 3.8;
const GUESS_MIN_SECS = 0.5;

/**
 * Older blobs carry no flash victims: a guess from distance and how directly
 * the player faced the bang.
 */
function guessBlind(
  index: RoundIndex,
  x: number,
  y: number,
  yaw: number,
  tick: number,
) {
  let max = 0;
  for (const f of index.flashBangs) {
    const age = (tick - f.tick) / index.rate;
    if (age < 0 || age > GUESS_MAX_SECS) {
      continue;
    }
    const dx = f.x - x;
    const dy = f.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > GUESS_RANGE) {
      continue;
    }
    const bearing = (Math.atan2(dy, dx) * 180) / Math.PI;
    const off = Math.abs(((((bearing - yaw + 540) % 360) + 360) % 360) - 180);
    if (off > 110) {
      continue;
    }
    const strength = (1 - dist / GUESS_RANGE) * (1 - off / 110);
    const total = GUESS_MIN_SECS + (GUESS_MAX_SECS - GUESS_MIN_SECS) * strength;
    if (age < total) {
      max = Math.max(max, strength * (1 - age / total));
    }
  }
  return max;
}

type BombWalk = {
  state: StageBomb["state"] | null;
  /** Who has it while carried; undefined when the events never said. */
  carrier: string | null | undefined;
  at: Vec3 | null;
  since: number;
  plantTick: number | null;
};

function bombState(index: RoundIndex, tick: number): BombWalk {
  const walk: BombWalk = {
    state: null,
    carrier: undefined,
    at: null,
    since: index.range.startTick,
    plantTick: null,
  };
  for (const b of index.bombs) {
    if (b.tick > tick) {
      break;
    }
    const at = b.x || b.y ? { x: b.x ?? 0, y: b.y ?? 0, z: b.z ?? 0 } : null;
    switch (b.type) {
      case "pickup":
        walk.state = "carried";
        walk.carrier = b.player != null ? String(b.player) : null;
        walk.since = b.tick;
        break;
      case "dropped":
        walk.state = "dropped";
        walk.carrier = null;
        walk.at = at;
        walk.since = b.tick;
        break;
      case "planted": {
        const planter =
          b.player != null ? index.trackById.get(String(b.player)) : null;
        walk.state = "planted";
        walk.carrier = null;
        walk.at = at ?? (planter ? planterAt(planter, b.tick) : walk.at);
        walk.since = b.tick;
        walk.plantTick = b.tick;
        break;
      }
      case "defuse_begin":
        walk.state = "defusing";
        walk.since = b.tick;
        break;
      case "defuse_abort":
        walk.state = "planted";
        walk.since = b.tick;
        break;
      case "defused":
      case "exploded":
        walk.state = b.type;
        walk.carrier = null;
        walk.since = b.tick;
        break;
    }
  }
  if (walk.state === null) {
    // No pickup yet this round: whoever the samples say has it.
    for (const track of index.tracks) {
      const i = Math.max(0, upperBound(track.ticks, tick) - 1);
      if (track.rows[i]?.has_bomb) {
        walk.state = "carried";
        walk.carrier = track.id;
        break;
      }
    }
  }
  return walk;
}

/** When the planted bomb goes off: the round's explosion, else the fuse. */
function bombDeadline(index: RoundIndex, plantTick: number): number {
  for (const b of index.bombs) {
    if (b.tick >= plantTick && b.type === "exploded") {
      return b.tick;
    }
  }
  return plantTick + C4_SECS * index.rate;
}

function planterAt(track: Track, tick: number): Vec3 {
  const i = Math.max(0, upperBound(track.ticks, tick) - 1);
  const row = track.rows[i];
  return { x: row.x, y: row.y, z: row.z };
}

function bombFrame(
  walk: BombWalk,
  players: StagePlayer[],
  index: RoundIndex,
  tick: number,
): StageBomb | null {
  let at = walk.at;
  if (walk.state === "carried") {
    const carrier = players.find((p) => p.id === walk.carrier);
    at = carrier ? { x: carrier.x, y: carrier.y, z: carrier.z } : null;
  }
  if (!at || !walk.state) {
    return null;
  }
  const armed = walk.state === "planted" || walk.state === "defusing";
  return {
    state: walk.state,
    at,
    age: (tick - walk.since) / index.rate,
    timer:
      armed && walk.plantTick !== null
        ? Math.max(0, (bombDeadline(index, walk.plantTick) - tick) / index.rate)
        : null,
  };
}
