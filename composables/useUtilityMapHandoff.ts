/**
 * The maps index and a map are two pages inside one shell, and the thing you
 * pick on one is the thing you look at on the other: a map's tile is a small
 * copy of its board. So the page you leave says where that radar was drawn,
 * and the page you arrive on grows -- or shrinks -- its own copy out of that
 * spot, instead of both pages being swapped behind a slide.
 */
export type UtilityMapRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Handoff = {
  from: "index" | "map";
  map: string;
  // Where the radar was on screen. Null when it was not: the pages still
  // change places without the slide, there is just nothing to grow from.
  rect: UtilityMapRect | null;
  // The image the tile was showing, which the board can open with.
  src: string | null;
  at: number;
};

// Long enough for a page to mount, short enough that a handoff nobody picked
// up is not played on some later visit.
const FRESH_MS = 1500;

let pending: Handoff | null = null;

// On a phone the pages scroll and the scroll is reset on the way across, so a
// place on screen means nothing by the time the next page measures itself.
function canMorph() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1024px)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function leaveUtilityPage(
  from: Handoff["from"],
  map: string,
  rect: UtilityMapRect | null,
  src: string | null = null,
) {
  pending = {
    from,
    map,
    rect: rect && rect.width > 0 && canMorph() ? rect : null,
    src,
    at: performance.now(),
  };
}

export function arriveUtilityPage(from: Handoff["from"], map?: string) {
  const handoff = pending;
  pending = null;
  if (
    !handoff ||
    handoff.from !== from ||
    (map !== undefined && handoff.map !== map) ||
    performance.now() - handoff.at > FRESH_MS
  ) {
    return null;
  }
  return handoff;
}

/**
 * Where an element rests. Asked mid-flight, its box is wherever the morph has
 * it at that instant, so a morph still playing is ended first.
 */
export function restingRect(element: Element | null | undefined) {
  if (!element) {
    return null;
  }
  for (const animation of element.getAnimations()) {
    animation.finish();
  }
  return element.getBoundingClientRect();
}

/**
 * Plays an element from where its twin was to where it is. Both are the same
 * square radar, so it is one uniform scale about the element's own corner.
 */
export function morphFromRect(
  element: Element | null | undefined,
  from: UtilityMapRect,
) {
  const to = element?.getBoundingClientRect();
  if (!element || !to || !to.width) {
    return null;
  }
  const scale = from.width / to.width;
  return element.animate(
    [
      {
        transformOrigin: "0 0",
        transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`,
      },
      { transformOrigin: "0 0", transform: "none" },
    ],
    { duration: 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  );
}
