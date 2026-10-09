import { describe, expect, it } from "vitest";
import {
  sheetDetents,
  sheetPeekShare,
  sheetReleaseTarget,
  sheetSnapAt,
  sheetSnapOf,
  sheetSnapPoints,
  sheetTakesDrag,
  sheetTapTarget,
} from "~/utilities/sheetSnap";

// 800px of window: 728 fully open, 320 at half, an 88px strip at the peek.
const VIEWPORT = 800;
const detents = sheetDetents(728, 320, 88);

describe("a sheet with three places to rest", () => {
  it("has them in order, from fully open down to the strip", () => {
    expect(detents).toEqual({ full: 0, half: 408, peek: 640 });
  });

  it("has only two when there is nothing to show in a strip", () => {
    expect(sheetDetents(728, 320, null)).toEqual({ full: 0, half: 408 });
    expect(sheetDetents(728, 320, 400).peek).toBeUndefined();
  });

  it("names the place an offset is at", () => {
    expect(sheetSnapAt(0, detents)).toBe("full");
    expect(sheetSnapAt(408, detents)).toBe("half");
    expect(sheetSnapAt(640, detents)).toBe("peek");
    expect(sheetSnapAt(700, detents)).toBe("peek");
    expect(sheetSnapAt(640, sheetDetents(728, 320, null))).toBe("half");
  });

  it("shows the strip only on the way into the peek", () => {
    expect(sheetPeekShare(0, detents)).toBe(0);
    expect(sheetPeekShare(408, detents)).toBe(0);
    expect(sheetPeekShare(524, detents)).toBeCloseTo(0.5);
    expect(sheetPeekShare(640, detents)).toBe(1);
    expect(sheetPeekShare(700, detents)).toBe(1);
    expect(sheetPeekShare(640, sheetDetents(728, 320, null))).toBe(0);
  });

  it("comes up out of the peek to the list on a tap, never straight to full", () => {
    expect(sheetTapTarget("peek")).toBe("half");
    expect(sheetTapTarget("half")).toBe("full");
    expect(sheetTapTarget("full")).toBe("half");
  });
});

describe("the snap points the drawer is given", () => {
  const points = sheetSnapPoints(detents, VIEWPORT);

  it("are the three places, lowest first", () => {
    expect(points.map((entry) => entry.snap)).toEqual([
      "peek",
      "half",
      "full",
    ]);
  });

  it("put each place at its offset, by the drawer's own arithmetic", () => {
    // vaul: offset = window height - snap point.
    const offsets = points.map(
      (entry) => VIEWPORT - Number.parseInt(entry.point, 10),
    );
    expect(offsets).toEqual([640, 408, 0]);
  });

  it("leave fully open with nothing left to travel", () => {
    expect(points[2]).toEqual({ snap: "full", point: "800px" });
  });

  it("are two when there is no strip", () => {
    const two = sheetSnapPoints(sheetDetents(728, 320, null), VIEWPORT);
    expect(two.map((entry) => entry.snap)).toEqual(["half", "full"]);
  });

  it("map back to the page's names, and to nothing for a point not ours", () => {
    expect(sheetSnapOf("160px", points)).toBe("peek");
    expect(sheetSnapOf("392px", points)).toBe("half");
    expect(sheetSnapOf("800px", points)).toBe("full");
    expect(sheetSnapOf(null, points)).toBeNull();
    expect(sheetSnapOf(undefined, points)).toBeNull();
    expect(sheetSnapOf("1px", points)).toBeNull();
  });
});

describe("whose a drag inside the sheet is", () => {
  const drag = {
    dx: 0,
    dy: 20,
    snap: "full" as const,
    onHandle: false,
    refused: false,
    scrolledAway: false,
  };

  it("is the sheet's from the handle, whichever way and wherever it rests", () => {
    expect(sheetTakesDrag({ ...drag, onHandle: true, dy: -20 })).toBe(true);
    expect(
      sheetTakesDrag({ ...drag, onHandle: true, scrolledAway: true }),
    ).toBe(true);
  });

  it("is the sheet's anywhere on it below fully open", () => {
    expect(sheetTakesDrag({ ...drag, snap: "half", dy: -20 })).toBe(true);
    expect(sheetTakesDrag({ ...drag, snap: "peek", dy: 20 })).toBe(true);
    expect(
      sheetTakesDrag({ ...drag, snap: "half", scrolledAway: true }),
    ).toBe(true);
  });

  it("is the list's when fully open, until the list is at its top", () => {
    expect(sheetTakesDrag({ ...drag, dy: -20 })).toBe(false);
    expect(sheetTakesDrag({ ...drag, scrolledAway: true })).toBe(false);
    expect(sheetTakesDrag(drag)).toBe(true);
  });

  it("is never the sheet's sideways, or over something dragged for itself", () => {
    expect(sheetTakesDrag({ ...drag, dx: 30, dy: 10, snap: "half" })).toBe(
      false,
    );
    expect(sheetTakesDrag({ ...drag, snap: "half", refused: true })).toBe(
      false,
    );
  });
});

describe("where a release goes", () => {
  it("is where the drawer says, for the next place along or the same one", () => {
    expect(sheetReleaseTarget("half", "full", 380, detents)).toBe("full");
    expect(sheetReleaseTarget("half", "peek", 430, detents)).toBe("peek");
    expect(sheetReleaseTarget("half", "half", 400, detents)).toBe("half");
  });

  it("stops at the list on a flick up from the peek", () => {
    // The drawer sends every upward flick to its top snap point.
    expect(sheetReleaseTarget("peek", "full", 600, detents)).toBe("half");
  });

  it("stops at the list on a fling down from fully open", () => {
    expect(sheetReleaseTarget("full", "peek", 40, detents)).toBe("half");
  });

  it("goes on past a place the sheet had already been dragged beyond", () => {
    expect(sheetReleaseTarget("peek", "full", 300, detents)).toBe("full");
    expect(sheetReleaseTarget("full", "peek", 500, detents)).toBe("peek");
  });

  it("goes by the place it started at when nothing was drawn", () => {
    expect(sheetReleaseTarget("peek", "full", null, detents)).toBe("half");
  });

  it("has nothing to skip with two places", () => {
    const two = sheetDetents(728, 320, null);
    expect(sheetReleaseTarget("half", "full", 380, two)).toBe("full");
  });
});
