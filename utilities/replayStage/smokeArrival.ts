/**
 * When a CS2 smoke reaches each part of its volume, by the part's share of
 * the final reach. Measured on Valve's grids: ~55% of the reach is there on
 * the detonation tick, 76-93% within a second, the last wisps by about four.
 * Shared by the worker (which bakes reach shares) and the module (which turns
 * a smoke's age into how far its front has got).
 */

/** Seconds after detonation the smoke reaches share `f` of its reach. */
export function smokeArrivalSeconds(f: number) {
  if (f <= 0.55) {
    return 0;
  }
  if (f <= 0.86) {
    return Math.pow((f - 0.55) / 0.31, 1.2);
  }
  return 1 + 3 * Math.pow((f - 0.86) / 0.14, 1.6);
}

/** Share of its reach a smoke has filled `seconds` after detonation. */
export function smokeReachedBy(seconds: number) {
  if (seconds <= 0) {
    return 0.55;
  }
  if (seconds <= 1) {
    return 0.55 + 0.31 * Math.pow(seconds, 1 / 1.2);
  }
  return Math.min(1, 0.86 + 0.14 * Math.pow((seconds - 1) / 3, 1 / 1.6));
}
