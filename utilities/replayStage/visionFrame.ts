import { lerpAngle, upperBound } from "./frameIndex";
import type { RoundIndex } from "./frameIndex";
import type { StageVisionPast } from "./types";

/** Spacing of the samples, seconds, and how far back they go. */
export const VISION_PAST_STEP = 1 / 16;
export const VISION_PAST_COUNT = 10;
export const VISION_POSE = 5;

/** One ids array per round, so a reader can key a lookup on it. */
const idsOf = new WeakMap<RoundIndex, string[]>();

/**
 * Everyone's pose on a fixed grid of the round's clock just before `tick`,
 * newest first. The grid does not move with the frame, so the moment an enemy
 * first came into sight stays put while the frame plays on: the "spotted"
 * pulse ages smoothly instead of restarting every frame.
 */
export function visionPast(index: RoundIndex, tick: number): StageVisionPast {
  const rate = index.rate;
  const freezeEnd = index.range.freezeEndTick;
  const now = (tick - freezeEnd) / rate;
  const newest = Math.floor(now / VISION_PAST_STEP) * VISION_PAST_STEP;
  const tracks = index.tracks;
  const times = new Float32Array(VISION_PAST_COUNT);
  const poses = new Float32Array(
    VISION_PAST_COUNT * tracks.length * VISION_POSE,
  );
  let ids = idsOf.get(index);
  if (!ids) {
    ids = tracks.map((track) => track.id);
    idsOf.set(index, ids);
  }
  for (let m = 0; m < VISION_PAST_COUNT; m++) {
    const time = newest - m * VISION_PAST_STEP;
    times[m] = time;
    const at = freezeEnd + time * rate;
    for (let p = 0; p < tracks.length; p++) {
      const track = tracks[p];
      const rows = track.rows;
      const o = (m * tracks.length + p) * VISION_POSE;
      const i = upperBound(track.ticks, at) - 1;
      const a = rows[Math.max(0, Math.min(rows.length - 1, i))];
      if (!a) {
        continue;
      }
      const b = i >= 0 && i < rows.length - 1 ? rows[i + 1] : a;
      const k = b === a ? 0 : (at - a.tick) / (b.tick - a.tick);
      const alive = track.deathTick === null || at < track.deathTick;
      poses[o] = a.x + (b.x - a.x) * k;
      poses[o + 1] = a.y + (b.y - a.y) * k;
      poses[o + 2] = a.z + (b.z - a.z) * k;
      poses[o + 3] = lerpAngle(a.yaw ?? 0, b.yaw ?? a.yaw ?? 0, k);
      poses[o + 4] = (alive ? 1 : 0) | (a.ducked ? 2 : 0);
    }
  }
  return { times, ids, poses };
}
