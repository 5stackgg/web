import { calloutAt, humanizeCallout } from "~/utilities/mapCallouts";
import { C4_SECS } from "./frame";
import type { MapCallout } from "~/utilities/mapCallouts";
import { resolveWeapon, weaponBasename } from "~/utilities/weaponIcon";
import { roundIndex, trackAt, upperBound } from "./frameIndex";
import type { IndexedKill, RoundIndex, StageBlob, Track } from "./frameIndex";
import type { StageMap, StagePlayer, StageTeam, Vec3 } from "./types";

/**
 * Broadcast mode's director. A replay already knows how the round ends, so
 * the director plans it once, ahead of time, the way an observer who had seen
 * the round would cut it:
 *
 * 1. Stories. Every fight (shots, damage and kills close in time and space),
 *    execute (a team's utility landing together, then its entry), plant,
 *    defuse and bomb outcome is found and scored. The scoring follows the
 *    game-streamer's live director (game-streamer/src/spectator/director):
 *    the encounter priority between enemies by distance band, equipment,
 *    kills, low HP, kits and snipers, and its event bonuses (AWP and SSG
 *    kills, damage dealt, upsets); on top, what only hindsight sees: opening
 *    kills, trades, multi-kills, clutches, the round-deciding kill.
 * 2. Shots. The best stories claim the timeline first, each from a lead-in
 *    before its first shot (the peek, the setup) to a beat after its last
 *    kill. A story that happens at the same time as a better one is skipped
 *    and offered as an instant replay once the action settles. The gaps get
 *    a wide establishing shot and the closest enemy encounter, held with the
 *    streamer's dwell rules.
 * 3. Speed. Slow motion eases in before the shots that matter (sniper kills,
 *    a third kill, a clutch's last, the bomb, a last-second defuse) and out
 *    after; an optional condensed mode hurries through dead time.
 *
 * The plan is cached per round and every lookup is a pure function of the
 * tick, so scrubbing, pausing and playing back all agree.
 */

export type ShotKind =
  | "wide"
  | "standoff"
  | "duel"
  | "fight"
  | "execute"
  | "utility"
  | "plant"
  | "retake"
  | "defuse"
  | "bomb"
  | "clutch";

/** A direction to look along, source xy; `either` lets it face the other way. */
export type ShotLook = { x: number; y: number; either: boolean };

export type PlannedShot = {
  id: number;
  fromTick: number;
  toTick: number;
  kind: ShotKind;
  /** Players kept in frame (while alive, and a beat after dying). */
  subjects: string[];
  /** Fixed points kept in frame: utility landing, the bomb. */
  anchors: Vec3[];
  /** Ground radius to keep in view at the least. */
  minRadius: number;
  /** Which way to look from, in 3D. */
  look: ShotLook | null;
  /** Where it is, for its place name. */
  focus: Vec3;
  /** Who the story is about, and with what. */
  protagonist: string | null;
  weapon: string | null;
  /** Its big moment; who wins it is only named from then on. */
  keyTick: number | null;
  score: number;
};

/** A stretch played at `speed` times the viewer's own, eased at both ends. */
export type SpeedSegment = {
  /** Easing starts here... */
  fromTick: number;
  /** ...is at `speed` from here... */
  fullTick: number;
  /** ...until here... */
  holdTick: number;
  /** ...and is back to normal here. */
  toTick: number;
  speed: number;
  reason: "sniper" | "multikill" | "clutch" | "bomb" | "defuse" | "condensed";
};

/** An instant replay on offer once the action settles. */
export type DirectorReplay = {
  /** Offered when playback passes this tick. */
  offerTick: number;
  fromTick: number;
  untilTick: number;
  /** How to frame it. */
  shot: PlannedShot;
  reason: "missed" | "multikill";
};

export type RoundPlan = {
  round: number;
  rate: number;
  startTick: number;
  endTick: number;
  /** Back to back, covering the round. */
  shots: PlannedShot[];
  slowmo: SpeedSegment[];
  condensed: SpeedSegment[];
  replays: DirectorReplay[];
};

/** What the director shows, for the caption. */
export type DirectorLabel = {
  kind: ShotKind;
  place: string | null;
  /** In a clutch, how many the last player standing faces. */
  versus: number | null;
  /** The story's player and weapon ("ResQ", "awp"). */
  player: string | null;
  weapon: string | null;
  /** The story coming up next, during a wide or a standoff. */
  next: { kind: ShotKind; place: string | null } | null;
};

// --- tuning ------------------------------------------------------------------

/** The game-streamer's encounter priority, by distance between two enemies. */
const DIST_BANDS: Array<[number, number]> = [
  [300, 150],
  [600, 120],
  [1000, 80],
  [1500, 50],
  [2000, 20],
];
const STICKY_BONUS = 30;
const STICKY_BONUS_CLUTCH = 10;
const STICKY_FLOOR = 140;
/** Seconds: least time on a shot, grace after its player dies, most per phase. */
export const MIN_DWELL = 3;
const DEATH_GRACE = 0.35;
const DWELL_MAX_LIVE = 15;
const DWELL_MAX_ACTIVE = 25;
/** Event bonuses, to the player who made them, for `ttl` seconds. */
const AWP_KILL = { bonus: 200, ttl: 8 };
const SSG_KILL = { bonus: 150, ttl: 8 };
const DAMAGE_DEALER = { bonus: 40, ttl: 5, minHp: 20 };
const UPSET = { bonus: 100, ttl: 10 };
/** Fewer alive than this is a clutch for pacing. */
const CLUTCH_ALIVE = 4;

/** Kills, on top of the streamer's bonuses. */
const KILL_BASE = 100;
const OPENING_KILL = 60;
const TRADE_KILL = 50;
const TRADE_SECS = 5;
const MULTI_SECS = 8;
const MULTI_SECOND = 60;
const MULTI_MORE = 120;
const DECIDING_KILL = 100;
const CLUTCH_KILL = 80;
const CLUTCH_PER_ENEMY = 30;
const CLUTCH_WIN = 200;
const HEADSHOT = 10;

/** Combat this close in time (s) and space (u) is one fight. */
const FIGHT_GAP = 3;
const FIGHT_LINK = 1400;
const FIGHT_LINK_SHARED = 2500;
/** Utility of one team landing within this window (s) and this close (u). */
const EXECUTE_WINDOW = 5;
const EXECUTE_LINK = 1300;
const EXECUTE_MIN = 3;
const EXECUTE_PER_NADE = 45;
/** An execute's entry: a fight this soon after the last grenade, this close. */
const ENTRY_SECS = 6;
const ENTRY_LINK = 1800;
const RETAKE_LINK = 1800;

const LAST_SECOND_DEFUSE = 1.5;

/** A story worth a shot, and worth an instant replay when it was missed. */
const STORY_MIN = 60;
const REPLAY_MIN = 300;
const REPLAYS_PER_ROUND = 2;
/** The action has settled after a gap this long, seconds. */
const SETTLED_GAP = 5;
/** Seconds: lead-in before a story's first shot, at least before its key moment, beat after. */
const LEAD = 2.5;
const LEAD_MIN = 1.2;
const LINGER = 1.5;
/** Gaps this long open on a wide establishing shot this long. */
const WIDE_GAP = 7;
const WIDE_SECS = 3.5;
/** Encounter sampling, seconds. */
const STEP = 0.25;

/** Slow motion: speed, and its shape around the key tick (seconds). */
export const SLOW_SPEED = 0.35;
const SLOW_EASE_FROM = 0.55;
const SLOW_FULL = 0.2;
const SLOW_HOLD = 0.4;
const SLOW_EASE_TO = 0.75;
/** Seconds between two slow motions; the bigger moment keeps its. */
const SLOW_COOLDOWN = 6;
/** Condensed: dead time this long plays at this speed, easing over `EASE`. */
const CONDENSE_MIN = 7;
export const CONDENSE_SPEED = 2.5;
const CONDENSE_EASE = 0.6;
const CONDENSE_BEFORE = 2.5;

const SHOT_RADIUS: Record<ShotKind, number> = {
  wide: 1400,
  standoff: 520,
  duel: 480,
  fight: 620,
  execute: 850,
  utility: 850,
  plant: 650,
  retake: 900,
  defuse: 520,
  bomb: 1000,
  clutch: 560,
};

const WEAPON_PRICE: Record<string, number> = {
  awp: 4750,
  ssg08: 1700,
  scar20: 5000,
  g3sg1: 5000,
  ak47: 2700,
  m4a1: 3100,
  m4a1_silencer: 2900,
  aug: 3300,
  sg556: 3000,
  famas: 2050,
  galilar: 1800,
  m249: 5200,
  negev: 1700,
  mac10: 1050,
  mp9: 1250,
  mp7: 1500,
  mp5sd: 1500,
  ump45: 1200,
  p90: 2350,
  bizon: 1400,
  nova: 1050,
  xm1014: 2000,
  mag7: 1300,
  sawedoff: 1100,
  deagle: 700,
  revolver: 600,
  p250: 300,
  fiveseven: 500,
  tec9: 500,
  cz75a: 500,
  elite: 300,
  glock: 200,
  usp_silencer: 200,
  p2000: 200,
};
/** What a cheap gun beating one of these is an upset. */
const PREMIUM = new Set([
  "awp",
  "ssg08",
  "scar20",
  "g3sg1",
  "ak47",
  "m4a1",
  "m4a1_silencer",
  "aug",
  "sg556",
  "famas",
  "galilar",
]);
const CHEAP_MAX = 1300;

/** Names the shared weapon labels leave as the raw id. */
const WEAPON_NAMES: Record<string, string> = {
  awp: "AWP",
  glock: "Glock-18",
  famas: "FAMAS",
  aug: "AUG",
  nova: "Nova",
  xm1014: "XM1014",
  p90: "P90",
  mp9: "MP9",
  mp7: "MP7",
  m249: "M249",
  negev: "Negev",
  tec9: "Tec-9",
  p250: "P250",
  g3sg1: "G3SG1",
  inferno: "Molotov",
  molotov: "Molotov",
  knife: "Knife",
};

/** A weapon as a caption names it ("AWP", "AK-47"). */
export function weaponLabel(weapon: string) {
  const base = weaponBasename(weapon);
  return WEAPON_NAMES[base] ?? resolveWeapon(weapon).label;
}

function sniperOf(weapon: string | null | undefined) {
  const base = weaponBasename(weapon);
  return base === "awp" || base === "ssg08" ? base : null;
}

function priceOf(weapon: string | null | undefined) {
  return WEAPON_PRICE[weaponBasename(weapon)] ?? 0;
}

function xyDist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function other(team: StageTeam): StageTeam {
  return team === "ct" ? "t" : "ct";
}

function centroid(points: readonly Vec3[]): Vec3 | null {
  if (!points.length) {
    return null;
  }
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  return { x: x / points.length, y: y / points.length, z: z / points.length };
}

/** Side-on to the line from `a` to `b`: both ends stay on screen. */
function across(a: Vec3 | null, b: Vec3 | null): ShotLook | null {
  if (!a || !b) {
    return null;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  return length > 1 ? { x: -dy / length, y: dx / length, either: true } : null;
}

/** From `from` toward `to`: the camera sits behind `from`. */
function toward(from: Vec3 | null, to: Vec3 | null): ShotLook | null {
  if (!from || !to) {
    return null;
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length > 1 ? { x: dx / length, y: dy / length, either: false } : null;
}

function smoothstep(t: number) {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

// --- the round, sampled ------------------------------------------------------

type PlayerState = Vec3 & {
  id: string;
  team: StageTeam;
  alive: boolean;
  health: number;
  weapon: string | null;
  defuser: boolean;
  /** Best gun held so far plus armour: what they are worth. */
  equip: number;
  kills: number;
};

type Round = {
  index: RoundIndex;
  rate: number;
  start: number;
  end: number;
  /** Per track: the best gun's price held so far, and the gun, by row. */
  bestPrice: Map<string, Float64Array>;
  bestWeapon: Map<string, Array<string | null>>;
  kills: IndexedKill[];
  /** Alive per team after each kill, in kill order. */
  aliveAfter: Array<{ ct: number; t: number }>;
  size: { ct: number; t: number };
  /** Event bonuses per player: [fromTick, untilTick, bonus]. */
  bonuses: Map<string, Array<[number, number, number]>>;
  plantTick: number | null;
  plantAt: Vec3 | null;
};

function rowIndexOf(track: Track, tick: number) {
  return Math.max(
    0,
    Math.min(track.rows.length - 1, upperBound(track.ticks, tick) - 1),
  );
}

/** The best gun a player has had so far: what a caption names them with. */
function gunOf(round: Round, id: string | null, tick: number) {
  const track = id ? round.index.trackById.get(id) : undefined;
  if (!track) {
    return null;
  }
  const i = rowIndexOf(track, tick);
  return (
    round.bestWeapon.get(track.id)?.[i] ?? track.rows[i]?.active_weapon ?? null
  );
}

function stateOf(round: Round, track: Track, tick: number): PlayerState {
  const i = rowIndexOf(track, tick);
  const row = track.rows[i];
  const at = trackAt(track, tick);
  const alive = track.deathTick === null || tick < track.deathTick;
  const best = round.bestPrice.get(track.id)?.[i] ?? 0;
  let kills = 0;
  for (const k of round.kills) {
    if (k.tick > tick) {
      break;
    }
    if (k.killerId === track.id && k.team !== track.team) {
      kills++;
    }
  }
  return {
    id: track.id,
    team: track.team,
    x: at.x,
    y: at.y,
    z: at.z,
    alive,
    health: alive ? (row.health ?? 100) : 0,
    weapon: row.active_weapon ?? null,
    defuser: !!row.has_defuser,
    equip: best + ((row.armor ?? 0) > 0 ? (row.helmet ? 1000 : 650) : 0),
    kills,
  };
}

function statesAt(round: Round, tick: number) {
  return round.index.tracks.map((track) => stateOf(round, track, tick));
}

/** Alive per team just before kill `i` (0 = before any). */
function aliveBefore(round: Round, i: number) {
  return i === 0 ? { ...round.size } : round.aliveAfter[i - 1];
}

function aliveAt(round: Round, tick: number) {
  let i = 0;
  while (i < round.kills.length && round.kills[i].tick <= tick) {
    i++;
  }
  return aliveBefore(round, i);
}

/** The last player standing against at least one enemy at `tick`. */
function clutchAt(round: Round, tick: number) {
  const alive = aliveAt(round, tick);
  for (const team of ["ct", "t"] as const) {
    if (alive[team] === 1 && alive[other(team)] >= 1 && round.size[team] > 1) {
      const track = round.index.tracks.find(
        (t) => t.team === team && (t.deathTick === null || t.deathTick > tick),
      );
      if (track) {
        return { id: track.id, team, versus: alive[other(team)] };
      }
    }
  }
  return null;
}

function bonusAt(round: Round, id: string, tick: number) {
  let best = 0;
  for (const [from, until, bonus] of round.bonuses.get(id) ?? []) {
    if (tick >= from && tick < until) {
      best = Math.max(best, bonus);
    }
  }
  return best;
}

/** The game-streamer's priority for two enemies facing off. */
function encounterPriority(a: PlayerState, b: PlayerState) {
  const d = xyDist(a, b);
  const band = DIST_BANDS.find(([upTo]) => d < upTo);
  if (!band) {
    return null;
  }
  let priority = band[1];
  priority += (a.equip + b.equip) / 2 / 200;
  priority += ((a.kills + b.kills) / 2) * 3;
  const low = (h: number) => h > 0 && h < 50;
  const veryLow = (h: number) => h > 0 && h < 30;
  if (low(a.health) || low(b.health)) {
    priority += 10;
  }
  if (veryLow(a.health) || veryLow(b.health)) {
    priority += 10;
  }
  if (a.defuser || b.defuser) {
    priority += 20;
  }
  const snipers = [sniperOf(a.weapon), sniperOf(b.weapon)].filter(Boolean);
  if (snipers.length === 2) {
    priority += 100;
  }
  if (snipers.includes("awp")) {
    priority += 30;
  }
  return priority;
}

/** A cheap gun beating a rifle or a sniper. */
function isUpset(round: Round, k: IndexedKill) {
  if (!k.killerId || !k.weapon || priceOf(k.weapon) > CHEAP_MAX) {
    return false;
  }
  const victim = round.index.trackById.get(k.victimId);
  if (!victim) {
    return false;
  }
  const i = rowIndexOf(victim, k.tick);
  const best = round.bestPrice.get(victim.id)?.[i] ?? 0;
  return (
    PREMIUM.has(weaponBasename(victim.rows[i]?.active_weapon)) || best >= 2700
  );
}

function readRound(index: RoundIndex): Round {
  const rate = index.rate;
  const bestPrice = new Map<string, Float64Array>();
  const bestWeapon = new Map<string, Array<string | null>>();
  for (const track of index.tracks) {
    const prices = new Float64Array(track.rows.length);
    const guns: Array<string | null> = [];
    let best = 0;
    let gun: string | null = null;
    track.rows.forEach((row, i) => {
      const price = priceOf(row.active_weapon);
      if (price > best) {
        best = price;
        gun = row.active_weapon ?? null;
      }
      prices[i] = best;
      guns.push(gun);
    });
    bestPrice.set(track.id, prices);
    bestWeapon.set(track.id, guns);
  }
  const size = { ct: 0, t: 0 };
  for (const track of index.tracks) {
    size[track.team]++;
  }
  const kills = index.kills;
  const aliveAfter: Round["aliveAfter"] = [];
  const dead = new Set<string>();
  const alive = { ...size };
  for (const k of kills) {
    if (!dead.has(k.victimId)) {
      dead.add(k.victimId);
      alive[k.team] = Math.max(0, alive[k.team] - 1);
    }
    aliveAfter.push({ ...alive });
  }
  const round: Round = {
    index,
    rate,
    start: index.range.freezeEndTick,
    end: Math.max(index.range.endTick, index.range.freezeEndTick + rate),
    bestPrice,
    bestWeapon,
    kills,
    aliveAfter,
    size,
    bonuses: new Map(),
    plantTick: null,
    plantAt: null,
  };
  const give = (
    id: string | null,
    from: number,
    ttl: number,
    bonus: number,
  ) => {
    if (!id) {
      return;
    }
    let list = round.bonuses.get(id);
    if (!list) {
      list = [];
      round.bonuses.set(id, list);
    }
    list.push([from, from + ttl * rate, bonus]);
  };
  for (const k of kills) {
    const sniper = sniperOf(k.weapon);
    if (sniper === "awp") {
      give(k.killerId, k.tick, AWP_KILL.ttl, AWP_KILL.bonus);
    } else if (sniper === "ssg08") {
      give(k.killerId, k.tick, SSG_KILL.ttl, SSG_KILL.bonus);
    }
    if (isUpset(round, k)) {
      give(k.killerId, k.tick, UPSET.ttl, UPSET.bonus);
    }
  }
  for (const d of index.damages) {
    if (d.amount >= DAMAGE_DEALER.minHp) {
      give(d.attackerId, d.tick, DAMAGE_DEALER.ttl, DAMAGE_DEALER.bonus);
    }
  }
  for (const b of index.bombs) {
    if (b.type !== "planted") {
      continue;
    }
    round.plantTick = b.tick;
    round.plantAt =
      b.x || b.y ? { x: b.x ?? 0, y: b.y ?? 0, z: b.z ?? 0 } : null;
    if (!round.plantAt && b.player != null) {
      const planter = index.trackById.get(String(b.player));
      round.plantAt = planter ? trackAt(planter, b.tick) : null;
    }
  }
  return round;
}

// --- stories -----------------------------------------------------------------

type Moment = {
  tick: number;
  rank: number;
  reason: SpeedSegment["reason"];
};

type Story = {
  kind: ShotKind;
  firstTick: number;
  lastTick: number;
  /** The moment it is about: its biggest kill, the plant, the defuse. */
  keyTick: number;
  score: number;
  participants: Set<string>;
  kills: IndexedKill[];
  anchors: Vec3[];
  /** Where it happens. */
  focus: Vec3;
  protagonist: string | null;
  weapon: string | null;
  /** Its shot looks from here in 3D. */
  look: ShotLook | null;
  /** Slow-motion moments in it. */
  moments: Moment[];
};

/** Each kill's worth, and whether it is a slow-motion moment. */
function scoreKills(round: Round) {
  const { kills, rate } = round;
  const teamOf = (id: string | null) =>
    id ? (round.index.trackById.get(id)?.team ?? null) : null;
  return kills.map((k, i) => {
    const killerTeam = teamOf(k.killerId) ?? other(k.team);
    const out: { score: number; moment: Omit<Moment, "tick"> | null } = {
      score: 20,
      moment: null,
    };
    if (!k.killerId || killerTeam === k.team) {
      return out;
    }
    let score = KILL_BASE;
    const sniper = sniperOf(k.weapon);
    if (sniper === "awp") {
      score += AWP_KILL.bonus;
    } else if (sniper === "ssg08") {
      score += SSG_KILL.bonus;
    }
    if (sniper) {
      out.moment = { rank: 1, reason: "sniper" };
    }
    if (isUpset(round, k)) {
      score += UPSET.bonus;
    }
    if (k.headshot) {
      score += HEADSHOT;
    }
    if (i === 0) {
      score += OPENING_KILL;
    }
    // A trade: the victim had just killed one of the killer's team.
    if (
      kills.some(
        (q, j) =>
          j < i &&
          q.killerId === k.victimId &&
          q.team === killerTeam &&
          k.tick - q.tick <= TRADE_SECS * rate,
      )
    ) {
      score += TRADE_KILL;
    }
    let chain = 0;
    for (let j = 0; j <= i; j++) {
      const q = kills[j];
      if (
        q.killerId === k.killerId &&
        q.team !== killerTeam &&
        k.tick - q.tick <= MULTI_SECS * rate
      ) {
        chain++;
      }
    }
    if (chain === 2) {
      score += MULTI_SECOND;
    } else if (chain >= 3) {
      score += MULTI_MORE;
      out.moment = { rank: 2, reason: "multikill" };
    }
    const before = aliveBefore(round, i);
    const after = round.aliveAfter[i];
    if (before[killerTeam] === 1 && round.size[killerTeam] > 1) {
      score += CLUTCH_KILL + CLUTCH_PER_ENEMY * before[k.team];
      if (after[k.team] === 0) {
        score += CLUTCH_WIN;
        out.moment = { rank: 3, reason: "clutch" };
      }
    }
    if (after[k.team] === 0) {
      score += DECIDING_KILL;
    }
    out.score = score;
    return out;
  });
}

type CombatEvent = Vec3 & {
  tick: number;
  ids: string[];
  killIndex: number | null;
  damage: number;
};

function fightStories(round: Round, killScores: ReturnType<typeof scoreKills>) {
  const { index, rate } = round;
  const events: CombatEvent[] = [];
  for (const s of index.shots) {
    events.push({
      ...s.from,
      tick: s.tick,
      ids: s.victimId ? [s.shooterId, s.victimId] : [s.shooterId],
      killIndex: null,
      damage: 0,
    });
  }
  for (const d of index.damages) {
    events.push({
      ...d.at,
      tick: d.tick,
      ids: d.attackerId ? [d.attackerId, d.victimId] : [d.victimId],
      killIndex: null,
      damage: d.amount,
    });
  }
  index.kills.forEach((k, i) => {
    events.push({
      ...k.at,
      tick: k.tick,
      ids: k.killerId ? [k.killerId, k.victimId] : [k.victimId],
      killIndex: i,
      damage: 0,
    });
  });
  events.sort((a, b) => a.tick - b.tick);

  type Open = {
    events: CombatEvent[];
    lastTick: number;
    x: number;
    y: number;
    ids: Set<string>;
  };
  const open: Open[] = [];
  const done: Open[] = [];
  for (const e of events) {
    for (let i = open.length - 1; i >= 0; i--) {
      if (e.tick - open[i].lastTick > FIGHT_GAP * rate) {
        done.push(...open.splice(i, 1));
      }
    }
    let best: Open | null = null;
    let bestDist = Infinity;
    for (const story of open) {
      const d = xyDist(e, story);
      const shared = e.ids.some((id) => story.ids.has(id));
      if (
        (d <= FIGHT_LINK || (shared && d <= FIGHT_LINK_SHARED)) &&
        d < bestDist
      ) {
        best = story;
        bestDist = d;
      }
    }
    if (!best) {
      best = { events: [], lastTick: e.tick, x: e.x, y: e.y, ids: new Set() };
      open.push(best);
    }
    best.events.push(e);
    best.lastTick = e.tick;
    // The middle drifts with the fight, recent events weighing most.
    best.x += (e.x - best.x) * 0.3;
    best.y += (e.y - best.y) * 0.3;
    for (const id of e.ids) {
      best.ids.add(id);
    }
  }
  done.push(...open);

  const stories: Story[] = [];
  for (const f of done) {
    const kills = f.events
      .filter((e) => e.killIndex !== null)
      .map((e) => e.killIndex!);
    const hits = f.events.filter((e) => e.damage > 0);
    const shots = f.events.length - kills.length - hits.length;
    let score = Math.min(40, shots * 2);
    for (const e of hits) {
      score += e.damage >= DAMAGE_DEALER.minHp ? DAMAGE_DEALER.bonus : 10;
    }
    let key = f.events[0].tick;
    let keyScore = -1;
    const moments: Moment[] = [];
    const credit = new Map<string, number>();
    for (const i of kills) {
      const k = index.kills[i];
      const ks = killScores[i];
      score += ks.score;
      if (ks.score > keyScore) {
        keyScore = ks.score;
        key = k.tick;
      }
      if (ks.moment) {
        moments.push({ tick: k.tick, ...ks.moment });
      }
      if (k.killerId) {
        credit.set(k.killerId, (credit.get(k.killerId) ?? 0) + 100);
      }
    }
    for (const e of hits) {
      if (e.ids.length > 1) {
        credit.set(e.ids[0], (credit.get(e.ids[0]) ?? 0) + e.damage);
      }
    }
    if (!kills.length && hits.length) {
      key = hits.reduce((a, b) => (b.damage > a.damage ? b : a)).tick;
    }
    // The streamer's encounter priority as it starts.
    const first = f.events[0].tick;
    const starting = statesAt(round, first).filter((p) => f.ids.has(p.id));
    let encounter = 0;
    for (const a of starting) {
      for (const b of starting) {
        if (a.team === "ct" && b.team === "t") {
          encounter = Math.max(encounter, encounterPriority(a, b) ?? 0);
        }
      }
    }
    score += encounter;
    const protagonist =
      [...credit.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const kill = kills
      .map((i) => index.kills[i])
      .find((k) => k.killerId === protagonist);
    const weapon = kill?.weapon ?? gunOf(round, protagonist, key);
    const atKey = statesAt(round, key).filter((p) => f.ids.has(p.id));
    stories.push({
      kind: f.ids.size <= 2 ? "duel" : "fight",
      firstTick: first,
      lastTick: f.lastTick,
      keyTick: key,
      score,
      participants: f.ids,
      kills: kills.map((i) => index.kills[i]),
      anchors: [],
      focus: centroid(f.events.map(({ x, y, z }) => ({ x, y, z })))!,
      protagonist,
      weapon,
      look: across(
        centroid(atKey.filter((p) => p.team === "ct")),
        centroid(atKey.filter((p) => p.team === "t")),
      ),
      moments,
    });
  }
  return stories;
}

function executeStories(round: Round) {
  const { index, rate } = round;
  type Nade = Vec3 & { tick: number; throwTick: number; team: StageTeam };
  const nades: Nade[] = [];
  for (const g of index.grenades) {
    if (g.detonated && g.endTick !== null && g.type !== "decoy") {
      nades.push({
        ...g.at,
        tick: g.endTick,
        throwTick: g.throwTick ?? g.endTick - rate,
        team: g.team,
      });
    }
  }
  nades.sort((a, b) => a.tick - b.tick);
  const used = new Set<number>();
  const stories: Story[] = [];
  for (let i = 0; i < nades.length; i++) {
    if (used.has(i)) {
      continue;
    }
    const group = [i];
    for (let j = i + 1; j < nades.length; j++) {
      const n = nades[j];
      if (n.tick - nades[i].tick > EXECUTE_WINDOW * rate) {
        break;
      }
      if (
        !used.has(j) &&
        n.team === nades[i].team &&
        group.some((g) => xyDist(nades[g], n) <= EXECUTE_LINK)
      ) {
        group.push(j);
      }
    }
    if (group.length < EXECUTE_MIN) {
      continue;
    }
    group.forEach((g) => used.add(g));
    const list = group.map((g) => nades[g]);
    const team = list[0].team;
    const anchors = list.map(({ x, y, z }) => ({ x, y, z }));
    const focus = centroid(anchors)!;
    const last = Math.max(...list.map((n) => n.tick));
    const crew = statesAt(round, last).filter(
      (p) => p.alive && p.team === team && xyDist(p, focus) <= ENTRY_LINK,
    );
    stories.push({
      kind: team === "t" ? "execute" : "utility",
      firstTick: Math.min(...list.map((n) => n.throwTick)),
      lastTick: last,
      keyTick: last,
      score: EXECUTE_PER_NADE * list.length,
      participants: new Set(crew.map((p) => p.id)),
      kills: [],
      anchors,
      focus,
      protagonist: null,
      weapon: null,
      look: toward(centroid(crew), focus),
      moments: [],
    });
  }
  return stories;
}

function bombStories(round: Round) {
  const { index, rate } = round;
  const plant = round.plantTick;
  const bombAt = round.plantAt;
  if (plant === null || !bombAt) {
    return [];
  }
  const near = (tick: number, team: StageTeam, range: number) =>
    statesAt(round, tick).filter(
      (p) => p.alive && p.team === team && xyDist(p, bombAt) <= range,
    );
  const stories: Story[] = [];
  const begin =
    [...index.bombs]
      .reverse()
      .find((b) => b.type === "plant_begin" && b.tick <= plant)?.tick ??
    plant - 3 * rate;
  const planting = [...near(plant, "t", 1200), ...near(plant, "ct", 1500)];
  stories.push({
    kind: "plant",
    firstTick: begin,
    lastTick: plant + rate,
    keyTick: plant,
    score: 150,
    participants: new Set(planting.map((p) => p.id)),
    kills: [],
    anchors: [bombAt],
    focus: bombAt,
    protagonist: null,
    weapon: null,
    look: toward(centroid(planting.filter((p) => p.team === "ct")), bombAt),
    moments: [],
  });
  let defuseFrom: number | null = null;
  for (const b of index.bombs) {
    if (b.tick < plant) {
      continue;
    }
    if (b.type === "defuse_begin") {
      defuseFrom = b.tick;
      continue;
    }
    if (
      b.type !== "defused" &&
      b.type !== "defuse_abort" &&
      b.type !== "exploded"
    ) {
      continue;
    }
    const during = defuseFrom !== null;
    const blownUp = b.type === "exploded";
    if (during || blownUp) {
      const left = C4_SECS - (b.tick - plant) / rate;
      const cts = near(b.tick - 1, "ct", 1000);
      const ts = near(b.tick - 1, "t", 1500);
      const lastSecond = b.type === "defused" && left <= LAST_SECOND_DEFUSE;
      const moments: Moment[] = [];
      if (lastSecond) {
        moments.push({ tick: b.tick, rank: 3, reason: "defuse" });
      } else if (blownUp && (during || cts.length)) {
        moments.push({ tick: b.tick, rank: 3, reason: "bomb" });
      }
      stories.push({
        kind: during ? "defuse" : "bomb",
        firstTick: during ? defuseFrom! : b.tick - rate,
        lastTick: b.tick + (blownUp ? 2 : 1) * rate,
        keyTick: b.tick,
        score:
          (during ? 200 : 0) +
          (lastSecond ? 200 : 0) +
          (blownUp ? (cts.length || during ? 160 : 80) : 0),
        participants: new Set([...cts, ...ts].map((p) => p.id)),
        kills: [],
        anchors: [bombAt],
        focus: bombAt,
        protagonist: during ? (cts[0]?.id ?? null) : null,
        weapon: null,
        look: across(centroid(cts), centroid(ts)),
        moments,
      });
    }
    defuseFrom = null;
  }
  return stories;
}

/** Folds each execute's entry fight into it, and names fights by situation. */
function linkStories(round: Round, fights: Story[], executes: Story[]) {
  const out: Story[] = [...executes];
  const taken = new Set<Story>();
  for (const ex of executes) {
    const entry = fights.find(
      (f) =>
        !taken.has(f) &&
        f.firstTick >= ex.firstTick &&
        f.firstTick <= ex.lastTick + ENTRY_SECS * round.rate &&
        xyDist(f.focus, ex.focus) <= ENTRY_LINK,
    );
    if (!entry) {
      continue;
    }
    taken.add(entry);
    ex.lastTick = Math.max(ex.lastTick, entry.lastTick);
    ex.keyTick = entry.kills.length ? entry.keyTick : ex.keyTick;
    ex.score += entry.score;
    ex.kills.push(...entry.kills);
    ex.moments.push(...entry.moments);
    for (const id of entry.participants) {
      ex.participants.add(id);
    }
    ex.protagonist = entry.protagonist;
    ex.weapon = entry.weapon;
  }
  for (const f of fights) {
    if (taken.has(f)) {
      continue;
    }
    const clutch = clutchAt(round, f.keyTick - 1);
    if (clutch && f.participants.has(clutch.id)) {
      f.kind = "clutch";
      f.score += CLUTCH_KILL + CLUTCH_PER_ENEMY * clutch.versus;
      f.protagonist = clutch.id;
      f.weapon =
        f.kills.find((k) => k.killerId === clutch.id)?.weapon ??
        gunOf(round, clutch.id, f.keyTick);
    } else if (
      round.plantTick !== null &&
      round.plantAt &&
      f.firstTick > round.plantTick &&
      xyDist(f.focus, round.plantAt) <= RETAKE_LINK
    ) {
      f.kind = "retake";
      f.score += 40;
      f.anchors = [round.plantAt];
    }
    out.push(f);
  }
  return out;
}

// --- shots -------------------------------------------------------------------

function shotOf(story: Story, fromTick: number, toTick: number): PlannedShot {
  return {
    id: 0,
    fromTick,
    toTick,
    kind: story.kind,
    subjects: [...story.participants],
    anchors: story.anchors,
    minRadius: SHOT_RADIUS[story.kind],
    look: story.look,
    focus: story.focus,
    protagonist: story.protagonist,
    weapon: story.weapon,
    keyTick: story.keyTick,
    score: story.score,
  };
}

function wideShot(round: Round, from: number, to: number): PlannedShot {
  const alive = statesAt(round, from).filter((p) => p.alive);
  return {
    id: 0,
    fromTick: from,
    toTick: to,
    kind: "wide",
    subjects: alive.map((p) => p.id),
    anchors: [],
    minRadius: SHOT_RADIUS.wide,
    look: null,
    focus: centroid(alive) ?? { x: 0, y: 0, z: 0 },
    protagonist: null,
    weapon: null,
    keyTick: null,
    score: 0,
  };
}

type Encounter = { pair: [string, string] | null; from: number };

/**
 * The best enemy encounter over [from, to), held by the game-streamer's
 * rules: at least `MIN_DWELL`, a sticky bonus above its floor, off a dead
 * player after `DEATH_GRACE`, never past the phase's longest dwell.
 */
function encounters(round: Round, from: number, to: number): Encounter[] {
  const { rate } = round;
  const out: Encounter[] = [];
  type Pick = { a: string; b: string; priority: number };
  let current: (Pick & { since: number; diedAt: number | null }) | null = null;
  const isCurrent = (p: Pick | null) =>
    !!p && !!current && p.a === current.a && p.b === current.b;
  const step = Math.max(1, Math.round(STEP * rate));
  for (let tick = from; tick < to; tick += step) {
    const alive = statesAt(round, tick).filter((p) => p.alive);
    const clutch = alive.length < CLUTCH_ALIVE;
    const dwell = current ? (tick - current.since) / rate : 0;
    let best: Pick | null = null;
    /** The best pair other than the one on screen. */
    let runnerUp: Pick | null = null;
    for (const a of alive) {
      for (const b of alive) {
        if (a.team !== "ct" || b.team !== "t") {
          continue;
        }
        let priority = encounterPriority(a, b);
        if (priority === null) {
          continue;
        }
        priority += Math.max(
          bonusAt(round, a.id, tick),
          bonusAt(round, b.id, tick),
        );
        if (current && (current.a === a.id || current.b === b.id)) {
          const cap =
            priority > STICKY_FLOOR || clutch
              ? DWELL_MAX_ACTIVE
              : DWELL_MAX_LIVE;
          if (priority > STICKY_FLOOR && dwell < cap) {
            priority += clutch ? STICKY_BONUS_CLUTCH : STICKY_BONUS;
          }
        }
        const pick: Pick = { a: a.id, b: b.id, priority };
        if (!best || priority > best.priority) {
          best = pick;
        }
        if (!isCurrent(pick) && (!runnerUp || priority > runnerUp.priority)) {
          runnerUp = pick;
        }
      }
    }
    let next: Pick | null = best;
    if (current) {
      const gone = [current.a, current.b].some(
        (id) => !alive.some((p) => p.id === id),
      );
      if (gone) {
        current.diedAt ??= tick;
      }
      const deathOver =
        current.diedAt !== null && tick - current.diedAt >= DEATH_GRACE * rate;
      const cap =
        current.priority > STICKY_FLOOR || clutch
          ? DWELL_MAX_ACTIVE
          : DWELL_MAX_LIVE;
      if (isCurrent(best)) {
        current.priority = best!.priority;
        if (dwell < cap) {
          continue;
        }
        // Held as long as it may be: the next best pair, or the wide shot.
        next = runnerUp;
      } else if (
        !deathOver &&
        !(dwell >= MIN_DWELL && best && best.priority > current.priority)
      ) {
        continue;
      }
    }
    if (next) {
      current = { ...next, since: tick, diedAt: null };
      out.push({ pair: [next.a, next.b], from: tick });
    } else if (current || !out.length) {
      current = null;
      out.push({ pair: null, from: tick });
    }
  }
  return out;
}

/**
 * Fills a gap between stories: a wide establishing shot when it is long (or
 * opens the round), then the best enemy encounters.
 */
function fillGap(round: Round, from: number, to: number, opening: boolean) {
  const { rate } = round;
  const shots: PlannedShot[] = [];
  let cursor = from;
  if (
    (opening || to - from >= WIDE_GAP * rate) &&
    to - from >= MIN_DWELL * rate
  ) {
    const end =
      to - (from + WIDE_SECS * rate) < MIN_DWELL * rate
        ? to
        : from + WIDE_SECS * rate;
    shots.push(wideShot(round, from, end));
    cursor = end;
  }
  const list = cursor < to ? encounters(round, cursor, to) : [];
  list.forEach((e, i) => {
    const end = i + 1 < list.length ? list[i + 1].from : to;
    if (!e.pair) {
      shots.push(wideShot(round, e.from, end));
      return;
    }
    const pair = e.pair;
    const states = statesAt(round, e.from).filter((p) => pair.includes(p.id));
    const clutch = clutchAt(round, e.from);
    const hero = clutch && pair.includes(clutch.id) ? clutch : null;
    shots.push({
      id: 0,
      fromTick: e.from,
      toTick: end,
      kind: hero ? "clutch" : "standoff",
      subjects: pair,
      anchors: [],
      minRadius: SHOT_RADIUS[hero ? "clutch" : "standoff"],
      look: across(
        states.find((p) => p.team === "ct") ?? null,
        states.find((p) => p.team === "t") ?? null,
      ),
      focus: centroid(states) ?? { x: 0, y: 0, z: 0 },
      protagonist: hero?.id ?? null,
      weapon: hero ? gunOf(round, hero.id, e.from) : null,
      keyTick: null,
      score: 0,
    });
  });
  if (!shots.length) {
    shots.push(wideShot(round, from, to));
  }
  // Nothing shorter than the least dwell: it joins its neighbour.
  for (let i = shots.length - 1; i > 0; i--) {
    if (shots[i].toTick - shots[i].fromTick < MIN_DWELL * rate) {
      shots[i - 1].toTick = shots[i].toTick;
      shots.splice(i, 1);
    }
  }
  if (
    shots.length > 1 &&
    shots[0].toTick - shots[0].fromTick < MIN_DWELL * rate
  ) {
    shots[1].fromTick = shots[0].fromTick;
    shots.shift();
  }
  shots[0].fromTick = from;
  shots[shots.length - 1].toTick = to;
  return shots;
}

function slowSegment(
  tick: number,
  reason: SpeedSegment["reason"],
  rate: number,
): SpeedSegment {
  return {
    fromTick: tick - SLOW_EASE_FROM * rate,
    fullTick: tick - SLOW_FULL * rate,
    holdTick: tick + SLOW_HOLD * rate,
    toTick: tick + SLOW_EASE_TO * rate,
    speed: SLOW_SPEED,
    reason,
  };
}

export function planRound(index: RoundIndex): RoundPlan {
  const round = readRound(index);
  const { rate, start, end } = round;
  const stories = linkStories(
    round,
    fightStories(round, scoreKills(round)),
    executeStories(round),
  )
    .concat(bombStories(round))
    .filter((s) => s.score >= STORY_MIN && s.lastTick >= start)
    .sort((a, b) => b.score - a.score);

  // The best stories claim the timeline first; one that clashes with a
  // better one is missed (and may come back as a replay).
  type Placed = { from: number; to: number; story: Story };
  const placed: Placed[] = [];
  const missed: Story[] = [];
  for (const story of stories) {
    const key = Math.max(start, story.keyTick);
    if (placed.some((p) => key >= p.from && key <= p.to)) {
      missed.push(story);
      continue;
    }
    let lo = start;
    let hi = end;
    for (const p of placed) {
      if (p.to <= key) {
        lo = Math.max(lo, p.to);
      }
      if (p.from >= key) {
        hi = Math.min(hi, p.from);
      }
    }
    const from = Math.max(lo, story.firstTick - LEAD * rate);
    const to = Math.min(hi, story.lastTick + LINGER * rate);
    if (
      to - from < MIN_DWELL * rate ||
      (key - from < LEAD_MIN * rate && from > start) ||
      to < key + 0.5 * rate
    ) {
      missed.push(story);
      continue;
    }
    placed.push({ from, to, story });
  }
  placed.sort((a, b) => a.from - b.from);

  const shots: PlannedShot[] = [];
  let cursor = start;
  for (const p of placed) {
    if (p.from > cursor) {
      if (p.from - cursor >= MIN_DWELL * rate || !shots.length) {
        shots.push(...fillGap(round, cursor, p.from, cursor === start));
      } else {
        // Too short for a shot of its own: the shot before holds.
        shots[shots.length - 1].toTick = p.from;
      }
    }
    shots.push(shotOf(p.story, p.from, p.to));
    cursor = p.to;
  }
  if (end - cursor >= MIN_DWELL * rate || !shots.length) {
    shots.push(
      ...fillGap(round, cursor, Math.max(end, cursor + rate), !shots.length),
    );
  } else {
    shots[shots.length - 1].toTick = end;
  }
  // Back-to-back wide shots, or the same pair twice, are one shot.
  for (let i = shots.length - 1; i > 0; i--) {
    const a = shots[i - 1];
    const b = shots[i];
    if (
      a.kind === b.kind &&
      (a.kind === "wide" ||
        (a.kind === "standoff" && a.subjects.join() === b.subjects.join()))
    ) {
      a.toTick = b.toTick;
      shots.splice(i, 1);
    }
  }
  shots.forEach((shot, i) => {
    shot.id = i + 1;
  });

  // Slow motion: the big moments on screen, the bigger one winning a clash.
  const moments = placed
    .flatMap((p) =>
      p.story.moments.filter((m) => m.tick >= p.from && m.tick <= p.to),
    )
    .sort((a, b) => b.rank - a.rank || a.tick - b.tick);
  const kept: Moment[] = [];
  for (const m of moments) {
    if (kept.every((k) => Math.abs(k.tick - m.tick) >= SLOW_COOLDOWN * rate)) {
      kept.push(m);
    }
  }
  const slowmo = kept
    .sort((a, b) => a.tick - b.tick)
    .map((m) => slowSegment(m.tick, m.reason, rate));

  // Condensed: dead time between stories, back to speed before the next.
  const condensed: SpeedSegment[] = [];
  let free = start;
  for (const p of [...placed, { from: end, to: end }]) {
    const a = free + rate;
    const b = p.from - CONDENSE_BEFORE * rate;
    if (b - a >= CONDENSE_MIN * rate) {
      condensed.push({
        fromTick: a,
        fullTick: a + CONDENSE_EASE * rate,
        holdTick: b - CONDENSE_EASE * rate,
        toTick: b,
        speed: CONDENSE_SPEED,
        reason: "condensed",
      });
    }
    free = Math.max(free, p.to);
  }

  // Instant replays: stories missed for a better one and shown multi-kills,
  // offered once the action has settled.
  const replays: DirectorReplay[] = [];
  const offers = [
    ...missed
      .filter((s) => s.score >= REPLAY_MIN && s.kills.length)
      .map((story) => ({ story, reason: "missed" as const })),
    ...placed
      .filter((p) => p.story.moments.some((m) => m.reason === "multikill"))
      .map((p) => ({ story: p.story, reason: "multikill" as const })),
  ]
    .sort((a, b) => b.story.score - a.story.score)
    .slice(0, REPLAYS_PER_ROUND);
  for (const { story, reason } of offers) {
    const after = placed.filter((p) => p.to >= story.lastTick);
    let settled = story.lastTick;
    for (let i = 0; i < after.length; i++) {
      const next = after[i + 1];
      if (!next || next.from - after[i].to >= SETTLED_GAP * rate) {
        settled = after[i].to;
        break;
      }
    }
    const offerTick = Math.max(story.lastTick + 2 * rate, settled + rate);
    if (offerTick > end - 2 * rate) {
      continue;
    }
    const fromTick = story.firstTick - 1.5 * rate;
    const untilTick = story.lastTick + rate;
    replays.push({
      offerTick,
      fromTick,
      untilTick,
      shot: { ...shotOf(story, fromTick, untilTick), id: -1 - replays.length },
      reason,
    });
  }
  replays.sort((a, b) => a.offerTick - b.offerTick);

  return {
    round: index.round,
    rate,
    startTick: start,
    endTick: end,
    shots,
    slowmo,
    condensed,
    replays,
  };
}

const plans = new WeakMap<RoundIndex, RoundPlan>();

/** The plan for a round of a blob, built once. */
export function roundPlan(blob: StageBlob, round: number): RoundPlan | null {
  const index = roundIndex(blob, round);
  if (!index || !index.tracks.length) {
    return null;
  }
  let plan = plans.get(index);
  if (!plan) {
    plan = planRound(index);
    plans.set(index, plan);
  }
  return plan;
}

// --- lookups -----------------------------------------------------------------

/** The planned shot at a tick. */
export function shotAt(plan: RoundPlan, tick: number): PlannedShot {
  const shots = plan.shots;
  let lo = 0;
  let hi = shots.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (shots[mid].fromTick <= tick) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return shots[lo];
}

/** The next story after the shot at `tick`, if it starts within `secs`. */
export function nextStory(plan: RoundPlan, tick: number, secs: number) {
  const now = shotAt(plan, tick);
  for (const shot of plan.shots) {
    if (shot.fromTick <= now.fromTick) {
      continue;
    }
    if (shot.fromTick - tick > secs * plan.rate) {
      return null;
    }
    if (shot.kind !== "wide" && shot.kind !== "standoff") {
      return shot;
    }
  }
  return null;
}

function segmentSpeed(seg: SpeedSegment, tick: number) {
  if (tick <= seg.fromTick || tick >= seg.toTick) {
    return 1;
  }
  const k =
    tick < seg.fullTick
      ? smoothstep((tick - seg.fromTick) / (seg.fullTick - seg.fromTick))
      : tick <= seg.holdTick
        ? 1
        : 1 - smoothstep((tick - seg.holdTick) / (seg.toTick - seg.holdTick));
  return 1 + (seg.speed - 1) * k;
}

/**
 * The playback speed the plan asks for at a tick, as a share of the viewer's
 * own. It is continuous in the tick, so sampling it each frame never jumps.
 */
export function speedAt(
  plan: RoundPlan,
  tick: number,
  options: { slowmo?: boolean; condensed?: boolean } = {},
) {
  let speed = 1;
  if (options.slowmo !== false) {
    for (const seg of plan.slowmo) {
      speed = Math.min(speed, segmentSpeed(seg, tick));
    }
  }
  if (options.condensed) {
    for (const seg of plan.condensed) {
      speed = Math.max(speed, segmentSpeed(seg, tick));
    }
  }
  return speed;
}

// --- framing -----------------------------------------------------------------

/** How long a dead subject stays framed, seconds. */
const DEAD_FRAMED = 2.5;
/** Room around what is framed, source units. */
const FRAME_PAD = 260;
const MAX_RADIUS = 2400;

/**
 * Where to look and how much ground to keep in view for a shot, now.
 * `place` maps a source point to where it is drawn (a stacked map's lower
 * floor can sit beside the map), in the same axes; the target comes back in
 * that space.
 */
export function frameShot(
  shot: PlannedShot,
  players: readonly StagePlayer[],
  place: (p: Vec3) => Vec3 = (p) => p,
) {
  const points: Vec3[] = [];
  for (const p of players) {
    if (
      shot.subjects.includes(p.id) &&
      (p.alive || (p.diedAge ?? Infinity) < DEAD_FRAMED)
    ) {
      points.push(place(p));
    }
  }
  for (const a of shot.anchors) {
    points.push(place(a));
  }
  const target = centroid(points) ?? place(shot.focus);
  let reach = 0;
  for (const p of points) {
    reach = Math.max(reach, xyDist(p, target));
  }
  const radius = Math.max(shot.minRadius, reach + FRAME_PAD);
  return {
    target,
    radius: shot.kind === "wide" ? radius : Math.min(MAX_RADIUS, radius),
  };
}

/** The callout a point is in, humanised. */
export function placeOf(
  at: Vec3,
  callouts: StageMap["callouts"] | null | undefined,
) {
  const name = calloutAt(at, callouts as MapCallout[] | null | undefined);
  return name ? humanizeCallout(name) : null;
}

/** How many the last player standing faces, from a frame's players. */
export function versusOf(players: readonly StagePlayer[]) {
  const alive = { ct: 0, t: 0 };
  for (const p of players) {
    if (p.alive) {
      alive[p.team]++;
    }
  }
  if (alive.ct === 1 && alive.t >= 1) {
    return alive.t;
  }
  if (alive.t === 1 && alive.ct >= 1) {
    return alive.ct;
  }
  return null;
}
