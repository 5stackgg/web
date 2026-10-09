import { describe, expect, it } from "vitest";
import {
  STILL_ZOOM_MAX,
  clampStillView,
  panStill,
  stillIsPastNative,
  stillSwipeStep,
  zoomStillAt,
} from "~/utilities/stillZoom";

const frame = { width: 400, height: 225 };
const fit = { scale: 1, x: 0, y: 0 };

describe("clampStillView", () => {
  it("keeps the scale between whole-frame and 6x", () => {
    expect(clampStillView({ scale: 0.4, x: 0, y: 0 }, frame).scale).toBe(1);
    expect(clampStillView({ scale: 12, x: 0, y: 0 }, frame).scale).toBe(
      STILL_ZOOM_MAX,
    );
  });

  it("never lets an edge of the image come inside the frame", () => {
    expect(clampStillView({ scale: 2, x: 999, y: -999 }, frame)).toEqual({
      scale: 2,
      x: 200,
      y: -112.5,
    });
    expect(clampStillView({ scale: 1, x: 50, y: 20 }, frame)).toEqual(fit);
  });
});

describe("zoomStillAt", () => {
  it("zooms about the centre without moving it", () => {
    expect(zoomStillAt(fit, 3, { x: 0, y: 0 }, frame)).toEqual({
      scale: 3,
      x: 0,
      y: 0,
    });
  });

  it("keeps the point under the cursor under the cursor", () => {
    const at = { x: 100, y: -40 };
    const view = zoomStillAt(fit, 2, at, frame);
    const before = { x: (at.x - fit.x) / fit.scale, y: (at.y - fit.y) / 1 };
    const after = {
      x: (at.x - view.x) / view.scale,
      y: (at.y - view.y) / view.scale,
    };

    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("comes back to the whole frame, centred, when zoomed all the way out", () => {
    const zoomed = zoomStillAt(fit, 4, { x: 150, y: 80 }, frame);
    expect(zoomStillAt(zoomed, 0.5, { x: -150, y: 0 }, frame)).toEqual(fit);
  });
});

describe("panStill", () => {
  it("does not move a still that is not zoomed", () => {
    expect(panStill(fit, { x: 40, y: 40 }, frame)).toEqual(fit);
  });

  it("drags a zoomed still only as far as its edge", () => {
    const zoomed = { scale: 3, x: 0, y: 0 };
    expect(panStill(zoomed, { x: 150, y: 0 }, frame)).toEqual({
      scale: 3,
      x: 150,
      y: 0,
    });
    expect(panStill(zoomed, { x: 900, y: 900 }, frame)).toEqual({
      scale: 3,
      x: 400,
      y: 225,
    });
  });
});

describe("stillIsPastNative", () => {
  it("turns crisp only once an image pixel is larger than a screen pixel", () => {
    expect(stillIsPastNative(1.8, 400, 1920, 2)).toBe(false);
    expect(stillIsPastNative(3, 400, 1920, 2)).toBe(true);
    expect(stillIsPastNative(6, 400, 0, 2)).toBe(false);
  });
});

describe("stillSwipeStep", () => {
  it("goes on to the next still on a swipe left, back on a swipe right", () => {
    expect(stillSwipeStep(-80, 6, 180)).toBe(1);
    expect(stillSwipeStep(80, -6, 180)).toBe(-1);
  });

  it("is not a swipe when it is short, slow, or mostly up and down", () => {
    expect(stillSwipeStep(-24, 0, 120)).toBe(0);
    expect(stillSwipeStep(-80, 0, 1200)).toBe(0);
    expect(stillSwipeStep(-60, 70, 180)).toBe(0);
  });
});
