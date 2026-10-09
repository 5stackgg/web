import { describe, expect, it } from "vitest";
import {
  utilityPeekPlacement,
  type PeekBox,
  type PeekPlacement,
} from "~/utilities/utilityPeekPlacement";

const viewport = { width: 1600, height: 1000 };
const board: PeekBox = { left: 280, top: 120, width: 820, height: 820 };
const panel: PeekBox = { left: 1124, top: 120, width: 400, height: 820 };
const peek = { width: 386, height: 420 };
const pad = 16;

function box(at: PeekPlacement): PeekBox {
  return {
    left: at.left,
    top: at.top,
    width: peek.width * at.scale,
    height: peek.height * at.scale,
  };
}

function area(a: PeekBox, b: PeekBox) {
  const width =
    Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const height =
    Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

function padded(line: PeekBox): PeekBox {
  return {
    left: line.left - pad,
    top: line.top - pad,
    width: line.width + pad * 2,
    height: line.height + pad * 2,
  };
}

function inside(outer: PeekBox, inner: PeekBox) {
  return (
    inner.left >= outer.left &&
    inner.top >= outer.top &&
    inner.left + inner.width <= outer.left + outer.width &&
    inner.top + inner.height <= outer.top + outer.height
  );
}

const point = (left: number, top: number): PeekBox => ({
  left,
  top,
  width: 0,
  height: 0,
});

describe("utilityPeekPlacement on the radar", () => {
  it("keeps the peek on the board and off the throw", () => {
    const line = { left: 330, top: 600, width: 220, height: 260 };
    const at = utilityPeekPlacement({
      anchor: point(400, 700),
      peek,
      viewport,
      board,
      line,
    });

    expect(at.scale).toBe(1);
    expect(area(box(at), padded(line))).toBe(0);
    expect(inside(board, box(at))).toBe(true);
  });

  it("never covers the throw and never leaves the board, wherever it is drawn", () => {
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        const line = {
          left: board.left + 40 + x * 180,
          top: board.top + 40 + y * 180,
          width: 140,
          height: 200,
        };
        const at = utilityPeekPlacement({
          anchor: point(line.left + 10, line.top + 10),
          peek,
          viewport,
          board,
          line,
        });
        expect(area(box(at), padded(line))).toBe(0);
        expect(inside(board, box(at))).toBe(true);
        expect(area(box(at), panel)).toBe(0);
      }
    }
  });

  it("keeps a taller peek on the board and off the throw too", () => {
    const tall = { width: 386, height: 560 };
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        const line = {
          left: board.left + 40 + x * 180,
          top: board.top + 40 + y * 180,
          width: 140,
          height: 200,
        };
        const at = utilityPeekPlacement({
          anchor: point(line.left + 10, line.top + 10),
          peek: tall,
          viewport,
          board,
          line,
        });
        const placed = {
          left: at.left,
          top: at.top,
          width: tall.width * at.scale,
          height: tall.height * at.scale,
        };
        expect(area(placed, padded(line))).toBe(0);
        expect(inside(board, placed)).toBe(true);
      }
    }
  });

  it("flips or clamps when the peek is wider than the room right of the pointer", () => {
    const line = { left: 1040, top: 500, width: 30, height: 40 };
    const at = utilityPeekPlacement({
      anchor: point(1060, 520),
      peek,
      viewport,
      board,
      line,
    });

    expect(at.scale).toBe(1);
    expect(at.left + peek.width).toBeLessThanOrEqual(
      board.left + board.width - 12,
    );
    expect(area(box(at), padded(line))).toBe(0);
    expect(inside(board, box(at))).toBe(true);
  });

  it("shrinks rather than covering the throw when full size has no clear spot", () => {
    const line = { left: 560, top: 400, width: 260, height: 260 };
    const at = utilityPeekPlacement({
      anchor: point(690, 530),
      peek,
      viewport,
      board,
      line,
    });

    expect(at.scale).toBeLessThan(1);
    expect(area(box(at), padded(line))).toBe(0);
    expect(inside(board, box(at))).toBe(true);
  });

  it("stays on the board over the least of a throw that spans it", () => {
    const line = { left: 330, top: 170, width: 720, height: 720 };
    const at = utilityPeekPlacement({
      anchor: point(700, 500),
      peek,
      viewport,
      board,
      line,
    });
    const fullSizeInCorner = area(
      { left: board.left + 12, top: board.top + 12, ...peek },
      padded(line),
    );

    expect(at.scale).toBe(0.6);
    expect(inside(board, box(at))).toBe(true);
    expect(area(box(at), panel)).toBe(0);
    expect(area(box(at), padded(line))).toBeLessThan(fullSizeInCorner);
  });
});

describe("utilityPeekPlacement from a list row", () => {
  const row: PeekBox = { left: 1140, top: 300, width: 360, height: 56 };

  it("opens on the board nearest the row, never over the side panel", () => {
    const at = utilityPeekPlacement({
      anchor: row,
      peek,
      viewport,
      board,
      line: { left: 320, top: 700, width: 120, height: 120 },
      beside: true,
    });

    expect(inside(board, box(at))).toBe(true);
    expect(area(box(at), panel)).toBe(0);
    expect(at.left + peek.width).toBe(board.left + board.width - 12);
  });

  it("moves off the row's throw when the spot nearest the row would cover it", () => {
    const line = { left: 820, top: 160, width: 260, height: 300 };
    const at = utilityPeekPlacement({
      anchor: row,
      peek,
      viewport,
      board,
      line,
      beside: true,
    });

    expect(area(box(at), padded(line))).toBe(0);
    expect(inside(board, box(at))).toBe(true);
  });

  it("opens beside the row when there is no radar on the page", () => {
    const at = utilityPeekPlacement({
      anchor: row,
      peek,
      viewport,
      beside: true,
    });

    expect(at).toEqual({
      left: row.left - 12 - peek.width,
      top: row.top,
      scale: 1,
    });
  });
});
