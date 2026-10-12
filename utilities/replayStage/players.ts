import * as THREE from "three";
import { BADGE, createBadgeAtlas, createBadgeBatch } from "./playersBadges";
import type { BadgeAtlas, BadgeBatch, WeaponCell } from "./playersBadges";
import { createGroundBatch, createPuckBatch } from "./playersPuck";
import type { GroundBatch, PuckBatch } from "./playersPuck";
import {
  DEAD_PUCK,
  badgeZoom,
  nameShown,
  overlayScale,
  puckAnchor,
} from "./playersShared";
import { TEAM_STYLE } from "./teamColors";
import type { ScreenAnchor } from "./playersShared";
import { impactDelay, tracerStyle } from "./combatTiming";
import type { TracerStyle } from "./combatTiming";
import type {
  StageContext,
  StageFrame,
  StageModule,
  StagePlayer,
} from "./types";

const MAX = 32;
/** Hurt flash and halo. */
const HURT = 0.45;
/** Portrait and name fade once dead. */
const FADE_DEAD = 0.35;
/** A step's bob, rising at full running speed (CS2 runs at ~250u/s). */
const STEP_HZ = 1.1;
const STEP_LIFT = 2.6;
const RUN_SPEED = 250;
/** A shot nudges its shooter back this far, over this long. */
const RECOIL_DIST = 5;
const RECOIL_SECS = 0.1;
/** How much a player off the storey in view fades: to about 40%. */
const OFF_LEVEL_DIM = 0.6;
/** A death mark is never drawn wider than this radius on screen, CSS px. */
const DEAD_MARK_PX = 40;
const MUZZLE_BLOOM = 0.09;
/** The icon-only weapon chip's gun height, CSS px at 1080p, at any zoom. */
const CHIP_PX = 13;

/** Stable 0..1 per id, so each player steps on their own beat. */
function hashUnit(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function boxHitsCircle(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x: number,
  y: number,
  r: number,
) {
  const dx = Math.max(x0 - x, 0, x - x1);
  const dy = Math.max(y0 - y, 0, y - y1);
  return dx * dx + dy * dy < r * r;
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Players as EM-style pucks: a dark team rim with an emissive core and a
 * facing tick, a contact shadow, a selection halo, and a team X where they
 * fell. A fixed-size portrait with a name plate floats above each one.
 * Five draws for everyone: decals, pucks, their x-ray ghosts, portraits,
 * and the name plates over them.
 */
export type PlayersModule = StageModule & {
  /** Where the equipment SVGs are served, "/img/equipment/" in the app. */
  setIconBase(base: string): void;
};

export function createPlayersModule(): PlayersModule {
  let iconBase = "/img/equipment/";
  let ground: GroundBatch | null = null;
  let pucks: PuckBatch | null = null;
  let atlas: BadgeAtlas | null = null;
  let badges: BadgeBatch | null = null;
  let frameNo = 0;

  const feet = new THREE.Vector3();
  const body = new THREE.Vector3();
  const kick = new THREE.Vector3();
  const anchor: ScreenAnchor = {
    x: 0,
    y: 0,
    cx: 0,
    cy: 0,
    radius: 0,
    depth: 0,
    grow: 1,
  };

  // Portrait draw order, reused every frame.
  const order = new Int32Array(MAX);
  const orderY = new Float32Array(MAX);
  const bx = new Float32Array(MAX);
  const by = new Float32Array(MAX);
  const bScale = new Float32Array(MAX);
  const bAlpha = new Float32Array(MAX);
  const bFlash = new Float32Array(MAX);
  const bDead = new Float32Array(MAX);
  const bNames = new Float32Array(MAX);
  const bHealth = new Float32Array(MAX);
  const bHalo = new Float32Array(MAX);
  const bLevel = new Float32Array(MAX);
  const puckX = new Float32Array(MAX);
  const puckY = new Float32Array(MAX);
  const puckR = new Float32Array(MAX);
  const bSlot = new Int32Array(MAX);
  const bPlayer: Array<StagePlayer | null> = new Array(MAX).fill(null);

  /** How high a badge's portrait sits over its pointer, CSS px. */
  function portraitLift(i: number) {
    return (BADGE.portraitY - BADGE.namelessDrop * (1 - bNames[i])) * bScale[i];
  }

  /** Whether badge `i`'s weapon chip on `side` stays off every other portrait and puck. */
  function chipClear(
    i: number,
    weapon: WeaponCell,
    chipScale: number,
    side: number,
    count: number,
  ) {
    const k = chipScale * bScale[i];
    const pr = BADGE.portraitRadius * bScale[i];
    const near = bx[i] + side * pr;
    const far = near + side * (9 * k + weapon.width * k);
    const x0 = Math.min(near, far);
    const x1 = Math.max(near, far);
    const cy = by[i] - portraitLift(i) + 0.4 * pr;
    const half = 0.5 * weapon.height * k + 3.5 * k;
    const y0 = cy - half;
    const y1 = cy + half;
    for (let j = 0; j < count; j++) {
      if (j === i) {
        continue;
      }
      if (
        boxHitsCircle(x0, y0, x1, y1, puckX[j], puckY[j], puckR[j]) ||
        boxHitsCircle(
          x0,
          y0,
          x1,
          y1,
          bx[j],
          by[j] - portraitLift(j),
          BADGE.portraitRadius * bScale[j],
        )
      ) {
        return false;
      }
      // Plates draw over every portrait, chips included.
      const halfW = (atlas!.nameWidth(bSlot[j]) + 7) * bScale[j];
      const plateY = by[j] - BADGE.plateY * bScale[j];
      const halfH = BADGE.plateHalfH * bScale[j];
      if (
        bNames[j] > 0.05 &&
        x0 < bx[j] + halfW &&
        x1 > bx[j] - halfW &&
        y0 < plateY + halfH &&
        y1 > plateY - halfH
      ) {
        return false;
      }
    }
    return true;
  }

  /** Damage already registered but whose round has not landed yet. */
  function pendingDamage(frame: StageFrame, style: TracerStyle, id: string) {
    let sum = 0;
    for (const damage of frame.damages) {
      if (
        damage.victimId === id &&
        damage.age <
          impactDelay(frame, style, id, damage.attackerId, damage.age)
      ) {
        sum += damage.amount;
      }
    }
    return sum;
  }

  /** The shooter's puck kicked back from their latest rounds, into `kick` (world). */
  function recoil(frame: StageFrame, id: string) {
    kick.set(0, 0, 0);
    for (const shot of frame.shots) {
      if (shot.shooterId !== id || shot.age >= RECOIL_SECS) {
        continue;
      }
      const dx = shot.to.x - shot.from.x;
      const dy = shot.to.y - shot.from.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) {
        continue;
      }
      const k = RECOIL_DIST * (1 - shot.age / RECOIL_SECS) ** 2;
      kick.x -= (dx / len) * k;
      kick.z += (dy / len) * k;
    }
    const len = Math.hypot(kick.x, kick.z);
    if (len > RECOIL_DIST * 1.4) {
      kick.multiplyScalar((RECOIL_DIST * 1.4) / len);
    }
  }

  function muzzle(frame: StageFrame, id: string) {
    let fire = 0;
    for (const shot of frame.shots) {
      if (shot.shooterId === id && shot.age < MUZZLE_BLOOM) {
        fire = Math.max(fire, 1 - shot.age / MUZZLE_BLOOM);
      }
    }
    return fire;
  }

  function draw(frame: StageFrame, ctx: StageContext) {
    if (!ground || !pucks || !atlas || !badges) {
      return;
    }
    frameNo++;
    ctx.camera.updateMatrixWorld();
    ground.begin();
    pucks.begin();
    badges.begin();
    const scale = overlayScale(ctx);
    let shown = 0;

    const shots = tracerStyle(ctx);
    for (const player of frame.players) {
      const style = TEAM_STYLE[player.team];
      // Hurt and death wait for the round drawn for them to land.
      const diedAge =
        player.diedAge === null
          ? player.alive
            ? -1
            : 10
          : player.diedAge -
            impactDelay(frame, shots, player.id, null, player.diedAge);
      const dead = diedAge >= 0;
      const deadK = dead ? clamp01(diedAge / 0.18) : 0;
      const hurtDelay =
        player.hurtAge === null
          ? 0
          : impactDelay(frame, shots, player.id, null, player.hurtAge);
      const hurtAge =
        player.hurtAge === null || player.hurtAge < hurtDelay
          ? null
          : player.hurtAge - hurtDelay;
      const health =
        player.hurtAge !== null && player.hurtAge < 0.6
          ? Math.min(
              100,
              player.health + pendingDamage(frame, shots, player.id),
            )
          : player.health;
      const flash =
        !dead && hurtAge !== null && hurtAge < HURT
          ? (1 - hurtAge / HURT) ** 1.5
          : 0;
      const punch =
        !dead && hurtAge !== null && hurtAge < 0.2
          ? Math.sin((Math.PI * hurtAge) / 0.2)
          : 0;
      const fire = dead ? 0 : muzzle(frame, player.id);
      // A blinded player glows white, breathing so it reads as a state.
      const blindGlow =
        player.blind * (0.8 + 0.2 * Math.sin(ctx.clock * 9 + player.x * 0.01));
      const yaw = (player.yaw * Math.PI) / 180;

      const onScreen = puckAnchor(ctx, player, anchor);
      const grow = onScreen ? anchor.grow : 1;

      // The dead are one flat mark on the death spot: the puck sinks into a
      // charcoal disc with the team X over it, capped in size up close.
      const size =
        dead && onScreen
          ? grow * Math.min(1, DEAD_MARK_PX / Math.max(anchor.radius, 1e-3))
          : grow;
      ctx.wpos(player, feet);

      // On a stacked map, whoever stands off the storey in view fades back.
      const band = frame.levelBand;
      const level = !band
        ? 0
        : player.z > band.max
          ? 1
          : player.z < band.min
            ? -1
            : 0;
      const keep = level ? 1 - OFF_LEVEL_DIM : 1;

      const markK = dead ? clamp01((diedAge - 0.05) / 0.12) : 0;
      ground.push(
        feet,
        keep,
        3,
        3,
        player.selected && !dead && !level ? 1 : 0,
        flash * keep,
        hurtAge !== null ? clamp01(hurtAge / HURT) : 0,
        markK * keep,
        1 + 0.4 * (1 - markK) ** 2,
        size,
        style.core,
        style.mark,
        dead ? 0 : blindGlow * keep,
        deadK * keep,
      );
      // Alive, the puck steps as they walk, kicks back as they fire and
      // sits low while they crouch. Steps run off the round clock, so a
      // paused replay holds still.
      body.copy(feet);
      let radius = 1;
      let height = 1;
      if (!dead) {
        const run = clamp01(((player.speed ?? 0) - 40) / (RUN_SPEED - 40));
        const step = Math.abs(
          Math.sin(
            frame.time * STEP_HZ * Math.PI * 2 + hashUnit(player.id) * 6.283,
          ),
        );
        body.y += STEP_LIFT * run * step * size;
        radius += 0.04 * run * (step - 0.5);
        recoil(frame, player.id);
        body.addScaledVector(kick, size);
        if (player.ducked) {
          radius *= 0.9;
          height *= 0.6;
        }
      }
      if (deadK < 1) {
        pucks.push(
          body,
          yaw,
          size * radius * (1 + 0.07 * punch) * (1 - 0.2 * deadK),
          size * height * (dead ? 1 - deadK : 1 + 0.1 * punch),
          player.hasBomb && !dead,
          player.selected,
          player.ducked && !dead,
          dead ? DEAD_PUCK : style.rim,
          style.core,
          flash,
          fire,
          deadK,
          player.blind,
          level ? 1 : 0,
        );
      }

      const alpha = dead ? 1 - clamp01(diedAge / FADE_DEAD) : 1;
      if (alpha <= 0 || shown >= MAX || !onScreen) {
        continue;
      }
      if (
        anchor.x < -120 ||
        anchor.x > ctx.width + 120 ||
        anchor.y < -40 ||
        anchor.y > ctx.height + 160
      ) {
        continue;
      }
      const i = shown++;
      const badgePunch =
        !dead && hurtAge !== null && hurtAge < 0.22
          ? Math.sin((Math.PI * hurtAge) / 0.22)
          : 0;
      const zoom = badgeZoom(ctx, anchor.radius);
      bx[i] = anchor.x;
      by[i] = anchor.y;
      bNames[i] = nameShown(zoom, player.selected);
      bHealth[i] = clamp01(health / 100);
      bHalo[i] = dead ? 0 : blindGlow;
      bLevel[i] = level;
      puckX[i] = anchor.cx;
      puckY[i] = anchor.cy;
      puckR[i] = anchor.radius * grow;
      bScale[i] =
        scale *
        zoom *
        (1 + 0.14 * badgePunch) *
        (player.selected ? 1.06 : 1) *
        (dead ? 1 - 0.15 * (1 - alpha) : 1);
      bAlpha[i] = alpha;
      bFlash[i] = flash;
      bDead[i] = deadK;
      bSlot[i] = atlas.slot(
        player.id,
        player.name,
        player.team,
        player.avatarUrl,
        player.slot ?? null,
        frameNo,
      );
      bPlayer[i] = player;
      // Lower on screen draws on top, like coins; the selected one above all.
      orderY[i] = anchor.y + (player.selected ? 1e6 : 0);
      let j = i;
      while (j > 0 && orderY[order[j - 1]] > orderY[i]) {
        order[j] = order[j - 1];
        j--;
      }
      order[j] = i;
    }

    for (let n = 0; n < shown; n++) {
      const i = order[n];
      const player = bPlayer[i]!;
      const action = bDead[i] > 0 ? null : player.bombAction;
      const weapon =
        bDead[i] === 0 ? atlas.weapon(player.weapon, frameNo) : null;
      const chipScale = (CHIP_PX * scale) / (BADGE.iconH * bScale[i]);
      // Once the plate's gun would draw smaller than the chip's, the gun
      // moves off the plate into the chip.
      // One weapon display at a time: on the plate while it is big enough
      // to read, else in the chip.
      const plateFits =
        bNames[i] > 0.5 && BADGE.iconH * bScale[i] >= 0.95 * CHIP_PX * scale;
      let plateIcon = plateFits ? 1 : 0;
      let chipSide = 1;
      let chip = 0;
      if (weapon && !plateFits) {
        // The side that covers no one; with both blocked the gun stays on
        // the plate, or goes when there is none (the selected player's
        // always shows).
        if (chipClear(i, weapon, chipScale, 1, shown)) {
          chip = 1;
        } else if (chipClear(i, weapon, chipScale, -1, shown)) {
          chip = 1;
          chipSide = -1;
        } else if (player.selected) {
          chip = 1;
        } else if (bNames[i] > 0.5) {
          plateIcon = 1;
        }
      }
      badges.push(
        bx[i],
        by[i],
        bScale[i],
        bSlot[i],
        atlas.nameWidth(bSlot[i]),
        TEAM_STYLE[player.team].ring,
        bAlpha[i],
        player.blind,
        bFlash[i],
        bHealth[i],
        bDead[i] > 0
          ? 0
          : player.bombAction?.kind === "defuse" && !player.bombAction.kit
            ? 2
            : player.hasKit
              ? 1
              : 0,
        clamp01((player.blind - 0.03) / 0.12),
        bDead[i],
        bNames[i],
        weapon,
        bHalo[i],
        chip,
        chipScale,
        chipSide,
        plateIcon,
        bLevel[i],
        bLevel[i] ? OFF_LEVEL_DIM : 0,
        action ? clamp01(action.age / action.duration) : 0,
        action ? (action.kind === "plant" ? 1 : 2) : 0,
        player.weaponAge != null && player.weaponAge < 0.4
          ? Math.exp(-player.weaponAge * 9)
          : 0,
        player.ducked && bDead[i] === 0 ? 1 : 0,
      );
      bPlayer[i] = null;
    }

    badges.setKit(atlas.kitIcon());
    atlas.flush();
    ground.end();
    pucks.end();
    badges.end();
  }

  return {
    name: "players",
    init(ctx) {
      ground = createGroundBatch(MAX);
      pucks = createPuckBatch(MAX);
      atlas = createBadgeAtlas(iconBase);
      badges = createBadgeBatch(atlas.texture, MAX);
      badges.setViewport(ctx.width, ctx.height);
      ctx.scene.add(
        ground.mesh,
        pucks.mesh,
        pucks.ghost,
        badges.mesh,
        badges.plates,
      );
    },
    update(frame, ctx) {
      draw(frame, ctx);
    },
    resize(ctx) {
      badges?.setViewport(ctx.width, ctx.height);
    },
    setIconBase(base) {
      iconBase = base;
      atlas?.setIconBase(base);
    },
    settle() {
      return atlas?.settle() ?? Promise.resolve();
    },
    dispose() {
      pucks?.ghost.removeFromParent();
      badges?.plates.removeFromParent();
      for (const batch of [ground, pucks, badges]) {
        batch?.mesh.removeFromParent();
        batch?.dispose();
      }
      atlas?.dispose();
      ground = null;
      pucks = null;
      badges = null;
      atlas = null;
    },
  };
}
