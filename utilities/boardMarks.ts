// How big the things drawn on a map are, and how they are hit. The map is an
// svg in a fixed coordinate space (`canvas` units across) stretched over a
// square `frame` CSS px wide and then magnified by `zoom`, so a size written
// in canvas units comes out at a different size on every screen and at every
// zoom unless it is worked back from the px it should be.

// A mark is never drawn smaller than this share of its written size. The
// sizes were chosen on a board about as wide as the canvas; on a phone the
// board is a third of that, and without a floor a 17px ring is a 6px dot.
export const MARK_MIN_SCALE = 0.7;
// Under a finger, which covers what it points at, marks are drawn larger than
// they were written: a landing ring comes out 22px across and the square you
// stand on 14px, before the map is zoomed at all.
export const MARK_TOUCH_SCALE = 1.3;
// Marks hold their size while the map grows under them, and gain a little:
// zoomed all the way in they are a third bigger than at rest, never smaller.
export const MARK_GROW = 0.15;
// What a finger can hit, edge to edge.
export const TOUCH_TARGET_PX = 44;
// And a mouse, which is aimed: a target can be near the size of what is
// drawn, but not smaller than this however small that is.
export const POINTER_TARGET_PX = 24;

const fit = (frame: number, canvas: number) =>
  frame > 0 && canvas > 0 ? frame / canvas : 1;

/** How many canvas units one CSS px on screen is, at this zoom. */
export function unitsPerPx(zoom: number, frame: number, canvas: number) {
  return 1 / (fit(frame, canvas) * Math.max(zoom, 0.01));
}

/**
 * How many CSS px on screen one unit of a mark's written size is drawn at.
 * `coarse` is a screen that is touched rather than pointed at.
 */
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

/**
 * What a mark's written size is multiplied by to get canvas units: the zoom
 * is divided back out, so the mark is the same on screen however far in the
 * map is.
 */
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

/**
 * The radius, in canvas units, of the smallest thing that can be hit: by a
 * finger on a screen that is touched (`coarse`), by a mouse otherwise.
 */
export function hitRadius(
  zoom: number,
  frame: number,
  canvas: number,
  coarse: boolean,
) {
  const across = coarse ? TOUCH_TARGET_PX : POINTER_TARGET_PX;
  return (across / 2) * unitsPerPx(zoom, frame, canvas);
}

export type MarkPoint = { id: string; x: number; y: number };

/**
 * Which mark a tap meant. Finger-sized targets overlap wherever two marks are
 * closer than a fingertip, and the one drawn last would take every tap in the
 * overlap; the nearest one to the tap is the one that was aimed at.
 */
export function nearestMark(
  points: MarkPoint[],
  at: { x: number; y: number },
  within: number,
): string | null {
  let nearest: string | null = null;
  let best = within;
  for (const point of points) {
    const distance = Math.hypot(point.x - at.x, point.y - at.y);
    if (distance <= best) {
      best = distance;
      nearest = point.id;
    }
  }
  return nearest;
}

// Past this many CSS px to one pixel of the radar there is nothing more to
// see, only the same pixels larger.
export const RADAR_MAX_MAGNIFY = 3;

/**
 * How far in the map goes: to `ceiling`, unless the radar runs out of pixels
 * first. Never less than `floor`, so a small picture standing in while the
 * real one loads does not lock the zoom.
 */
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
