// Points are in frame pixels measured from the frame's centre, which is where
// the board's transform has its origin: a map point `c` is drawn at
// `pan + c * zoom`.

export type MapPoint = { x: number; y: number };
export type MapView = { zoom: number; x: number; y: number };
export type MapFrame = { width: number; height: number };

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

// Panning past the edge would show what is behind the map, so the offset is
// held to whatever the zoom overflows the frame by -- nothing at 1x or under.
export function clampMapPan(view: MapView, frame: MapFrame): MapView {
  const slackX = Math.max(0, (frame.width * (view.zoom - 1)) / 2);
  const slackY = Math.max(0, (frame.height * (view.zoom - 1)) / 2);
  return {
    zoom: view.zoom,
    x: clamp(view.x, -slackX, slackX) + 0,
    y: clamp(view.y, -slackY, slackY) + 0,
  };
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
  );
}

// Zoom to `zoom` keeping the map point under `at` where it is.
export function zoomViewAt(
  view: MapView,
  zoom: number,
  at: MapPoint,
  frame: MapFrame,
): MapView {
  const ratio = zoom / view.zoom;
  return clampMapPan(
    {
      zoom,
      x: at.x - (at.x - view.x) * ratio,
      y: at.y - (at.y - view.y) * ratio,
    },
    frame,
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
