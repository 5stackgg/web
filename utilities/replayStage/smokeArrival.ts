/**
 * How far a CS2 smoke has filled, by the share of its final reach its front
 * has got to. It bursts out of the grenade like a blast, fast and then
 * slowing: over half the reach within a third of a second, 86% by the end
 * of the burst, then the last wisps creep out until about four seconds
 * (Valve's grids are 76-93% there within a second and done by about four).
 * Shared by the worker (which bakes reach shares) and the module (which turns
 * a smoke's age into how far its front has got).
 */

const BURST_SECS = 1.2;
const BURST_SHARE = 0.86;
const SETTLED_SECS = 4;

/** Share of its reach a smoke has filled `seconds` after detonation. */
export function smokeReachedBy(seconds: number) {
  if (seconds <= 0) {
    return 0;
  }
  if (seconds <= BURST_SECS) {
    return BURST_SHARE * (1 - Math.pow(1 - seconds / BURST_SECS, 3));
  }
  return Math.min(
    1,
    BURST_SHARE +
      (1 - BURST_SHARE) *
        Math.pow((seconds - BURST_SECS) / (SETTLED_SECS - BURST_SECS), 1 / 1.6),
  );
}
