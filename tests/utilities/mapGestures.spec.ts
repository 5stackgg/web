import { describe, expect, it } from "vitest";
import {
  clampMapPan,
  dragZoom,
  isDoubleTap,
  isTap,
  mapCanPan,
  mapCover,
  mapPanLimits,
  mapPanToShow,
  mapRoomToShow,
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

// A sheet drawn over the bottom 100px of the frame.
const sheet = { top: 0, right: 0, bottom: 100, left: 0 };

// Where a map point is drawn in the frame, measured from its centre.
function drawnAt(view: MapView, point: MapPoint): MapPoint {
  return { x: view.x + point.x * view.zoom, y: view.y + point.y * view.zoom };
}

describe("mapCover", () => {
  const board = { left: 0, top: 170, right: 390, bottom: 560 };

  it("is how far the sheet's top edge comes up the frame", () => {
    expect(
      mapCover(board, { left: 0, top: 60, right: 390, bottom: 480 }),
    ).toEqual({ top: 0, right: 0, bottom: 80, left: 0 });
  });

  it("is nothing while the sheet rests below the frame", () => {
    expect(
      mapCover(board, { left: 0, top: 60, right: 390, bottom: 712 }),
    ).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("counts what has scrolled out under the top edge too", () => {
    expect(
      mapCover(
        { left: 0, top: 20, right: 390, bottom: 410 },
        { left: 0, top: 60, right: 390, bottom: 380 },
      ),
    ).toEqual({ top: 40, right: 0, bottom: 30, left: 0 });
  });

  it("is the whole frame and no more when all of it is covered", () => {
    expect(
      mapCover(board, { left: 0, top: 60, right: 390, bottom: 72 }),
    ).toEqual({ top: 0, right: 0, bottom: 390, left: 0 });
  });
});

describe("pan limits under a cover", () => {
  it("lets the map up at 1x by exactly what the sheet covers", () => {
    expect(mapPanLimits(1, frame, sheet)).toEqual({
      minX: 0,
      maxX: 0,
      minY: -100,
      maxY: 0,
    });
    expect(clampMapPan({ zoom: 1, x: 40, y: -260 }, frame, sheet)).toEqual({
      zoom: 1,
      x: 0,
      y: -100,
    });
    expect(clampMapPan({ zoom: 1, x: 0, y: 30 }, frame, sheet)).toEqual(fit);
  });

  it("brings the map's bottom edge to the sheet's top, and no further", () => {
    const view = clampMapPan({ zoom: 1, x: 0, y: -999 }, frame, sheet);
    const bottomEdge = drawnAt(view, { x: 0, y: frame.height / 2 });

    expect(bottomEdge.y).toBe(frame.height / 2 - sheet.bottom);
  });

  it("adds the cover to what the zoom overflows by", () => {
    expect(mapPanLimits(2, frame, sheet)).toEqual({
      minX: -200,
      maxX: 200,
      minY: -300,
      maxY: 200,
    });
  });

  it("does not move a map that fits what can be seen", () => {
    expect(mapCanPan(1, frame)).toBe(false);
    expect(mapCanPan(1, frame, sheet)).toBe(true);
    expect(mapCanPan(1.5, frame)).toBe(true);
  });

  it("holds a pinch and a tap zoom to the same limits", () => {
    const start: MapView = { zoom: 1, x: 0, y: -100 };
    const still: [MapPoint, MapPoint] = [
      { x: -50, y: 0 },
      { x: 50, y: 0 },
    ];
    expect(pinchView(start, still, still, limits, frame, sheet)).toEqual(start);
    expect(pinchView(start, still, still, limits, frame)).toEqual(fit);

    const zoomed = zoomViewAt(fit, 2, { x: 0, y: -200 }, frame, sheet);
    expect(zoomed).toEqual({ zoom: 2, x: 0, y: 200 });
    expect(
      zoomViewAt({ zoom: 2, x: 0, y: -300 }, 1, { x: 0, y: 0 }, frame, sheet),
    ).toEqual({ zoom: 1, x: 0, y: -100 });
  });
});

describe("mapPanToShow", () => {
  const margin = 20;
  // What can be seen runs from the frame's top to 100 above its bottom:
  // -200 to 100 from the centre, 20 clear of each edge.
  const low = -200 + margin;
  const high = 100 - margin;

  it("leaves the map alone when everything is already in view", () => {
    const view = mapPanToShow(
      fit,
      [
        { x: 0, y: 0 },
        { x: 50, y: -100 },
      ],
      frame,
      sheet,
      margin,
    );

    expect(view).toEqual(fit);
  });

  it("lifts a point from under the sheet to just clear of it", () => {
    const landing = { x: 30, y: 150 };
    const view = mapPanToShow(fit, [landing], frame, sheet, margin);

    expect(view.zoom).toBe(1);
    expect(view.x).toBe(0);
    expect(drawnAt(view, landing).y).toBe(high);
  });

  it("shows both ends of a throw when both fit", () => {
    const landing = { x: 0, y: 150 };
    const stance = { x: 0, y: -100 };
    const view = mapPanToShow(fit, [landing, stance], frame, sheet, margin);

    expect(drawnAt(view, landing).y).toBeLessThanOrEqual(high);
    expect(drawnAt(view, stance).y).toBeGreaterThanOrEqual(low);
  });

  it("keeps the landing when both ends cannot fit, with the line toward the stance", () => {
    const zoomed: MapView = { zoom: 3, x: 0, y: 0 };
    const landing = { x: 0, y: 100 };
    const stance = { x: 0, y: -100 };
    const view = mapPanToShow(zoomed, [landing, stance], frame, sheet, margin);

    expect(view.zoom).toBe(3);
    // As far down as it can sit, which leaves the most of the way up to
    // where it was thrown from.
    expect(drawnAt(view, landing).y).toBe(high);
    expect(drawnAt(view, stance).y).toBeLessThan(low);
  });

  it("never moves the map past its limits to do it", () => {
    const corner = { x: 0, y: 200 };
    const view = mapPanToShow(fit, [corner], frame, sheet, margin);

    expect(view.y).toBe(-100);
  });

  it("has nowhere to show anything once too little of the frame is left", () => {
    expect(mapRoomToShow(frame, sheet, margin)).toBe(true);
    expect(
      mapRoomToShow(frame, { top: 0, right: 0, bottom: 380, left: 0 }, margin),
    ).toBe(false);
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
