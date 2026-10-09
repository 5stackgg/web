import { describe, expect, it } from "vitest";
import {
  addressCloseDelta,
  addressOpenMode,
  carriesAddress,
  layerClosed,
  layerNavigated,
  layerOpened,
  type LayerEntry,
} from "~/utilities/backDismiss";

// A small history to walk the rules through: `position` is where the router
// is, `entry` is the layer's own entry.
function history(start = 4) {
  return { position: start };
}

describe("what is open because the address says so", () => {
  it("is one step Back can undo, however many are flipped through", () => {
    expect(addressOpenMode(false)).toBe("push");
    expect(addressOpenMode(true)).toBe("replace");
  });

  it("closes with one step back when it was opened here", () => {
    const at = history();
    at.position += 1;

    expect(addressCloseDelta(at.position, at.position)).toBe(-1);
  });

  it("steps back past whatever was opened over it", () => {
    const at = history();
    at.position += 1;
    const openedAt = at.position;
    at.position += 1;

    expect(addressCloseDelta(openedAt, at.position)).toBe(-2);
  });

  it("is taken out of the address when it was arrived at by link", () => {
    expect(addressCloseDelta(null, 3)).toBeNull();
    expect(addressCloseDelta(Number.NaN, 3)).toBeNull();
  });

  it("does not trust a marker from an entry that is ahead of this one", () => {
    expect(addressCloseDelta(6, 4)).toBeNull();
  });
});

describe("a layer over the page", () => {
  it("pushes an entry when it opens, once", () => {
    expect(layerOpened(null, true)).toBe("push");
    expect(layerOpened(5, true)).toBe("none");
  });

  it("pushes nothing where Back is not wired", () => {
    expect(layerOpened(null, false)).toBe("none");
  });

  it("closes when Back passes its entry", () => {
    const at = history();
    let entry: LayerEntry = null;

    expect(layerOpened(entry, true)).toBe("push");
    at.position += 1;
    entry = at.position;

    at.position -= 1;
    expect(layerNavigated(entry, at.position)).toBe("dismiss");
  });

  it("takes its entry back out when it is closed by hand", () => {
    const at = history();
    at.position += 1;
    const entry: LayerEntry = at.position;

    expect(layerClosed(entry, at.position)).toBe("back");
  });

  it("stays open under something opened over it, and when Back returns to it", () => {
    const at = history();
    at.position += 1;
    const sheet: LayerEntry = at.position;

    at.position += 1;
    expect(layerNavigated(sheet, at.position)).toBe("keep");

    at.position -= 1;
    expect(layerNavigated(sheet, at.position)).toBe("keep");

    at.position -= 1;
    expect(layerNavigated(sheet, at.position)).toBe("dismiss");
  });

  it("leaves its entry alone when closed from under another one", () => {
    const at = history();
    at.position += 1;
    const sheet: LayerEntry = at.position;
    at.position += 1;

    expect(layerClosed(sheet, at.position)).toBe("none");
  });

  it("does nothing for a layer that never had an entry", () => {
    expect(layerClosed(null, 7)).toBe("none");
    expect(layerNavigated(null, 2)).toBe("keep");
  });

  it("takes a layer's entry nobody is using instead of making another", () => {
    expect(layerOpened(null, true, true)).toBe("take");
    expect(layerOpened(5, true, true)).toBe("none");
    expect(layerOpened(null, false, true)).toBe("none");
  });
});

describe("the address under a layer", () => {
  const onLayer = { position: 5, layer: true };

  it("goes down with one step off the layer's entry", () => {
    expect(carriesAddress(onLayer, 4, true, false)).toBe(true);
  });

  it("is left alone when nothing was written while the layer was open", () => {
    expect(carriesAddress(onLayer, 4, true, true)).toBe(false);
  });

  it("is not carried by any other step", () => {
    expect(carriesAddress({ position: 5, layer: false }, 4, true, false)).toBe(
      false,
    );
    expect(carriesAddress(onLayer, 3, true, false)).toBe(false);
    expect(carriesAddress(onLayer, 6, true, false)).toBe(false);
    expect(carriesAddress(onLayer, 5, true, false)).toBe(false);
  });

  it("never follows the visitor to another page", () => {
    expect(carriesAddress(onLayer, 4, false, false)).toBe(false);
  });
});
