// Smokes and fires as the demo parser recorded them, straight off the playback
// blob. The replay stage draws from these.
//
// A CS2 smoke is not a sphere: it fills the space it is thrown into, stops at
// whatever it hits, settles wider than it is tall, and thins where an explosion
// disturbs it. The parser derives that shape by flooding the free space around
// the detonation point against the map's collision mesh, and ships a density
// field.

/** One cloud's density field, straight off the playback blob (schema v9+). */
export type SmokeVolume = {
  gid?: number | null;
  round?: number;
  start_tick: number;
  /** Engine SmokeExpired tick. Absent when the round ended first. */
  end_tick?: number;
  /** World position of the grid's minimum corner, in source units. */
  ox: number;
  oy: number;
  oz: number;
  /** Cell edge length, in source units. */
  vs: number;
  dx: number;
  dy: number;
  dz: number;
  /**
   * base64, two cells per byte with the low nibble first, over dx*dy*dz cells
   * x-major then y then z. 0 is clear, 15 is fully dense.
   */
  den?: string;
};

// Fire needs no reconstruction: the engine networks every individual flame, so
// the parser records exactly where each one burned and for how long.

/** One flame: where it burned, and the tick range it was alight. */
export type InfernoFire = {
  x: number;
  y: number;
  z: number;
  /** First tick alight. */
  s: number;
  /** Last tick alight — early when a smoke extinguished it. */
  e: number;
};

/** One molotov or incendiary burn. */
export type Inferno = {
  id: number;
  round?: number;
  thrower?: string;
  thrower_team?: string;
  start_tick: number;
  end_tick?: number;
  fires?: InfernoFire[];
};
