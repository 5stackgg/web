// The map is an svg in a fixed coordinate space (`canvas` units across)
// stretched over a square `frame` CSS px wide and then magnified by `zoom`,
// so a size written in canvas units comes out different on every screen and
// at every zoom unless it is worked back from the px it should be.

// The sizes were chosen on a board about as wide as the canvas. On a phone
// the board is a third of that: without a floor a 17px ring is a 6px dot.
export const MARK_MIN_SCALE = 0.7;
// Under a finger, which covers what it points at: a landing ring comes out
// 22px across and the square you stand on 14px, before any zoom.
export const MARK_TOUCH_SCALE = 1.3;
// Zoomed all the way in, marks are a third bigger than at rest.
export const MARK_GROW = 0.15;
export const TOUCH_TARGET_PX = 44;
export const POINTER_TARGET_PX = 24;

const fit = (frame: number, canvas: number) =>
  frame > 0 && canvas > 0 ? frame / canvas : 1;

/** Canvas units to one CSS px on screen, at this zoom. */
export function unitsPerPx(zoom: number, frame: number, canvas: number) {
  return 1 / (fit(frame, canvas) * Math.max(zoom, 0.01));
}

/** CSS px on screen to one unit of a mark's written size. */
export function markScale(
  zoom: number,
  frame: number,
  canvas: number,
  coarse = false,
) {
  return (
    Math.max(coarse ? MARK_TOUCH_SCALE : MARK_MIN_SCALE, fit(frame, canvas)) *
    Math.max(1, zoom) ** MARK_GROW
  );
}

/** What a mark's written size is multiplied by to get canvas units. */
export function markInk(
  zoom: number,
  frame: number,
  canvas: number,
  coarse = false,
) {
  return (
    markScale(zoom, frame, canvas, coarse) * unitsPerPx(zoom, frame, canvas)
  );
}

/** The radius, in canvas units, of the smallest thing that can be hit. */
export function hitRadius(
  zoom: number,
  frame: number,
  canvas: number,
  coarse: boolean,
) {
  const across = coarse ? TOUCH_TARGET_PX : POINTER_TARGET_PX;
  return (across / 2) * unitsPerPx(zoom, frame, canvas);
}

// `within` is how far from its centre a tap still means it; `drawn` is how
// far out its ink goes.
export type TapTarget = {
  key: string;
  x: number;
  y: number;
  within: number;
  drawn: number;
};

/**
 * Finger-sized targets overlap wherever two things are closer than a
 * fingertip, and whichever is drawn last would take every tap in the overlap
 * -- a lineup's mark over the ring it lands in, say. The one whose centre is
 * nearest the tap is the one that was aimed at.
 *
 * `direct` says the tap landed on the thing as drawn, not in the room left
 * round it for a finger that misses.
 */
export function tapTarget(
  targets: TapTarget[],
  at: { x: number; y: number },
): { key: string; direct: boolean } | null {
  let nearest: TapTarget | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    const distance = Math.hypot(target.x - at.x, target.y - at.y);
    if (distance <= target.within && distance < best) {
      best = distance;
      nearest = target;
    }
  }
  return nearest ? { key: nearest.key, direct: best <= nearest.drawn } : null;
}

// CSS px to one pixel of the radar, past which there is nothing more to see.
export const RADAR_MAX_MAGNIFY = 3;

// Never less than `floor`, so a small picture standing in while the real one
// loads does not lock the zoom.
export function maxZoomFor(
  naturalWidth: number,
  frame: number,
  ceiling: number,
  floor = 3,
) {
  if (naturalWidth <= 0 || frame <= 0) {
    return ceiling;
  }
  return Math.min(
    ceiling,
    Math.max(floor, (naturalWidth * RADAR_MAX_MAGNIFY) / frame),
  );
}
