export type PeekBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PeekPlacementInput = {
  // The row, or the point the pointer came to rest on (a zero-size box).
  anchor: PeekBox;
  peek: { width: number; height: number };
  viewport: { width: number; height: number };
  // The radar on screen, and the hovered lineup's throw on it.
  board?: PeekBox | null;
  line?: PeekBox | null;
  // A row: with no radar on the page, the peek opens beside it.
  beside?: boolean;
  gap?: number;
  margin?: number;
  pad?: number;
  minScale?: number;
};

export type PeekPlacement = { left: number; top: number; scale: number };

function overlap(a: PeekBox, b: PeekBox) {
  const width =
    Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const height =
    Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

function intersection(a: PeekBox, b: PeekBox): PeekBox | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  return right > left && bottom > top
    ? { left, top, width: right - left, height: bottom - top }
    : null;
}

function grow(box: PeekBox, by: number): PeekBox {
  return {
    left: box.left - by,
    top: box.top - by,
    width: box.width + by * 2,
    height: box.height + by * 2,
  };
}

function clamp(value: number, min: number, max: number) {
  return max < min ? min : Math.min(Math.max(value, min), max);
}

/**
 * Where the peek goes. With a radar on the page it never leaves the radar --
 * beside it are the list and the lineup panel, which it must not cover -- and
 * never covers the hovered throw: it takes the clear spot nearest what is
 * hovered, shrinks when no spot is clear at full size, and only as a last
 * resort sits over the least of the throw.
 */
export function utilityPeekPlacement(input: PeekPlacementInput): PeekPlacement {
  const { anchor, peek, viewport } = input;
  const gap = input.gap ?? 12;
  const margin = input.margin ?? 12;
  const pad = input.pad ?? 16;
  const minScale = input.minScale ?? 0.6;
  const centreX = anchor.left + anchor.width / 2;
  const centreY = anchor.top + anchor.height / 2;
  const board = input.board ?? null;

  if (!board) {
    const left = input.beside
      ? anchor.left - gap - peek.width >= margin
        ? anchor.left - gap - peek.width
        : anchor.left + anchor.width + gap
      : anchor.left + anchor.width + gap;
    return {
      left: clamp(left, margin, viewport.width - margin - peek.width),
      top: clamp(
        input.beside ? anchor.top : centreY - peek.height / 2,
        margin,
        viewport.height - margin - peek.height,
      ),
      scale: 1,
    };
  }

  const area = {
    left: board.left + margin,
    top: board.top + margin,
    width: Math.max(0, board.width - margin * 2),
    height: Math.max(0, board.height - margin * 2),
  };
  const shown = input.line ? intersection(input.line, board) : null;
  const pointInBoard =
    anchor.width === 0 &&
    anchor.height === 0 &&
    centreX >= board.left &&
    centreX <= board.left + board.width &&
    centreY >= board.top &&
    centreY <= board.top + board.height;
  const avoid = shown
    ? grow(shown, pad)
    : pointInBoard
      ? grow(anchor, pad)
      : null;

  const fit = Math.min(1, area.width / peek.width, area.height / peek.height);
  const scales = [1, 0.85, 0.7, minScale]
    .map((scale) => Math.min(scale, fit))
    .filter((scale, at, all) => scale > 0 && all.indexOf(scale) === at);

  function spots(scale: number): PeekBox[] {
    const width = peek.width * scale;
    const height = peek.height * scale;
    const place = (left: number, top: number): PeekBox => ({
      left: clamp(left, area.left, area.left + area.width - width),
      top: clamp(top, area.top, area.top + area.height - height),
      width,
      height,
    });
    const out = [
      place(area.left, area.top),
      place(area.left + area.width - width, area.top),
      place(area.left, area.top + area.height - height),
      place(area.left + area.width - width, area.top + area.height - height),
    ];
    if (avoid) {
      out.push(
        place(avoid.left + avoid.width + gap, centreY - height / 2),
        place(avoid.left - gap - width, centreY - height / 2),
        place(centreX - width / 2, avoid.top + avoid.height + gap),
        place(centreX - width / 2, avoid.top - gap - height),
      );
    }
    const distance = (box: PeekBox) =>
      Math.hypot(
        box.left + box.width / 2 - centreX,
        box.top + box.height / 2 - centreY,
      );
    return out.sort((a, b) => distance(a) - distance(b));
  }

  for (const scale of scales) {
    const clear = spots(scale).find(
      (box) => !avoid || overlap(box, avoid) === 0,
    );
    if (clear) {
      return { left: clear.left, top: clear.top, scale };
    }
  }

  const smallest = scales[scales.length - 1] ?? minScale;
  const least = spots(smallest).reduce((best, box) =>
    avoid && overlap(box, avoid) < overlap(best, avoid) ? box : best,
  );
  return { left: least.left, top: least.top, scale: smallest };
}
