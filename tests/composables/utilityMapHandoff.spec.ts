// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  drawnSquare,
  morphFromRect,
  type UtilityMapRect,
} from "~/composables/useUtilityMapHandoff";

const board: UtilityMapRect = { left: 500, top: 100, width: 800, height: 800 };

// A two-row index on desktop: the cell is taller than it is wide, the radar's
// box is capped at 90% of its width, and the square radar is drawn centred in
// it.
const tallTile: UtilityMapRect = {
  left: 100,
  top: 200,
  width: 232,
  height: 330,
};

function element(box: UtilityMapRect) {
  const animate = vi.fn();
  return {
    animate,
    getBoundingClientRect: () => box,
  } as unknown as Element & { animate: ReturnType<typeof vi.fn> };
}

// Where the element's own point (x, y) sits on screen in a keyframe.
function placed(
  frame: { transformOrigin: string; transform: string },
  box: UtilityMapRect,
) {
  const [originX, originY] = frame.transformOrigin.split(" ").map(parseFloat);
  const [, x, y, scale] = frame.transform
    .match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/)!
    .map(Number);
  return (pointX: number, pointY: number) => ({
    left: box.left + originX + x + scale * (pointX - originX),
    top: box.top + originY + y + scale * (pointY - originY),
  });
}

function expectAt(
  point: { left: number; top: number },
  expected: { left: number; top: number },
) {
  expect(point.left).toBeCloseTo(expected.left, 6);
  expect(point.top).toBeCloseTo(expected.top, 6);
}

describe("drawnSquare", () => {
  it("is the box itself when the box is square", () => {
    expect(drawnSquare(board)).toEqual(board);
  });

  it("is the square centred in a box taller than it is wide", () => {
    expect(drawnSquare(tallTile)).toEqual({
      left: 100,
      top: 249,
      width: 232,
      height: 232,
    });
  });

  it("is the square centred in a box wider than it is tall", () => {
    const wide = { left: 0, top: 0, width: 300, height: 200 };

    expect(drawnSquare(wide)).toEqual({
      left: 50,
      top: 0,
      width: 200,
      height: 200,
    });
  });
});

describe("morphFromRect", () => {
  it("starts a tile's drawn radar exactly on the board it shrinks out of", () => {
    const tile = element(tallTile);

    morphFromRect(tile, board);

    const [start, end] = tile.animate.mock.calls[0][0];
    const at = placed(start, tallTile);
    expectAt(at(0, 49), { left: board.left, top: board.top });
    expectAt(at(232, 281), {
      left: board.left + board.width,
      top: board.top + board.height,
    });
    expect(end.transform).toBe("none");
  });

  it("grows a square board out of a square tile corner to corner", () => {
    const viewport = element(board);
    const from = drawnSquare(tallTile);

    morphFromRect(viewport, from);

    const at = placed(viewport.animate.mock.calls[0][0][0], board);
    expectAt(at(0, 0), { left: from.left, top: from.top });
    expectAt(at(800, 800), {
      left: from.left + from.width,
      top: from.top + from.height,
    });
  });
});
