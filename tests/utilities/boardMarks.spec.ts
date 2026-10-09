import { describe, expect, it } from "vitest";
import {
  MARK_MIN_SCALE,
  MARK_TOUCH_SCALE,
  POINTER_TARGET_PX,
  TOUCH_TARGET_PX,
  hitRadius,
  markInk,
  markScale,
  maxZoomFor,
  tapTarget,
  unitsPerPx,
} from "~/utilities/boardMarks";

const CANVAS = 1024;
const PHONE = 390;
const DESKTOP = 888;
const ZOOMS = [0.85, 1, 1.5, 2, 3, 4.5, 6];

// What a mark written `size` units big measures on the glass, in CSS px.
function onScreen(size: number, zoom: number, frame: number, coarse = false) {
  const units = size * markInk(zoom, frame, CANVAS, coarse);
  return units / unitsPerPx(zoom, frame, CANVAS);
}

describe("marks on the map", () => {
  it("never shrink as the map zooms in", () => {
    for (const frame of [PHONE, DESKTOP]) {
      const sizes = ZOOMS.map((zoom) => onScreen(17, zoom, frame));
      sizes.slice(1).forEach((size, index) => {
        expect(size).toBeGreaterThanOrEqual(sizes[index] - 1e-9);
      });
    }
  });

  it("hold their size on screen from 1x to all the way in, give or take a third", () => {
    for (const frame of [PHONE, DESKTOP]) {
      const atRest = onScreen(17, 1, frame);
      const allIn = onScreen(17, 6, frame);
      expect(allIn / atRest).toBeGreaterThanOrEqual(1);
      expect(allIn / atRest).toBeLessThan(1.35);
    }
  });

  it("are not drawn to the scale of a phone-sized board", () => {
    // Stretched with the board, a 17 unit ring is 6.5px across on a phone.
    expect(onScreen(17, 1, PHONE)).toBeCloseTo(17 * MARK_MIN_SCALE);
    expect(onScreen(17, 6, PHONE)).toBeGreaterThan(15);
  });

  it("are drawn larger where they are touched, at every zoom", () => {
    // A landing ring is written 17 units across, casing included.
    expect(onScreen(17, 1, PHONE, true)).toBeCloseTo(17 * MARK_TOUCH_SCALE);
    expect(onScreen(17, 1, PHONE, true)).toBeGreaterThan(22);
    expect(onScreen(17, 6, PHONE, true)).toBeGreaterThan(28);
    for (const zoom of ZOOMS) {
      expect(onScreen(17, zoom, PHONE, true)).toBeGreaterThan(
        onScreen(17, zoom, PHONE) * 1.5,
      );
    }
    const sizes = ZOOMS.map((zoom) => onScreen(17, zoom, PHONE, true));
    sizes.slice(1).forEach((size, index) => {
      expect(size).toBeGreaterThanOrEqual(sizes[index] - 1e-9);
    });
  });

  it("are that size on a tablet too, where the board is wide", () => {
    expect(onScreen(17, 1, 800, true)).toBeCloseTo(17 * MARK_TOUCH_SCALE);
  });

  it("are left as they were on a board wide enough for them", () => {
    expect(markInk(1, DESKTOP, CANVAS)).toBeCloseTo(1);
    expect(markScale(1, DESKTOP, CANVAS)).toBeCloseTo(DESKTOP / CANVAS);
  });

  it("fall back to the canvas's own scale before the board is measured", () => {
    expect(markInk(1, 0, CANVAS)).toBe(1);
    expect(markInk(4, 0, CANVAS)).toBeCloseTo(4 ** 0.15 / 4);
  });
});

describe("what a finger can hit", () => {
  it("is 44px across on screen at every zoom and on every board", () => {
    for (const frame of [PHONE, DESKTOP]) {
      for (const zoom of ZOOMS) {
        const px =
          (2 * hitRadius(zoom, frame, CANVAS, true)) /
          unitsPerPx(zoom, frame, CANVAS);
        expect(px).toBeCloseTo(TOUCH_TARGET_PX);
      }
    }
  });

  it("is never under 24px for a mouse either", () => {
    for (const frame of [PHONE, DESKTOP]) {
      for (const zoom of ZOOMS) {
        const px =
          (2 * hitRadius(zoom, frame, CANVAS, false)) /
          unitsPerPx(zoom, frame, CANVAS);
        expect(px).toBeCloseTo(POINTER_TARGET_PX);
      }
    }
  });

  const mark = (key: string, x: number) => ({
    key,
    x,
    y: 100,
    within: 58,
    drawn: 24,
  });

  it("goes to the thing nearest the tap, not the one drawn last", () => {
    const marks = [mark("near", 100), mark("last", 130)];
    expect(tapTarget(marks, { x: 108, y: 100 })?.key).toBe("near");
    expect(tapTarget(marks, { x: 124, y: 100 })?.key).toBe("last");
  });

  it("gives each thing its own reach", () => {
    const ring = { key: "ring", x: 100, y: 100, within: 120, drawn: 24 };
    const marks = [ring, mark("mark", 260)];
    // Out of the mark's reach, inside the ring's own.
    expect(tapTarget(marks, { x: 190, y: 100 })?.key).toBe("ring");
    expect(tapTarget(marks, { x: 230, y: 100 })?.key).toBe("mark");
  });

  it("knows a tap on the thing itself from one in the room round it", () => {
    const marks = [mark("a", 100)];
    expect(tapTarget(marks, { x: 110, y: 100 })).toEqual({
      key: "a",
      direct: true,
    });
    expect(tapTarget(marks, { x: 140, y: 100 })).toEqual({
      key: "a",
      direct: false,
    });
  });

  it("is nothing at all when the tap is out of reach of everything", () => {
    expect(tapTarget([mark("a", 0)], { x: 80, y: 100 })).toBeNull();
    expect(tapTarget([], { x: 0, y: 0 })).toBeNull();
  });
});

describe("how far in the map goes", () => {
  it("is all the way for a full-size radar on a phone or a laptop", () => {
    expect(maxZoomFor(2048, PHONE, 6)).toBe(6);
    expect(maxZoomFor(2048, DESKTOP, 6)).toBe(6);
  });

  it("stops where the radar runs out of pixels", () => {
    expect(maxZoomFor(1024, DESKTOP, 6)).toBeCloseTo((1024 * 3) / DESKTOP);
    expect(maxZoomFor(2048, 1968, 6)).toBeCloseTo((2048 * 3) / 1968);
  });

  it("is never locked by a small stand-in picture, or one not measured yet", () => {
    expect(maxZoomFor(256, DESKTOP, 6)).toBe(3);
    expect(maxZoomFor(0, DESKTOP, 6)).toBe(6);
    expect(maxZoomFor(2048, 0, 6)).toBe(6);
  });
});
