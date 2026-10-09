// Where the map's bottom sheet rests. The sheet itself is the shared Drawer
// (vaul): it follows the finger, decides which resting place a release goes
// to, and animates there. What is here is the arithmetic between the page's
// three named places and the snap points vaul is given.
//
// An offset is how far the sheet is pushed down from fully open, in px.

// Open over the map, sharing the screen with it, or down to a strip along
// the bottom edge that leaves the map the rest.
export type SheetSnap = "full" | "half" | "peek";

export type SheetDetents = Partial<Record<SheetSnap, number>> & {
  full: number;
  half: number;
};

/**
 * Each resting place as an offset, from how tall the sheet is at it. A sheet
 * with nothing to show in a strip (`peek` null) has no peek to rest at.
 */
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

/** Which resting place an offset is, or is nearest to. */
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
 * The resting places as vaul wants them: lowest first, each a px height
 * measured up from the bottom of the window, which it turns back into an
 * offset by taking it from the window's height. Fully open is the whole
 * window by that measure, so the sheet has nothing left to travel there --
 * vaul only lets a list inside scroll once the sheet is at zero.
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

/**
 * The page's name for a snap point vaul reports. Null for anything that is
 * not one of ours: let go at the lowest one with a flick downwards, a sheet
 * that cannot be dismissed reports no snap point at all.
 */
export function sheetSnapOf(point: unknown, points: SheetPoint[]) {
  return points.find((entry) => entry.point === point)?.snap ?? null;
}

/**
 * Where a release ends up, given where the drawer wants to send it. One
 * place at a time: a flick goes to the next place the way it was thrown, and
 * further only past places the sheet had already been dragged beyond. The
 * drawer sends every upward flick to its top snap point and every hard fling
 * down to its bottom one, which from the peek skips the list.
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

/**
 * How much of the strip shows: none at half and above, all of it at the
 * peek, and in step with the sheet in between so one fades into the other
 * under the finger.
 */
export function sheetPeekShare(offset: number, detents: SheetDetents) {
  if (detents.peek === undefined || detents.peek <= detents.half) {
    return 0;
  }
  const share = (offset - detents.half) / (detents.peek - detents.half);
  return Math.min(1, Math.max(0, share));
}

/**
 * Where a tap on the handle sends the sheet: up out of the peek to where the
 * list is, and otherwise between that and fully open.
 */
export function sheetTapTarget(snap: SheetSnap): SheetSnap {
  return snap === "half" ? "full" : "half";
}

/**
 * Whose a drag inside the sheet is, once it has moved far enough to tell.
 * Sideways it is whatever was under the finger. Below fully open nothing
 * inside scrolls, so up or down moves the sheet; fully open, the list scrolls
 * first and only a pull down from its top moves the sheet.
 */
export function sheetTakesDrag(drag: {
  dx: number;
  dy: number;
  snap: SheetSnap;
  onHandle: boolean;
  refused: boolean;
  scrolledAway: boolean;
}) {
  if (Math.abs(drag.dx) > Math.abs(drag.dy)) {
    return false;
  }
  if (drag.onHandle) {
    return true;
  }
  if (drag.refused) {
    return false;
  }
  if (drag.snap !== "full") {
    return true;
  }
  return drag.dy > 0 && !drag.scrolledAway;
}
