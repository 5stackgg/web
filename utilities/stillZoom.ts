// A still zoomed inside a fixed frame: `scale` 1 is the whole image filling
// the frame, and `x`/`y` move it from centre, in frame pixels.
export type StillView = { scale: number; x: number; y: number };

export type StillFrame = { width: number; height: number };

export const STILL_ZOOM_MIN = 1;
export const STILL_ZOOM_MAX = 6;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Never lets the image's edge come inside the frame, so there is no empty
// border to drag into.
export function clampStillView(view: StillView, frame: StillFrame): StillView {
  const scale = clamp(view.scale, STILL_ZOOM_MIN, STILL_ZOOM_MAX);
  const reachX = ((scale - 1) * frame.width) / 2;
  const reachY = ((scale - 1) * frame.height) / 2;
  // `+ 0` turns -0 into 0.
  return {
    scale,
    x: clamp(view.x, -reachX, reachX) + 0,
    y: clamp(view.y, -reachY, reachY) + 0,
  };
}

/**
 * Zoom to `scale` keeping the image point under `at` (frame pixels from the
 * frame's centre) where it is, so the zoom goes toward the cursor.
 */
export function zoomStillAt(
  view: StillView,
  scale: number,
  at: { x: number; y: number },
  frame: StillFrame,
): StillView {
  const next = clamp(scale, STILL_ZOOM_MIN, STILL_ZOOM_MAX);
  const ratio = next / view.scale;
  return clampStillView(
    {
      scale: next,
      x: at.x - (at.x - view.x) * ratio,
      y: at.y - (at.y - view.y) * ratio,
    },
    frame,
  );
}

export function panStill(
  view: StillView,
  by: { x: number; y: number },
  frame: StillFrame,
): StillView {
  return clampStillView(
    { scale: view.scale, x: view.x + by.x, y: view.y + by.y },
    frame,
  );
}

// Past the image's own pixels, smoothing only blurs the crosshair: draw them
// as squares once one image pixel covers more than one screen pixel.
export function stillIsPastNative(
  scale: number,
  frameWidth: number,
  naturalWidth: number,
  devicePixelRatio = 1,
) {
  return (
    naturalWidth > 0 && frameWidth * scale * devicePixelRatio > naturalWidth
  );
}
