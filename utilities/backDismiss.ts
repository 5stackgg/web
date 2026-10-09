// What the Back button undoes on a page with things open over it. Everything
// here is decided from one number: the router's position counter for a
// history entry, which goes up by one on a push and back down on Back.
//
// A layer (the raised sheet, a view over the card, a menu) that opens pushes
// an entry of its own and remembers that entry's position. Back then lands
// below it, which is the signal to close; closing it by hand takes the entry
// back out, so entries never pile up behind a layer that is already gone.
//
// What is open because the address says so (a lineup, a meta spot, a
// collection, an execute) is the other kind: the push that opened it already
// is its entry, so it takes no second one and only notes where that entry is.

export type LayerEntry = number | null;

/**
 * Something opened. One that was already open when the page arrived -- a deep
 * link -- never gets here, so it never puts an entry between the visitor and
 * wherever they came from. `onSpare` is standing on a layer's entry that no
 * open layer is using (one a tap elsewhere left behind, or that Forward
 * returned to): that one is taken instead of making another.
 */
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

/**
 * Something was closed from inside the page. Its entry comes out with a step
 * back only while it is the entry on top; under another one it is left where
 * it is, because stepping back would close the wrong thing.
 */
export function layerClosed(entry: LayerEntry, position: number) {
  return entry !== null && position === entry
    ? ("back" as const)
    : ("none" as const);
}

/**
 * The history moved. Below the layer's entry means Back passed it, so it
 * closes; at or above it (something was opened over it, or Back returned to
 * it from there) it stays.
 */
export function layerNavigated(entry: LayerEntry, position: number) {
  return entry !== null && position < entry
    ? ("dismiss" as const)
    : ("keep" as const);
}

/**
 * Whether a step down the history takes the address with it. A layer's entry
 * starts at the address of the one under it, but the page goes on rewriting
 * the address while the layer is open -- a filter, a tab, the next lineup --
 * and only the entry on top hears of it. One step down off a layer's entry,
 * by Back or because the layer was closed, would put the old address back
 * and undo all of that; so the address goes down with it. Any other step is
 * Back doing what Back does.
 */
export function carriesAddress(
  from: { position: number; layer: boolean },
  toPosition: number,
  samePage: boolean,
  sameAddress: boolean,
) {
  return (
    from.layer &&
    toPosition === from.position - 1 &&
    samePage &&
    !sameAddress
  );
}

// Opening something that lives in the address is a step Back can undo;
// swapping it for another of its kind is not a second step, or ten lineups
// would be ten Backs.
export function addressOpenMode(alreadyOpen: boolean) {
  return alreadyOpen ? ("replace" as const) : ("push" as const);
}

/**
 * The page's own Back on something that lives in the address. `openedAt` is
 * the position of the entry that opened it, noted in the history state of
 * that entry and of any layer's entry over it -- so the answer is how many
 * steps back lands just before it, which is more than one when a layer sits
 * on top. Arrived at by link there is no such entry (null): stepping back
 * would leave the site, so it is taken out of the address instead.
 */
export function addressCloseDelta(openedAt: number | null, position: number) {
  if (openedAt === null || !Number.isFinite(openedAt) || openedAt > position) {
    return null;
  }
  return openedAt - 1 - position;
}
