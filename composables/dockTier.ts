// Where a page's detail panel goes, from the room right of its capped column:
// docked wide (two columns), docked narrow (one column), or an overlay sheet.
// The table keeps its width in every tier; only the panel moves.
export type DockTier = "wide" | "docked" | "sheet";

export type DockTierOptions = {
  // The capped column and the gap before the panel.
  cap?: number;
  gap?: number;
  // The room each docked tier needs.
  wide?: number;
  narrow?: number;
};

const DEFAULTS = { cap: 1248, gap: 16, wide: 640, narrow: 400 };

export function dockTier(
  width: number,
  options: DockTierOptions = {},
): DockTier {
  const { cap, gap, wide, narrow } = { ...DEFAULTS, ...options };
  const room = width - cap - gap;
  if (room >= wide) {
    return "wide";
  }
  return room >= narrow ? "docked" : "sheet";
}

// The width the element lays its columns out in: its content box, the same
// box a ResizeObserver reports.
function contentWidth(element: HTMLElement) {
  const style = getComputedStyle(element);
  return (
    element.clientWidth -
    (parseFloat(style.paddingLeft) || 0) -
    (parseFloat(style.paddingRight) || 0)
  );
}

// Calls onTier with the element's tier now, then again whenever a resize
// moves it into another one. Returns the disconnect.
export function observeDockTier(
  element: HTMLElement,
  onTier: (tier: DockTier) => void,
  options: DockTierOptions = {},
): () => void {
  let last: DockTier | null = null;
  const read = (width: number) => {
    const tier = dockTier(width, options);
    if (tier !== last) {
      last = tier;
      onTier(tier);
    }
  };
  read(contentWidth(element));
  if (typeof ResizeObserver === "undefined") {
    return () => {};
  }
  const observer = new ResizeObserver(([entry]) =>
    read(entry.contentRect.width),
  );
  observer.observe(element);
  return () => observer.disconnect();
}
