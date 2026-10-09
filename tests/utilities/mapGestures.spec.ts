import { describe, expect, it } from "vitest";
import {
  clampMapPan,
  dragZoom,
  isDoubleTap,
  isTap,
  momentumStep,
  pinchView,
  releaseVelocity,
  resistZoom,
  zoomViewAt,
  type MapPoint,
  type MapView,
} from "~/utilities/mapGestures";

const frame = { width: 400, height: 400 };
const limits = { min: 1, max: 6 };
const fit: MapView = { zoom: 1, x: 0, y: 0 };

// The map point drawn at screen offset `at` under `view`.
function mapPointAt(view: MapView, at: MapPoint): MapPoint {
  return { x: (at.x - view.x) / view.zoom, y: (at.y - view.y) / view.zoom };
}

describe("resistZoom", () => {
  it("is the zoom itself inside the range", () => {
    expect(resistZoom(1, 1, 6)).toBe(1);
    expect(resistZoom(3.3, 1, 6)).toBe(3.3);
    expect(resistZoom(6, 1, 6)).toBe(6);
  });

  it("gives a little past either end, and never more than a little", () => {
    const over = resistZoom(9, 1, 6);
    expect(over).toBeGreaterThan(6);
    expect(over).toBeLessThan(9);
    expect(resistZoom(1000, 1, 6)).toBeLessThan(6 * Math.exp(0.22) + 0.001);

    const under = resistZoom(0.5, 1, 6);
    expect(under).toBeLessThan(1);
    expect(under).toBeGreaterThan(0.5);
    expect(resistZoom(0.0001, 1, 6)).toBeGreaterThan(Math.exp(-0.22) - 0.001);
  });

  it("leaves the limit smoothly rather than with a jump", () => {
    expect(resistZoom(6.01, 1, 6)).toBeCloseTo(6.01, 2);
    expect(resistZoom(0.99, 1, 6)).toBeCloseTo(0.99, 2);
  });
});

describe("pinchView", () => {
  it("keeps the map point between the fingers between the fingers", () => {
    const start: MapView = { zoom: 2, x: 30, y: -20 };
    const from: [MapPoint, MapPoint] = [
      { x: -40, y: 10 },
      { x: 60, y: 30 },
    ];
    const to: [MapPoint, MapPoint] = [
      { x: -70, y: 0 },
      { x: 90, y: 60 },
    ];
    const held = mapPointAt(start, { x: 10, y: 20 });

    const view = pinchView(start, from, to, limits, frame);

    expect(view.zoom).toBeGreaterThan(2);
    const now = mapPointAt(view, { x: 10, y: 30 });
    expect(now.x).toBeCloseTo(held.x);
    expect(now.y).toBeCloseTo(held.y);
  });

  it("pans with two fingers that move together without spreading", () => {
    const start: MapView = { zoom: 3, x: 0, y: 0 };
    const view = pinchView(
      start,
      [
        { x: -50, y: 0 },
        { x: 50, y: 0 },
      ],
      [
        { x: -20, y: 40 },
        { x: 80, y: 40 },
      ],
      limits,
      frame,
    );

    expect(view).toEqual({ zoom: 3, x: 30, y: 40 });
  });

  it("does not snap to steps while pinching", () => {
    const view = pinchView(
      fit,
      [
        { x: -50, y: 0 },
        { x: 50, y: 0 },
      ],
      [
        { x: -68.5, y: 0 },
        { x: 68.5, y: 0 },
      ],
      limits,
      frame,
    );

    expect(view.zoom).toBeCloseTo(1.37);
  });

  it("gives at the limits without the resistance compounding frame to frame", () => {
    const from: [MapPoint, MapPoint] = [
      { x: -100, y: 0 },
      { x: 100, y: 0 },
    ];
    const far: [MapPoint, MapPoint] = [
      { x: -20, y: 0 },
      { x: 20, y: 0 },
    ];
    const once = pinchView(fit, from, far, limits, frame);
    const again = pinchView(fit, from, far, limits, frame);

    expect(once.zoom).toBeLessThan(1);
    expect(once.zoom).toBeGreaterThan(0.78);
    expect(again).toEqual(once);
    expect(once.x).toBe(0);
    expect(once.y).toBe(0);
  });
});

describe("clampMapPan and zoomViewAt", () => {
  it("never lets the map's edge come inside the frame", () => {
    expect(clampMapPan({ zoom: 2, x: 900, y: -900 }, frame)).toEqual({
      zoom: 2,
      x: 200,
      y: -200,
    });
    expect(clampMapPan({ zoom: 1, x: 40, y: 40 }, frame)).toEqual(fit);
  });

  it("zooms toward the tapped point", () => {
    const at = { x: 80, y: -60 };
    const before = mapPointAt(fit, at);
    const view = zoomViewAt(fit, 2, at, frame);
    const after = mapPointAt(view, at);

    expect(view.zoom).toBe(2);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
});

describe("dragZoom", () => {
  it("zooms in on a drag down and out on a drag up", () => {
    expect(dragZoom(2, 100)).toBeGreaterThan(2);
    expect(dragZoom(2, -100)).toBeLessThan(2);
    expect(dragZoom(2, 0)).toBe(2);
  });
});

describe("releaseVelocity", () => {
  it("reads the speed off the last moments of the drag", () => {
    const velocity = releaseVelocity(
      [
        { t: 0, x: 0, y: 0 },
        { t: 900, x: 10, y: 0 },
        { t: 950, x: 40, y: 10 },
        { t: 1000, x: 70, y: 20 },
      ],
      1000,
    );

    expect(velocity.x).toBeCloseTo(0.6);
    expect(velocity.y).toBeCloseTo(0.2);
  });

  it("is nothing for a finger that stopped before it lifted", () => {
    expect(
      releaseVelocity(
        [
          { t: 0, x: 0, y: 0 },
          { t: 50, x: 200, y: 0 },
        ],
        400,
      ),
    ).toEqual({ x: 0, y: 0 });
  });
});

describe("momentumStep", () => {
  it("slows the whole way and comes to rest", () => {
    let velocity = { x: 1.2, y: -0.4 };
    let travelled = 0;
    let last = Infinity;
    let frames = 0;
    for (;;) {
      const step = momentumStep(velocity, 16);
      expect(Math.abs(step.dx)).toBeLessThan(last);
      last = Math.abs(step.dx);
      travelled += step.dx;
      velocity = step.velocity;
      frames++;
      if (step.done) {
        break;
      }
    }

    expect(frames).toBeGreaterThan(20);
    expect(frames).toBeLessThan(200);
    expect(travelled).toBeGreaterThan(300);
    expect(travelled).toBeLessThan(1.2 * 325 + 1);
  });

  it("covers the same ground at 60Hz and 120Hz", () => {
    const glide = (dt: number) => {
      let velocity = { x: 1, y: 0 };
      let travelled = 0;
      for (let t = 0; t < 480; t += dt) {
        const step = momentumStep(velocity, dt);
        travelled += step.dx;
        velocity = step.velocity;
      }
      return travelled;
    };

    expect(glide(8)).toBeCloseTo(glide(16), 5);
  });
});

describe("taps", () => {
  it("calls a short, still press a tap and nothing else", () => {
    expect(isTap(3, 120)).toBe(true);
    expect(isTap(8, 250)).toBe(true);
    expect(isTap(9, 120)).toBe(false);
    expect(isTap(2, 400)).toBe(false);
  });

  it("pairs two taps only when they are close in time and place", () => {
    const first = { t: 1000, x: 100, y: 100 };

    expect(isDoubleTap(first, { t: 1200, x: 110, y: 95 })).toBe(true);
    expect(isDoubleTap(first, { t: 1400, x: 100, y: 100 })).toBe(false);
    expect(isDoubleTap(first, { t: 1200, x: 160, y: 100 })).toBe(false);
    expect(isDoubleTap(null, { t: 1200, x: 100, y: 100 })).toBe(false);
  });
});
