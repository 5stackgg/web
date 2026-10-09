// The arithmetic between the three places the map's bottom sheet rests and
// the snap points vaul is given. An offset is how far the sheet is pushed
// down from fully open, in px.

export type SheetSnap = "full" | "half" | "peek";

export type SheetDetents = Partial<Record<SheetSnap, number>> & {
  full: number;
  half: number;
};

// `peek` null is a sheet with nothing to show in a strip: it has no peek.
export function sheetDetents(
  full: number,
  half: number,
  peek: number | null,
): SheetDetents {
  const detents: SheetDetents = { full: 0, half: Math.max(0, full - half) };
  if (peek !== null && peek < half) {
    detents.peek = Math.max(0, full - peek);
  }
  return detents;
}

export function sheetSnapAt(offset: number, detents: SheetDetents): SheetSnap {
  let nearest: SheetSnap = "full";
  for (const snap of ["half", "peek"] as const) {
    const at = detents[snap];
    if (
      at !== undefined &&
      Math.abs(at - offset) < Math.abs(detents[nearest]! - offset)
    ) {
      nearest = snap;
    }
  }
  return nearest;
}

export type SheetPoint = { snap: SheetSnap; point: string };

/**
 * As vaul wants them: lowest first, each a px height measured up from the
 * bottom of the window, which it turns back into an offset. Fully open is the
 * whole window by that measure, so the sheet has nothing left to travel
 * there -- vaul only lets a list inside scroll once the sheet is at zero.
 */
export function sheetSnapPoints(
  detents: SheetDetents,
  viewport: number,
): SheetPoint[] {
  return (["peek", "half", "full"] as const)
    .filter((snap) => detents[snap] !== undefined)
    .map((snap) => ({
      snap,
      point: `${Math.round(viewport - detents[snap]!)}px`,
    }));
}

// Null for anything that is not one of ours: let go at the lowest snap with a
// flick downwards, a drawer that cannot be dismissed reports none at all.
export function sheetSnapOf(point: unknown, points: SheetPoint[]) {
  return points.find((entry) => entry.point === point)?.snap ?? null;
}

/**
 * vaul sends every upward flick to its top snap point and every hard fling
 * down to its bottom one, which from the peek skips the list. One place at a
 * time instead: further only past places the sheet was already dragged
 * beyond.
 */
export function sheetReleaseTarget(
  from: SheetSnap,
  wanted: SheetSnap,
  drawn: number | null,
  detents: SheetDetents,
): SheetSnap {
  const places = (["peek", "half", "full"] as const).filter(
    (snap) => detents[snap] !== undefined,
  );
  const start = places.indexOf(from);
  const end = places.indexOf(wanted);
  if (start < 0 || end < 0 || Math.abs(end - start) <= 1) {
    return wanted;
  }
  const step = end > start ? 1 : -1;
  const at = drawn ?? detents[from]!;
  let reached = start;
  for (let index = start + step; index !== end; index += step) {
    const place = detents[places[index]]!;
    // Upwards is towards smaller offsets.
    if (step > 0 ? at <= place : at >= place) {
      reached = index;
    }
  }
  return places[reached + step];
}

// How much of the peek's strip shows: none at half, all of it at the peek.
export function sheetPeekShare(offset: number, detents: SheetDetents) {
  if (detents.peek === undefined || detents.peek <= detents.half) {
    return 0;
  }
  const share = (offset - detents.half) / (detents.peek - detents.half);
  return Math.min(1, Math.max(0, share));
}

// A tap on the handle comes up out of the peek to half, never straight to
// full.
export function sheetTapTarget(snap: SheetSnap): SheetSnap {
  return snap === "half" ? "full" : "half";
}

/**
 * Whether a drag inside the sheet moves the sheet. Below fully open nothing
 * inside scrolls, so up or down does; fully open, the list scrolls first and
 * only a pull down from its top does.
 */
export function sheetTakesDrag(drag: {
  dx: number;
  dy: number;
  snap: SheetSnap;
  onHandle: boolean;
  refused: boolean;
  scrolledAway: boolean;
  byMouse?: boolean;
}) {
  if (Math.abs(drag.dx) > Math.abs(drag.dy)) {
    return false;
  }
  if (drag.onHandle) {
    return true;
  }
  // A mouse dragged across the card is selecting what it says.
  if (drag.refused || drag.byMouse) {
    return false;
  }
  if (drag.snap !== "full") {
    return true;
  }
  return drag.dy > 0 && !drag.scrolledAway;
}
