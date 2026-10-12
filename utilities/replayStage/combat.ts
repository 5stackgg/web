import * as THREE from "three";
import {
  FX,
  FX_GRID,
  GLYPH_BANG,
  GLYPH_GRID,
  GLYPH_SKULL,
  createFxAtlas,
  createGlyphAtlas,
} from "./combatAtlas";
import type { GlyphAtlas } from "./combatAtlas";
import { createBeamBatch } from "./combatBeams";
import type { BeamBatch } from "./combatBeams";
import { createRingBatch } from "./combatRings";
import { createUtilityTimers } from "./combatTimers";
import type { UtilityTimers } from "./combatTimers";
import type { RingBatch } from "./combatRings";
import { BADGE } from "./playersBadges";
import {
  PUCK_RADIUS,
  badgeZoom,
  nameShown,
  overlayScale,
  puckAnchor,
} from "./playersShared";
import { TEAM_STYLE } from "./teamColors";
import type { TeamStyle } from "./teamColors";
import type { ScreenAnchor } from "./playersShared";
import { impactDelay, setTracerStyleFor, shotArrival } from "./combatTiming";
import type { TracerStyle } from "./combatTiming";
import { createSpriteBatch } from "./sprites";
import type { SpriteBatch } from "./sprites";
import type {
  StageContext,
  StageDamage,
  StageFrame,
  StageKill,
  StageModule,
  StageShot,
} from "./types";

export type CombatOptions = {
  /** LoL-style floating damage numbers over whoever is hit. */
  damageNumbers?: boolean;
  tracerStyle?: TracerStyle;
};

export type CombatModule = StageModule & {
  setDamageNumbers(on: boolean): void;
  setTracerStyle(style: TracerStyle): void;
};

const HIT_YELLOW = 0xffd84a;
const HIT_EDGE = 0xf0a232;
const HIT_CORE = 0xfff6c8;
const IMPACT_RING = 0xff6a24;
const MUZZLE = 0xffb35c;
const SPARK = 0xffd27a;
const DUST = 0xcdb894;

/** Seconds a number stays up. */
const NUMBER_LIFE = 1.05;

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smooth(a: number, b: number, v: number) {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
}

function easeOut(k: number) {
  const c = clamp01(k);
  return 1 - (1 - c) ** 3;
}

/** Digit height of a damage number, CSS px at scale 1. */
function numberHeight(damage: StageDamage) {
  return damage.healthAfter <= 0 || damage.headshot ? 32 : 25;
}

/** Stable 0..1 per string, so every effect of a shot is the same on every frame. */
function hashKey(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function rnd(seed: number, i: number) {
  const s = Math.sin(seed * 9301.7 + i * 49.297 + 1.3) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Fights as a MOBA would draw them: every shot a glowing tracer with a muzzle
 * flash; a hit becomes a thick yellow beam that ends in a comic starburst
 * with shards and an orange ring on the victim; misses spark off walls;
 * damage pops up in numbers; kills burst. Pure functions of each event's age.
 */
export function createCombatModule(options: CombatOptions = {}): CombatModule {
  let showNumbers = options.damageNumbers ?? true;
  let style: TracerStyle = options.tracerStyle ?? "comet";
  let context: StageContext | null = null;
  let beams: BeamBatch | null = null;
  let rings: RingBatch | null = null;
  let glow: SpriteBatch | null = null;
  let solid: SpriteBatch | null = null;
  let numbers: SpriteBatch | null = null;
  let timers: UtilityTimers | null = null;
  let glyphs: GlyphAtlas | null = null;
  let fxTexture: THREE.Texture | null = null;

  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const color = new THREE.Color();
  const anchor: ScreenAnchor = {
    x: 0,
    y: 0,
    cx: 0,
    cy: 0,
    radius: 0,
    depth: 0,
    grow: 1,
  };
  const anchorWorld = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const pulled = new THREE.Vector3();
  /** Where the next damage-number glyph goes, CSS px. */
  let cursor = 0;

  /**
   * Sprites face the camera, so a big one standing on the floor would be cut
   * by it: slide it toward the eye by half its size, shrunk to keep its
   * size on screen. Walls in front still hide it.
   */
  function put(
    batch: SpriteBatch,
    p: THREE.Vector3,
    width: number,
    height: number,
    alpha: number,
    rotation: number,
    cell: number,
  ) {
    pulled.subVectors(camPos, p);
    const dist = pulled.length();
    const pull = Math.min(Math.max(width, height) * 0.5, dist * 0.5);
    const k = dist > 1 ? (dist - pull) / dist : 1;
    if (dist > 1) {
      pulled.multiplyScalar(pull / dist).add(p);
    } else {
      pulled.copy(p);
    }
    batch.push(pulled, width * k, height * k, color, alpha, rotation, cell);
  }

  function findPlayer(frame: StageFrame, id: string | null) {
    if (!id) {
      return null;
    }
    for (const player of frame.players) {
      if (player.id === id) {
        return player;
      }
    }
    return null;
  }

  /** Screen-plane angle of a world direction, for sprites that point along it. */
  function screenAngle(d: THREE.Vector3) {
    return Math.atan2(d.dot(camUp), d.dot(camRight));
  }

  function drawShot(shot: StageShot, frame: StageFrame, ctx: StageContext) {
    const age = shot.age;
    if (!beams || !glow || !solid) {
      return;
    }
    const travel = shotArrival(shot, style);
    if (age > travel + 0.6) {
      return;
    }
    const low = ctx.quality === "low";
    const team = TEAM_STYLE[shot.team];
    const seed = hashKey(shot.key);
    ctx.wpos(shot.from, from);
    ctx.wpos(shot.to, to);
    dir.subVectors(to, from);
    const full = dir.length();
    if (full < 1) {
      return;
    }
    dir.divideScalar(full);
    // From the barrel, not the middle of the head.
    const barrel = style === "classic" ? 0 : Math.min(16, full * 0.2);
    from.addScaledVector(dir, barrel);
    const len = full - barrel;

    if (style === "comet") {
      drawComet(team, seed, len, travel, age, low);
    } else if (style === "pulse") {
      drawPulse(team, seed, len, travel, age, low);
    } else if (style === "bolt") {
      drawBolt(team, seed, len, travel, age, low);
    } else {
      drawClassic(team, seed, len, travel, age);
    }
    drawMuzzle(team, seed, age);

    const t = age - travel;
    if (t < 0) {
      return;
    }
    if (shot.hit) {
      drawHit(shot, frame, ctx, t, seed, len, low);
    } else if (t < 0.35) {
      drawMiss(shot, ctx, team, t, seed, low);
    }
  }

  /** A thin full-length tracer with a comet riding it. */
  function drawClassic(
    team: TeamStyle,
    seed: number,
    len: number,
    travel: number,
    age: number,
  ) {
    const head = clamp01(age / travel);
    const arrived = Math.max(0, age - travel);
    beams!.push(
      from,
      to,
      0,
      head,
      1.4,
      2.2,
      1.3,
      team.tracer,
      team.tracerCore,
      0.6 * (1 - smooth(0.05, 0.3, age)),
      false,
      0,
      0,
      seed,
    );
    const comet = Math.min(0.5, 600 / len);
    const shrink = clamp01(arrived / 0.16);
    beams!.push(
      from,
      to,
      Math.max(0, head - comet * (1 - shrink)),
      head,
      0.6,
      6,
      2.6,
      team.tracer,
      team.tracerCore,
      1 - shrink * 0.7,
      false,
      1,
      0,
      seed,
    );
    if (age < travel + 0.02) {
      pos.copy(from).addScaledVector(dir, len * head);
      color.setHex(team.tracerCore);
      put(glow!, pos, 36, 36, 0.9, 0, FX.glow);
    }
  }

  /**
   * Every round its own short, thick comet flying muzzle to impact, so a
   * spray reads as a stream of separate bullets; only a faint streak lingers.
   */
  function drawComet(
    team: TeamStyle,
    seed: number,
    len: number,
    travel: number,
    age: number,
    low: boolean,
  ) {
    const d = (len / Math.max(travel, 1e-3)) * age;
    const tailLen = Math.min(150, len * 0.6);
    const head = Math.min(d, len) / len;
    const tail = clamp01((d - tailLen) / len);
    const fade = 1 - smooth(travel, travel + 0.12, age);
    beams!.push(
      from,
      to,
      clamp01((d - 560) / len),
      tail,
      0.5,
      1.4,
      0.7,
      team.tracer,
      team.tracerCore,
      0.4 * fade,
      false,
      1,
      0,
      seed,
    );
    if (tail >= 1) {
      return;
    }
    if (!low) {
      beams!.push(
        from,
        to,
        tail,
        head,
        2,
        19,
        6.5,
        team.tracer,
        team.tracer,
        0.45,
        true,
        1,
        0,
        seed,
        1,
      );
    }
    beams!.push(
      from,
      to,
      tail,
      head,
      0.9,
      9,
      2.8,
      team.tracer,
      team.tracerCore,
      1,
      false,
      1,
      0,
      seed,
      1,
    );
    if (d < len) {
      pos.copy(from).addScaledVector(dir, d);
      color.setHex(team.tracer);
      put(glow!, pos, 60, 60, 0.75, 0, FX.glow);
    }
  }

  /**
   * EM's look: a thick glowing beam snaps on for a few frames with a hot
   * pulse running down it, and is gone before the next round of a spray.
   */
  function drawPulse(
    team: TeamStyle,
    seed: number,
    len: number,
    travel: number,
    age: number,
    low: boolean,
  ) {
    const on = 1 - smooth(0.045, 0.1, age);
    if (on > 0) {
      const snap = 1 + 0.45 * Math.exp(-age * 50);
      if (!low) {
        beams!.push(
          from,
          to,
          0,
          1,
          4 * snap,
          16 * snap,
          6,
          team.tracer,
          team.tracer,
          0.45 * on,
          true,
          1,
          0,
          seed,
        );
      }
      beams!.push(
        from,
        to,
        0,
        1,
        1.6 * snap,
        6.5 * snap,
        2.2,
        team.tracer,
        team.tracerCore,
        on,
        false,
        1,
        0,
        seed,
      );
    }
    const d = (len / Math.max(travel, 1e-3)) * age;
    const pulseLen = Math.min(170, len * 0.4);
    const tail = clamp01((d - pulseLen) / len);
    if (tail < 1) {
      beams!.push(
        from,
        to,
        tail,
        Math.min(d, len) / len,
        2.5,
        11,
        3.4,
        team.tracer,
        0xffffff,
        1,
        false,
        1,
        0,
        seed,
        1,
      );
    }
  }

  /**
   * A chunky glowing projectile, slower than a bullet, shedding sparks, with
   * a ring popping off the muzzle.
   */
  function drawBolt(
    team: TeamStyle,
    seed: number,
    len: number,
    travel: number,
    age: number,
    low: boolean,
  ) {
    const d = (len / Math.max(travel, 1e-3)) * age;
    const boltLen = Math.min(90, len * 0.5);
    const head = Math.min(d, len) / len;
    const tail = clamp01((d - boltLen) / len);
    if (age < 0.16) {
      const k = age / 0.16;
      pos.copy(from).addScaledVector(dir, 6);
      color.setHex(team.tracerCore);
      const size = 26 + 60 * easeOut(k);
      put(glow!, pos, size, size, 0.55 * (1 - k), 0, FX.ring);
    }
    if (tail >= 1) {
      return;
    }
    beams!.push(
      from,
      to,
      clamp01((d - boltLen - 280) / len),
      tail,
      0.6,
      3.5,
      1.2,
      team.tracer,
      team.tracer,
      0.55,
      true,
      1,
      0,
      seed,
    );
    if (!low) {
      beams!.push(
        from,
        to,
        clamp01((d - boltLen - 20) / len),
        head,
        17,
        19,
        6.5,
        team.tracer,
        team.tracer,
        0.6,
        true,
        0,
        0,
        seed,
        2,
      );
    }
    beams!.push(
      from,
      to,
      tail,
      head,
      8.5,
      8.5,
      3.2,
      team.tracer,
      team.tracerCore,
      1,
      false,
      0.35,
      0,
      seed,
      2,
    );
    const sparks = low ? 1 : 4;
    side.set(dir.z, 0, -dir.x).normalize();
    color.setHex(team.tracerCore);
    for (let i = 0; i < sparks; i++) {
      const phase = (age * 7 + rnd(seed, i)) % 1;
      const back = boltLen * 0.6 + 130 * phase;
      if (d - back < 0 || d - back > len) {
        continue;
      }
      pos.copy(from).addScaledVector(dir, d - back);
      pos.addScaledVector(side, (rnd(seed, i + 3) - 0.5) * 50 * phase);
      pos.y += (rnd(seed, i + 6) - 0.3) * 30 * phase;
      put(glow!, pos, 24, 6, 1 - phase, screenAngle(dir), FX.spark);
    }
  }

  /** A spiky flash at the muzzle for a couple of frames. */
  function drawMuzzle(team: TeamStyle, seed: number, age: number) {
    const life = style === "pulse" ? 0.04 : 0.05;
    if (age >= life) {
      return;
    }
    const k = 1 - age / life;
    const size = (0.85 + 0.3 * seed) * (style === "classic" ? 1 : 1.25);
    pos.copy(from).addScaledVector(dir, 14);
    color.setHex(MUZZLE);
    put(glow!, pos, 50 * size, 50 * size, 0.45 * k, 0, FX.glow);
    color.setHex(0xffffff);
    put(solid!, pos, 92 * size, 58 * size, k, screenAngle(dir), FX.muzzle);
    if (style !== "classic") {
      color.setHex(team.tracerCore);
      put(glow!, pos, 30 * size, 30 * size, k, 0, FX.glow);
    }
  }

  /** Sparks kick back off the wall and a little dust hangs. */
  function drawMiss(
    shot: StageShot,
    ctx: StageContext,
    team: TeamStyle,
    t: number,
    seed: number,
    low: boolean,
  ) {
    const sparks = low ? 2 : style === "bolt" ? 6 : 4;
    const back = Math.atan2(
      -(shot.to.y - shot.from.y),
      -(shot.to.x - shot.from.x),
    );
    for (let i = 0; i < sparks; i++) {
      const st = t / (0.12 + 0.08 * rnd(seed, i));
      if (st >= 1) {
        continue;
      }
      const a = back + (rnd(seed, i + 10) - 0.5) * 2.6;
      const dist = (60 + 70 * rnd(seed, i + 20)) * easeOut(st);
      pos.set(
        shot.to.x + Math.cos(a) * dist,
        shot.to.y + Math.sin(a) * dist,
        shot.to.z + 12 * st,
      );
      ctx.wpos(pos, pos);
      side.set(Math.cos(a), 0, -Math.sin(a));
      color.setHex(SPARK);
      put(glow!, pos, 26, 6, 1 - st, screenAngle(side), FX.spark);
    }
    if (t < 0.07) {
      color.setHex(style === "bolt" ? team.tracer : SPARK);
      const size = style === "bolt" ? 70 : 34;
      put(glow!, to, size, size, 1 - t / 0.07, 0, FX.glow);
    }
    const puffs = low ? 1 : 2;
    const grow = style === "bolt" ? 1.5 : 1;
    for (let i = 0; i < puffs; i++) {
      const k = t / 0.35;
      pos.set(
        shot.to.x + Math.cos(back + i * 1.7) * 10 * (1 + k * 2),
        shot.to.y + Math.sin(back + i * 1.7) * 10 * (1 + k * 2),
        shot.to.z + 6 * k,
      );
      ctx.wpos(pos, pos);
      color.setHex(DUST);
      const size = (16 + 34 * easeOut(k)) * grow;
      put(solid!, pos, size, size, 0.55 * (1 - k), seed * 6 + i, FX.puff);
    }
  }

  function drawHit(
    shot: StageShot,
    frame: StageFrame,
    ctx: StageContext,
    t: number,
    seed: number,
    len: number,
    low: boolean,
  ) {
    if (!beams || !glow || !solid) {
      return;
    }
    const hs = shot.headshot;
    // The tracer turns into a thick tapered yellow beam for an instant; a
    // comet flares yellow over its last stretch instead, a bolt just bursts.
    if (t < 0.17 && (style === "classic" || style === "pulse")) {
      const punch =
        t < 0.04
          ? 1 + 0.3 * Math.sin((Math.PI * t) / 0.04)
          : 1 - 0.5 * clamp01((t - 0.04) / 0.13);
      beams.push(
        from,
        to,
        Math.max(0, 1 - 1100 / len),
        1,
        0.8,
        (hs ? 24 : 18) * punch,
        3,
        HIT_EDGE,
        hs ? 0xffffff : HIT_CORE,
        1 - smooth(0.09, 0.17, t),
        false,
        1,
        0.45,
        seed,
      );
    }

    if (t < 0.12 && style === "comet") {
      beams.push(
        from,
        to,
        Math.max(0, 1 - Math.min(280, len * 0.5) / len),
        1,
        1,
        hs ? 17 : 13,
        3,
        HIT_EDGE,
        hs ? 0xffffff : HIT_CORE,
        1 - smooth(0.05, 0.12, t),
        false,
        1,
        0.45,
        seed,
        1,
      );
    }
    if (t < 0.12 && style === "bolt") {
      color.setHex(TEAM_STYLE[shot.team].tracer);
      put(glow, to, 120, 120, 0.8 * (1 - t / 0.12), 0, FX.glow);
    }

    // Comic impact starburst on the near side of the victim, so their puck
    // still shows behind it.
    const burstLife = hs ? 0.2 : 0.16;
    const back =
      24 /
      Math.max(1, Math.hypot(shot.to.x - shot.from.x, shot.to.y - shot.from.y));
    pos.set(
      shot.to.x - (shot.to.x - shot.from.x) * back,
      shot.to.y - (shot.to.y - shot.from.y) * back,
      shot.to.z,
    );
    ctx.wpos(pos, anchorWorld);
    if (hs && t < 0.24) {
      // A headshot flashes a white four-point glint behind the burst.
      const k = t / 0.24;
      const size = 130 + 170 * easeOut(k);
      color.setHex(0xfff2c0);
      put(
        glow,
        anchorWorld,
        size,
        size,
        0.75 * (1 - k) ** 1.5,
        Math.PI / 4 + k * 0.6,
        FX.star,
      );
    }
    if (t < burstLife) {
      const grow =
        t < 0.025
          ? 0.6 + 0.6 * (t / 0.025)
          : 1.2 - 0.3 * clamp01((t - 0.025) / 0.15);
      const size = (hs ? 160 : 125) * grow;
      const alpha = 1 - smooth(burstLife * 0.6, burstLife, t);
      color.setHex(HIT_YELLOW);
      put(glow, anchorWorld, size * 1.1, size * 1.1, 0.22 * alpha, 0, FX.glow);
      color.setHex(0xffffff);
      put(
        solid,
        anchorWorld,
        size,
        size,
        alpha,
        seed * 6.283 + t * 2,
        hs ? FX.burstHead : seed > 0.5 ? FX.burstA : FX.burstB,
      );
    }

    // White angular shards fly off the far side of the victim.
    if (t < 0.34) {
      const shards = low ? 2 : hs ? 5 : 4;
      const heading = Math.atan2(
        shot.to.y - shot.from.y,
        shot.to.x - shot.from.x,
      );
      color.setHex(0xffffff);
      for (let i = 0; i < shards; i++) {
        const a = heading + (rnd(seed, i) - 0.5) * 2.5;
        const speed = 320 + 260 * rnd(seed, i + 5);
        const dist = (speed * (1 - Math.exp(-t * 7))) / 7;
        pos.set(
          shot.to.x + Math.cos(a) * dist,
          shot.to.y + Math.sin(a) * dist,
          shot.to.z + 14 * t,
        );
        ctx.wpos(pos, pos);
        const size = (hs ? 18 : 14) + 8 * rnd(seed, i + 9);
        put(
          solid,
          pos,
          size,
          size * 0.8,
          1 - smooth(0.2, 0.34, t),
          rnd(seed, i + 3) * 6.283 + t * (rnd(seed, i + 7) - 0.5) * 24,
          i % 2 ? FX.shardA : FX.shardB,
        );
      }
    }

    // An orange-red ring flares around the victim's puck; the killing shot
    // leaves that to the kill's shockwave.
    if (t < 0.32 && rings && !lethal(frame, shot)) {
      const victim = findPlayer(frame, shot.victimId);
      if (victim) {
        pos.set(victim.x, victim.y, victim.z);
      } else {
        pos.set(shot.to.x, shot.to.y, shot.to.z - 44);
      }
      ctx.wpos(pos, pos);
      const k = t / 0.32;
      rings.push(
        pos,
        PUCK_RADIUS * (1.15 + 0.6 * easeOut(k)),
        6 + 6 * k,
        0.5,
        IMPACT_RING,
        1.1 * (1 - k) ** 1.3,
      );
    }
  }

  function lethal(frame: StageFrame, shot: StageShot) {
    for (const kill of frame.kills) {
      const before = shot.age - kill.age;
      if (kill.victimId === shot.victimId && before > -1e-3 && before < 0.3) {
        return true;
      }
    }
    return false;
  }

  function drawKill(kill: StageKill, frame: StageFrame, ctx: StageContext) {
    const t =
      kill.age -
      impactDelay(frame, style, kill.victimId, kill.killerId, kill.age);
    if (t < 0 || t > 0.7 || !glow || !solid) {
      return;
    }
    const low = ctx.quality === "low";
    const team = TEAM_STYLE[kill.team];
    const seed = hashKey(kill.key);
    pos.set(kill.at.x, kill.at.y, kill.at.z + 24);
    ctx.wpos(pos, anchorWorld);

    if (t < 0.1) {
      color.setHex(team.core);
      const size = 80 + 80 * easeOut(t / 0.1);
      put(glow, anchorWorld, size, size, 0.6 * (1 - t / 0.1), 0, FX.glow);
    }
    pos.set(kill.at.x, kill.at.y, kill.at.z);
    ctx.wpos(pos, pos);
    if (t < 0.5 && rings) {
      const k = t / 0.5;
      rings.push(
        pos,
        PUCK_RADIUS * (0.8 + 3.2 * easeOut(k)),
        10 + 8 * k,
        1,
        team.core,
        1.2 * (1 - k) ** 1.4,
      );
    }
    if (t > 0.03 && t < 0.38 && rings) {
      const k = (t - 0.03) / 0.35;
      rings.push(
        pos,
        PUCK_RADIUS * (0.6 + 1.9 * easeOut(k)),
        4,
        0,
        0xffffff,
        0.9 * (1 - k) ** 2,
      );
    }
    const shards = low ? 3 : 8;
    for (let i = 0; i < shards; i++) {
      const a = (i / shards) * Math.PI * 2 + (rnd(seed, i) - 0.5) * 0.7;
      const speed = 420 + 320 * rnd(seed, i + 4);
      const dist = (speed * (1 - Math.exp(-t * 6))) / 6;
      pos.set(
        kill.at.x + Math.cos(a) * dist,
        kill.at.y + Math.sin(a) * dist,
        kill.at.z + 24 + 40 * t,
      );
      ctx.wpos(pos, pos);
      color.setHex(i % 3 === 0 ? team.core : 0xffffff);
      const size = 16 + 12 * rnd(seed, i + 8);
      put(
        solid,
        pos,
        size,
        size * 0.8,
        1 - smooth(0.35, 0.6, t),
        rnd(seed, i + 2) * 6.283 + t * (rnd(seed, i + 6) - 0.5) * 18,
        i % 2 ? FX.shardA : FX.shardB,
      );
    }
  }

  function drawDamage(
    damage: StageDamage,
    frame: StageFrame,
    ctx: StageContext,
    overlay: number,
  ) {
    const age = damage.age - numberDelay(frame, damage);
    if (
      age < 0 ||
      age > NUMBER_LIFE ||
      !numbers ||
      !glyphs ||
      !puckAnchor(ctx, damage.at, anchor)
    ) {
      return;
    }
    // Beside the victim's portrait, which shrinks and drops onto its pointer
    // as the camera pulls back; the digits shrink less, to stay readable.
    const zoom = badgeZoom(ctx, anchor.radius);
    const badge = overlay * zoom;
    const scale = overlay * Math.max(0.8, zoom);
    const victim = findPlayer(frame, damage.victimId);
    const portraitY =
      BADGE.portraitY -
      BADGE.namelessDrop * (1 - nameShown(zoom, !!victim?.selected));
    // Newer numbers on the same victim push this one up by their height, smoothly.
    let push = 0;
    for (const other of frame.damages) {
      const otherAge = other.age - numberDelay(frame, other);
      if (
        other !== damage &&
        other.victimId === damage.victimId &&
        otherAge >= 0 &&
        otherAge < age
      ) {
        push += smooth(0, 0.07, otherAge) * (numberHeight(other) + 3) * scale;
      }
    }
    const lethal = damage.healthAfter <= 0;
    const h = numberHeight(damage) * scale;
    const pop = 1 + 0.85 * Math.exp(-age * 20);
    const glyphH = h * 1.9 * pop;
    const rise = 40 * easeOut(age / NUMBER_LIFE) * scale;
    const x =
      anchor.x +
      BADGE.portraitRadius * badge +
      8 * scale +
      10 * easeOut(age / 0.4) * scale;
    const y = anchor.y - portraitY * badge - rise - push;
    const alpha = 1 - smooth(0.72, NUMBER_LIFE, age);
    color.setHex(lethal ? 0xff3b30 : damage.headshot ? 0xffc93c : 0xffffff);

    // Unproject along the plane through the puck top facing the camera.
    const wpp =
      (2 * anchor.depth * Math.tan((ctx.camera.fov * Math.PI) / 360)) /
      ctx.height;
    pos.set(damage.at.x, damage.at.y, damage.at.z);
    ctx.wpos(pos, anchorWorld);
    anchorWorld.y += 14;
    cursor = x;
    if (lethal) {
      glyph(GLYPH_SKULL, glyphH, y, wpp, alpha);
    }
    const amount = Math.max(0, Math.round(damage.amount));
    let div = 1;
    while (div * 10 <= amount) {
      div *= 10;
    }
    for (; div >= 1; div /= 10) {
      glyph(Math.floor(amount / div) % 10, glyphH, y, wpp, alpha);
    }
    if (damage.headshot) {
      glyph(GLYPH_BANG, glyphH, y, wpp, alpha);
    }
  }

  function numberDelay(frame: StageFrame, damage: StageDamage) {
    return impactDelay(
      frame,
      style,
      damage.victimId,
      damage.attackerId,
      damage.age,
    );
  }

  /** One glyph at the cursor, on the camera-facing plane through the anchor. */
  function glyph(
    cell: number,
    height: number,
    y: number,
    wpp: number,
    alpha: number,
  ) {
    if (!numbers || !glyphs) {
      return;
    }
    const advance = glyphs.advance[cell] * height;
    const cx = cursor + advance / 2;
    pos
      .copy(anchorWorld)
      .addScaledVector(camRight, (cx - anchor.cx) * wpp)
      .addScaledVector(camUp, (anchor.cy - y) * wpp);
    numbers.push(pos, height * glyphs.aspect, height, color, alpha, 0, cell);
    cursor += advance;
  }

  return {
    name: "combat",
    init(ctx) {
      context = ctx;
      setTracerStyleFor(ctx, style);
      fxTexture = createFxAtlas();
      glyphs = createGlyphAtlas();
      beams = createBeamBatch(512);
      rings = createRingBatch(128);
      // Glows under the solid comic shapes, so the bursts keep crisp edges.
      glow = createSpriteBatch({
        texture: fxTexture,
        grid: FX_GRID,
        max: 1024,
        blending: "additive",
        renderOrder: 31,
      });
      solid = createSpriteBatch({
        texture: fxTexture,
        grid: FX_GRID,
        max: 512,
        renderOrder: 32,
      });
      numbers = createSpriteBatch({
        texture: glyphs.texture,
        grid: GLYPH_GRID,
        max: 256,
        screenSpace: true,
        depthTest: false,
        renderOrder: 1001,
      });
      numbers.setViewport(ctx.width, ctx.height);
      timers = createUtilityTimers();
      timers.resize(ctx);
      ctx.scene.add(
        beams.mesh,
        rings.mesh,
        glow.mesh,
        solid.mesh,
        numbers.mesh,
        timers.mesh,
      );
    },
    update(frame, ctx) {
      if (!beams || !rings || !glow || !solid || !numbers) {
        return;
      }
      ctx.camera.updateMatrixWorld();
      camPos.setFromMatrixPosition(ctx.camera.matrixWorld);
      camRight.setFromMatrixColumn(ctx.camera.matrixWorld, 0);
      camUp.setFromMatrixColumn(ctx.camera.matrixWorld, 1);
      beams.begin(ctx.camera, ctx.height);
      rings.begin();
      glow.begin();
      solid.begin();
      numbers.begin();
      for (const shot of frame.shots) {
        drawShot(shot, frame, ctx);
      }
      for (const kill of frame.kills) {
        drawKill(kill, frame, ctx);
      }
      if (showNumbers) {
        const scale = overlayScale(ctx);
        for (const damage of frame.damages) {
          drawDamage(damage, frame, ctx, scale);
        }
      }
      beams.end();
      rings.end();
      glow.end();
      solid.end();
      numbers.end();
      timers?.update(frame, ctx);
    },
    resize(ctx) {
      numbers?.setViewport(ctx.width, ctx.height);
      timers?.resize(ctx);
    },
    setDamageNumbers(on) {
      showNumbers = on;
    },
    setTracerStyle(next) {
      style = next;
      if (context) {
        setTracerStyleFor(context, next);
      }
    },
    async settle() {
      await Promise.all([glyphs?.ready, timers?.ready]);
    },
    dispose() {
      for (const batch of [beams, rings, glow, solid, numbers]) {
        batch?.mesh.removeFromParent();
        batch?.dispose();
      }
      timers?.dispose();
      fxTexture?.dispose();
      glyphs?.texture.dispose();
      beams = null;
      rings = null;
      glow = null;
      solid = null;
      numbers = null;
      glyphs = null;
      fxTexture = null;
      timers = null;
      context = null;
    },
  };
}
