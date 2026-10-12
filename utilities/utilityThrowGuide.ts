import type { UtilityApproachSample } from "~/types/utility";

export const UTILITY_IN_BUTTONS = {
  attack: 1,
  jump: 2,
  duck: 4,
  forward: 8,
  back: 16,
  moveLeft: 512,
  moveRight: 1024,
  attack2: 2048,
  walk: 65536,
} as const;

export type UtilityRunUpKey = "W" | "A" | "S" | "D";

export type UtilityRunUp = {
  /** Movement keys held for most of the run-up, in W A S D order. */
  keys: UtilityRunUpKey[];
  walk: boolean;
  crouch: boolean;
  jump: boolean;
  /** From the first tick those keys were down to the release. */
  ms: number;
  /** The recorder keeps 128 ticks, so a run-up that fills them may be longer. */
  capped: boolean;
};

const HELD_SHARE = 0.5;
const JUMP_LEAD_MS = 500;
const RECORDED_TICKS = 128;

const MOVE_KEYS: Array<[UtilityRunUpKey, number, UtilityRunUpKey]> = [
  ["W", UTILITY_IN_BUTTONS.forward, "S"],
  ["A", UTILITY_IN_BUTTONS.moveLeft, "D"],
  ["S", UTILITY_IN_BUTTONS.back, "W"],
  ["D", UTILITY_IN_BUTTONS.moveRight, "A"],
];

function approachSamples(approach: unknown): UtilityApproachSample[] {
  if (!Array.isArray(approach)) {
    return [];
  }
  return approach
    .filter(
      (sample): sample is UtilityApproachSample =>
        !!sample &&
        Number.isFinite(sample.t) &&
        Number.isFinite(sample.buttons),
    )
    .sort((a, b) => a.t - b.t);
}

/**
 * The recorded run-up read as keys: which movement keys were held for most
 * of it, with walk or crouch, and whether it ends in a jump. Null when there
 * is nothing to move for -- no run-up, or one where no key was held long
 * enough to be the instruction.
 */
export function utilityRunUp(approach: unknown): UtilityRunUp | null {
  const samples = approachSamples(approach);
  if (samples.length < 2) {
    return null;
  }

  const held = (bit: number) =>
    samples.filter((sample) => (sample.buttons & bit) !== 0).length /
      samples.length >=
    HELD_SHARE;

  const down = MOVE_KEYS.filter(([, bit]) => held(bit));
  const keys = down
    .filter(([, , opposite]) => !down.some(([key]) => key === opposite))
    .map(([key]) => key);
  if (keys.length === 0) {
    return null;
  }

  const mask = MOVE_KEYS.filter(([key]) => keys.includes(key)).reduce(
    (all, [, bit]) => all | bit,
    0,
  );
  const firstHeld = samples.findIndex(
    (sample) => (sample.buttons & mask) !== 0,
  );
  const release = samples[samples.length - 1];
  const jumped = (sample: UtilityApproachSample) =>
    (sample.buttons & UTILITY_IN_BUTTONS.jump) !== 0;

  return {
    keys,
    walk: held(UTILITY_IN_BUTTONS.walk),
    crouch: held(UTILITY_IN_BUTTONS.duck),
    jump:
      samples.some(
        (sample) => jumped(sample) && sample.t >= release.t - JUMP_LEAD_MS,
      ) ||
      (release.on_ground === false && samples.some(jumped)),
    ms: Math.max(0, release.t - samples[firstHeld].t),
    capped: firstHeld === 0 && samples.length >= RECORDED_TICKS,
  };
}

export function utilityRunUpSeconds(runUp: UtilityRunUp): string {
  return `${(runUp.ms / 1000).toFixed(1)}${runUp.capped ? "+" : ""}`;
}

export function utilityRunUpCaps(runUp: UtilityRunUp): string[] {
  return [
    ...(runUp.walk ? ["Shift"] : []),
    ...(runUp.crouch ? ["Ctrl"] : []),
    ...runUp.keys,
  ];
}
