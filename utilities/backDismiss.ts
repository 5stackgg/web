// What the Back button undoes on a page with things open over it, decided
// from the router's position counter for a history entry.
//
// A layer (the raised sheet, a view over the card, a menu) pushes an entry of
// its own and remembers its position: Back landing below it is the signal to
// close, and closing it by hand takes the entry back out.
//
// What is open because the address says so (a lineup, a meta spot, a
// collection, an execute) already has the entry that opened it; it takes no
// second one and only notes where that entry is.

export type LayerEntry = number | null;

// `onSpare` is standing on a layer's entry that no open layer is using: that
// one is taken instead of making another.
export function layerOpened(
  entry: LayerEntry,
  enabled: boolean,
  onSpare = false,
) {
  if (!enabled || entry !== null) {
    return "none" as const;
  }
  return onSpare ? ("take" as const) : ("push" as const);
}

// Closed by hand, its entry comes out with a step back only while it is the
// entry on top: under another one, stepping back would close the wrong thing.
export function layerClosed(entry: LayerEntry, position: number) {
  return entry !== null && position === entry
    ? ("back" as const)
    : ("none" as const);
}

export function layerNavigated(entry: LayerEntry, position: number) {
  return entry !== null && position < entry
    ? ("dismiss" as const)
    : ("keep" as const);
}

// `opened`: what was opened by address at or under this entry, and where.
export type RestedEntry = {
  position: number;
  layer: boolean;
  opened: Record<string, number>;
};

/**
 * What a step down the history closes, when the address is to go down with
 * it; null when the step is just Back.
 *
 * The page goes on rewriting the address on the entry on top -- a filter, a
 * tab, the next lineup -- and only that entry hears of it. Stepping down off
 * a layer's entry, or to just under the entry that opened a lineup, would
 * put the old address back and undo all of that. So the address goes down
 * with the step, less what the step closes.
 */
export function addressCarried(
  from: RestedEntry,
  toPosition: number,
  samePage: boolean,
): string[] | null {
  if (!samePage || toPosition >= from.position) {
    return null;
  }
  const closed = Object.keys(from.opened).filter(
    (name) =>
      from.opened[name] > toPosition && from.opened[name] <= from.position,
  );
  if (closed.length === 0) {
    return from.layer && toPosition === from.position - 1 ? [] : null;
  }
  const lowest = Math.min(...closed.map((name) => from.opened[name]));
  return toPosition === lowest - 1 ? closed : null;
}

/**
 * The same going up: Forward by one onto a layer's entry, or onto the entry
 * that opened something, whose own address is older than anything written
 * under it since. Returns the names to take from that entry itself; null
 * when the step is just Forward.
 */
export function addressRaised(
  from: RestedEntry,
  to: RestedEntry,
  samePage: boolean,
): string[] | null {
  if (!samePage || to.position !== from.position + 1) {
    return null;
  }
  const opens = Object.keys(to.opened).filter(
    (name) => to.opened[name] === to.position,
  );
  if (opens.length === 0) {
    return to.layer ? [] : null;
  }
  return opens;
}

export type AddressQuery = Record<string, unknown>;

/**
 * Opening something by address is a push, and the page's Back steps out of
 * that push -- so anything else written with it (the tab a saved lineup is
 * filed under, say) goes onto the entry underneath first, as a replace.
 */
export function addressWrites(
  current: AddressQuery,
  patch: Record<string, string | null>,
  mode: "push" | "replace",
  openedByAddress: string[],
) {
  const apply = (query: AddressQuery, keys: string[]) => {
    const next = { ...query };
    for (const key of keys) {
      if (patch[key]) {
        next[key] = patch[key];
      } else {
        delete next[key];
      }
    }
    return next;
  };
  const differs = (a: AddressQuery, b: AddressQuery) =>
    Object.keys({ ...a, ...b }).some(
      (key) => String(a[key] ?? "") !== String(b[key] ?? ""),
    );

  const opening =
    mode === "push"
      ? openedByAddress.filter((key) => patch[key] && !current[key])
      : [];
  const rest = Object.keys(patch).filter((key) => !opening.includes(key));
  const base = apply(current, rest);
  const opened = apply(base, opening);
  const removed = openedByAddress.filter((key) => patch[key] === null);

  if (opening.length > 0) {
    return {
      replace: differs(current, base) ? base : null,
      push: opened,
      opening,
      removed,
    };
  }
  if (!differs(current, base)) {
    return { replace: null, push: null, opening, removed };
  }
  return mode === "push"
    ? { replace: null, push: base, opening, removed }
    : { replace: base, push: null, opening, removed };
}

// Swapping one open lineup for another is not a second step, or ten lineups
// would be ten Backs.
export function addressOpenMode(alreadyOpen: boolean) {
  return alreadyOpen ? ("replace" as const) : ("push" as const);
}

/**
 * How many steps back land just before the entry that opened something,
 * which is more than one when a layer sits on top. Null when it was arrived
 * at by link: stepping back would leave the site.
 */
export function addressCloseDelta(openedAt: number | null, position: number) {
  if (openedAt === null || !Number.isFinite(openedAt) || openedAt > position) {
    return null;
  }
  return openedAt - 1 - position;
}
