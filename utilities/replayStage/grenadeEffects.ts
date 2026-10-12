/**
 * What a grenade turns into once it is down: how long each effect stays on the
 * stage, in seconds, and how far a blast reaches, in source units. A demo's
 * replay and a lineup's both time their effects from these.
 */

/** CS2's smoke: a lineup's cloud, or a demo's whose end was not recorded. */
export const SMOKE_SECS = 20;
/** CS2's molotov / incendiary burn time, for a fire without an end tick. */
export const INFERNO_BURN_SECS = 7.03;
/** CS2's decoy runs its full time; the blob records no expiry for one. */
export const DECOY_SECS = 15;
/** A flash or HE burst. */
export const DETONATION_SECS = 3;
/** An explosion's shockwave. */
export const BLAST_SECS = 2;
/** How long a flame takes to catch, and to gutter out. */
export const FLAME_IGNITE_SECS = 0.35;
export const FLAME_DIE_SECS = 0.6;

// Kept in step with the parser (internal/parser/smoke.go): how far an
// explosion reaches into a cloud.
export const HE_BLAST_RADIUS = 250;
export const C4_BLAST_RADIUS = 600;
