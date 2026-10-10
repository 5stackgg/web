// Points are in frame pixels measured from the frame's centre, which is where
// the board's transform has its origin: a map point `c` is drawn at
// `pan + c * zoom`.

export type MapPoint = { x: number; y: number };
export type MapView = { zoom: number; x: number; y: number };
export type MapFrame = { width: number; height: number };
// How much of each side of the frame cannot be seen, in px: under a sheet
// drawn over it, or scrolled out of sight.
export type MapInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
export type MapBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export const NO_MAP_INSETS: MapInsets = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

export const TAP_SLOP_PX = 8;
export const TAP_MAX_MS = 250;
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_SLOP_PX = 30;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function distance(a: MapPoint, b: MapPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function middle(a: MapPoint, b: MapPoint): MapPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Past either limit the zoom keeps following the fingers, less and less, and
// never gets further than `give` (in log units) beyond it.
export function resistZoom(
  zoom: number,
  min: number,
  max: number,
  give = 0.22,
) {
  if (zoom > max) {
    const over = Math.log(zoom / max);
    return max * Math.exp(give * (1 - Math.exp(-over / give)));
  }
  if (zoom < min) {
    const under = Math.log(min / zoom);
    return min * Math.exp(-give * (1 - Math.exp(-under / give)));
  }
  return zoom;
}

/**
 * What of the frame is hidden, from where the frame is and the box nothing
 * covers. A frame wholly out of sight is all inset, and no more than that.
 */
export function mapCover(frame: MapBox, visible: MapBox): MapInsets {
  const width = Math.max(0, frame.right - frame.left);
  const height = Math.max(0, frame.bottom - frame.top);
  const left = clamp(visible.left - frame.left, 0, width);
  const top = clamp(visible.top - frame.top, 0, height);
  return {
    top,
    left,
    right: clamp(frame.right - visible.right, 0, width - left),
    bottom: clamp(frame.bottom - visible.bottom, 0, height - top),
  };
}

export type MapPanLimits = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/**
 * How far the map may be moved. Its edge never comes inside the part of the
 * frame that can be seen -- that would show what is behind the map -- and
 * every edge can be brought right up to it. So zoom gives the overflow to
 * move through, and a covered side gives exactly its own depth more: at 1x
 * under a sheet the map moves up until its bottom edge meets the sheet's
 * top, and with nothing covered it does not move at all.
 */
export function mapPanLimits(
  zoom: number,
  frame: MapFrame,
  insets: MapInsets = NO_MAP_INSETS,
): MapPanLimits {
  const slackX = Math.max(0, (frame.width * (zoom - 1)) / 2);
  const slackY = Math.max(0, (frame.height * (zoom - 1)) / 2);
  return {
    minX: -slackX - insets.right + 0,
    maxX: slackX + insets.left,
    minY: -slackY - insets.bottom + 0,
    maxY: slackY + insets.top,
  };
}

export function mapCanPan(
  zoom: number,
  frame: MapFrame,
  insets: MapInsets = NO_MAP_INSETS,
): boolean {
  const limits = mapPanLimits(zoom, frame, insets);
  return limits.maxX - limits.minX >= 1 || limits.maxY - limits.minY >= 1;
}

export function clampMapPan(
  view: MapView,
  frame: MapFrame,
  insets: MapInsets = NO_MAP_INSETS,
): MapView {
  const limits = mapPanLimits(view.zoom, frame, insets);
  return {
    zoom: view.zoom,
    x: clamp(view.x, limits.minX, limits.maxX) + 0,
    y: clamp(view.y, limits.minY, limits.maxY) + 0,
  };
}

// Too little of the frame showing for anything to be brought into it.
export function mapRoomToShow(
  frame: MapFrame,
  insets: MapInsets,
  margin: number,
): boolean {
  return (
    frame.width - insets.left - insets.right > margin * 2 &&
    frame.height - insets.top - insets.bottom > margin * 2
  );
}

/**
 * The pan that brings `points` inside what can be seen, `margin` clear of
 * its edges, moving the map no further than that takes and never past its
 * limits. They are map points as the frame draws them at 1x, measured from
 * its centre, most important first: when they do not all fit, the first is
 * the one that shows, with as much of the way to the others as there is room
 * for.
 */
export function mapPanToShow(
  view: MapView,
  points: MapPoint[],
  frame: MapFrame,
  insets: MapInsets = NO_MAP_INSETS,
  margin = 0,
): MapView {
  const along = (
    pan: number,
    size: number,
    before: number,
    after: number,
    axis: "x" | "y",
  ) => {
    const low = -size / 2 + before + margin;
    const high = size / 2 - after - margin;
    // Held last, so the first point is the one the others give way to.
    return [...points].reverse().reduce((at, point) => {
      const drawn = point[axis] * view.zoom;
      return clamp(at, low - drawn, high - drawn);
    }, pan);
  };
  return clampMapPan(
    {
      zoom: view.zoom,
      x: along(view.x, frame.width, insets.left, insets.right, "x"),
      y: along(view.y, frame.height, insets.top, insets.bottom, "y"),
    },
    frame,
    insets,
  );
}

// Worked from where the pinch STARTED rather than from the last frame, so the
// resistance at the limits does not compound and the map point that was
// between the fingers stays between them.
export function pinchView(
  start: MapView,
  from: [MapPoint, MapPoint],
  to: [MapPoint, MapPoint],
  limits: { min: number; max: number },
  frame: MapFrame,
  insets: MapInsets = NO_MAP_INSETS,
): MapView {
  const spread = Math.max(1, distance(from[0], from[1]));
  const zoom = resistZoom(
    (start.zoom * distance(to[0], to[1])) / spread,
    limits.min,
    limits.max,
  );
  const held = middle(from[0], from[1]);
  const now = middle(to[0], to[1]);
  const ratio = zoom / start.zoom;
  return clampMapPan(
    {
      zoom,
      x: now.x - (held.x - start.x) * ratio,
      y: now.y - (held.y - start.y) * ratio,
    },
    frame,
    insets,
  );
}

// Zoom to `zoom` keeping the map point under `at` where it is.
export function zoomViewAt(
  view: MapView,
  zoom: number,
  at: MapPoint,
  frame: MapFrame,
  insets: MapInsets = NO_MAP_INSETS,
): MapView {
  const ratio = zoom / view.zoom;
  return clampMapPan(
    {
      zoom,
      x: at.x - (at.x - view.x) * ratio,
      y: at.y - (at.y - view.y) * ratio,
    },
    frame,
    insets,
  );
}

// Double-tap, hold, and drag: down zooms in, up zooms out, as Maps does it.
export function dragZoom(startZoom: number, dragY: number, rate = 0.01) {
  return startZoom * Math.exp(dragY * rate);
}

export type MapSample = { t: number; x: number; y: number };

// px/ms over the last `windowMs`: a finger that stopped before lifting has
// no recent samples and so no fling.
export function releaseVelocity(
  samples: MapSample[],
  now: number,
  windowMs = 100,
): MapPoint {
  const recent = samples.filter((sample) => now - sample.t <= windowMs);
  if (recent.length < 2) {
    return { x: 0, y: 0 };
  }
  const first = recent[0];
  const last = recent[recent.length - 1];
  const elapsed = last.t - first.t;
  if (elapsed <= 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: (last.x - first.x) / elapsed,
    y: (last.y - first.y) / elapsed,
  };
}

export const MOMENTUM_STOP = 0.02;

// Exponential decay, exact for any frame length: a 120Hz screen does not
// glide further.
export function momentumStep(
  velocity: MapPoint,
  dtMs: number,
  tauMs = 325,
): { dx: number; dy: number; velocity: MapPoint; done: boolean } {
  const decay = Math.exp(-dtMs / tauMs);
  const travel = tauMs * (1 - decay);
  const next = { x: velocity.x * decay, y: velocity.y * decay };
  return {
    dx: velocity.x * travel,
    dy: velocity.y * travel,
    velocity: next,
    done: Math.hypot(next.x, next.y) < MOMENTUM_STOP,
  };
}

// A press that neither wandered nor lingered is a tap; anything else was a
// drag or a hold and must not select what it ended on.
export function isTap(moved: number, heldMs: number) {
  return moved <= TAP_SLOP_PX && heldMs <= TAP_MAX_MS;
}

export function isDoubleTap(
  previous: MapSample | null,
  tap: MapSample,
): boolean {
  return (
    !!previous &&
    tap.t - previous.t <= DOUBLE_TAP_MS &&
    Math.hypot(tap.x - previous.x, tap.y - previous.y) <= DOUBLE_TAP_SLOP_PX
  );
}
