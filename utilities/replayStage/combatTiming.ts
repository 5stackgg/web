import { IMPACT_DELAY } from "./playersShared";
import type { StageContext, StageFrame, StageShot } from "./types";

/**
 * How shots are drawn:
 * - classic: a thin full-length tracer with a comet riding it.
 * - comet: every round its own short, thick, bright comet that flies.
 * - pulse: a thick beam that snaps on for a few frames with a hot pulse.
 * - bolt: a chunky glowing projectile, slower, with sparks.
 */
export type TracerStyle = "classic" | "comet" | "pulse" | "bolt";

export const TRACER_STYLES: TracerStyle[] = [
  "classic",
  "comet",
  "pulse",
  "bolt",
];

/** Source units per second a drawn round flies, and the longest it may take. */
export const COMET_SPEED = 4200;
const COMET_MAX = 0.35;
export const BOLT_SPEED = 2600;
const BOLT_MAX = 0.45;

/** A shot fires at most this long before the damage it caused registers. */
const MATCH_WINDOW = 0.3;

// Per stage: the players and combat modules share one stage context.
const styles = new WeakMap<StageContext, TracerStyle>();

export function tracerStyle(ctx: StageContext): TracerStyle {
  return styles.get(ctx) ?? "comet";
}

export function setTracerStyleFor(ctx: StageContext, style: TracerStyle) {
  styles.set(ctx, style);
}

export function shotLength(shot: StageShot) {
  return Math.hypot(
    shot.to.x - shot.from.x,
    shot.to.y - shot.from.y,
    shot.to.z - shot.from.z,
  );
}

/** Seconds from firing until the drawn round reaches `to`. */
export function shotArrival(shot: StageShot, style: TracerStyle) {
  const len = shotLength(shot);
  switch (style) {
    case "comet":
      return Math.min(len / COMET_SPEED, COMET_MAX);
    case "bolt":
      return Math.min(len / BOLT_SPEED, BOLT_MAX);
    case "pulse":
      return Math.min(0.06, Math.max(0.025, len / 16000));
    default:
      return shot.hit
        ? IMPACT_DELAY
        : Math.min(0.055, Math.max(0.028, len / 16000));
  }
}

/**
 * How long to hold back what an event `age` seconds old did to `victimId`
 * (hurt flash, death, damage number, kill burst) so it lands with the round
 * drawn for it, not on the tick the server registered it. Zero when no shot
 * caused it (grenades, fire, falls).
 */
export function impactDelay(
  frame: StageFrame,
  style: TracerStyle,
  victimId: string,
  attackerId: string | null,
  age: number,
) {
  let lead = Infinity;
  let delay = 0;
  for (const shot of frame.shots) {
    if (
      !shot.hit ||
      shot.victimId !== victimId ||
      (attackerId !== null && shot.shooterId !== attackerId)
    ) {
      continue;
    }
    const before = shot.age - age;
    if (before > -1e-3 && before < MATCH_WINDOW && before < lead) {
      lead = before;
      delay = Math.max(0, shotArrival(shot, style) - Math.max(0, before));
    }
  }
  return delay;
}
