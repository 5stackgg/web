import { describe, expect, it } from "vitest";
import {
  addressCarried,
  addressCloseDelta,
  addressOpenMode,
  addressRaised,
  addressWrites,
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
  const onLayer = { position: 5, layer: true, opened: {} };

  it("goes down whole with one step off the layer's entry", () => {
    expect(addressCarried(onLayer, 4, true)).toEqual([]);
  });

  it("is not carried by any other step", () => {
    expect(
      addressCarried({ position: 5, layer: false, opened: {} }, 4, true),
    ).toBeNull();
    expect(addressCarried(onLayer, 3, true)).toBeNull();
    expect(addressCarried(onLayer, 6, true)).toBeNull();
    expect(addressCarried(onLayer, 5, true)).toBeNull();
  });

  it("never follows the visitor to another page", () => {
    expect(addressCarried(onLayer, 4, false)).toBeNull();
  });
});

describe("the address under what was opened by address", () => {
  const onLineup = { position: 5, layer: false, opened: { lineup: 5 } };

  it("goes down with the step out of it, less the thing it opened", () => {
    expect(addressCarried(onLineup, 4, true)).toEqual(["lineup"]);
  });

  it("goes down past a layer over it, too", () => {
    const layerOverLineup = {
      position: 6,
      layer: true,
      opened: { lineup: 5 },
    };
    // One step closes the layer and leaves the lineup: everything is kept.
    expect(addressCarried(layerOverLineup, 5, true)).toEqual([]);
    // Two close both.
    expect(addressCarried(layerOverLineup, 4, true)).toEqual(["lineup"]);
  });

  it("closes only what was opened above where the step lands", () => {
    const lineupInSpot = {
      position: 7,
      layer: true,
      opened: { spot: 5, lineup: 6 },
    };
    expect(addressCarried(lineupInSpot, 5, true)).toEqual(["lineup"]);
    expect(addressCarried(lineupInSpot, 4, true)?.sort()).toEqual([
      "lineup",
      "spot",
    ]);
  });

  it("is left to Back on a jump that lands anywhere else", () => {
    expect(addressCarried(onLineup, 3, true)).toBeNull();
    expect(addressCarried(onLineup, 6, true)).toBeNull();
    expect(addressCarried(onLineup, 4, false)).toBeNull();
  });
});

describe("the address on the way up", () => {
  const under = { position: 4, layer: false, opened: {} };

  it("goes up whole onto a layer's entry", () => {
    expect(
      addressRaised(under, { position: 5, layer: true, opened: {} }, true),
    ).toEqual([]);
  });

  it("goes up onto the entry that opened something, which adds that back", () => {
    expect(
      addressRaised(
        under,
        { position: 5, layer: false, opened: { lineup: 5 } },
        true,
      ),
    ).toEqual(["lineup"]);
  });

  it("is left to Forward everywhere else", () => {
    const plain = { position: 5, layer: false, opened: {} };
    expect(addressRaised(under, plain, true)).toBeNull();
    expect(
      addressRaised(under, { position: 6, layer: true, opened: {} }, true),
    ).toBeNull();
    expect(
      addressRaised(under, { position: 5, layer: true, opened: {} }, false),
    ).toBeNull();
    // What was opened further down is not this entry's to add.
    expect(
      addressRaised(
        under,
        { position: 5, layer: false, opened: { lineup: 3 } },
        true,
      ),
    ).toBeNull();
  });
});

describe("a batch of writes to the address", () => {
  const OPENED = ["lineup", "spot"];

  it("is one replace when nothing is being opened", () => {
    expect(
      addressWrites({ tab: "meta" }, { type: "Smoke" }, "replace", OPENED),
    ).toEqual({
      replace: { tab: "meta", type: "Smoke" },
      push: null,
      opening: [],
      removed: [],
    });
  });

  it("is nothing when the address already says it", () => {
    const writes = addressWrites({ tab: "meta" }, { tab: "meta" }, "replace", OPENED);
    expect(writes.replace).toBeNull();
    expect(writes.push).toBeNull();
  });

  it("pushes what it opens and nothing else", () => {
    expect(addressWrites({ type: "Smoke" }, { lineup: "a" }, "push", OPENED)).toEqual({
      replace: null,
      push: { type: "Smoke", lineup: "a" },
      opening: ["lineup"],
      removed: [],
    });
  });

  // A lineup saved from the Create tab is filed under Lineups and opened in
  // one go. Pushed as one entry, stepping out of the lineup landed back on
  // the empty form.
  it("writes the rest onto the entry underneath before it pushes", () => {
    expect(
      addressWrites({ tab: "create" }, { tab: null, lineup: "a" }, "push", OPENED),
    ).toEqual({
      replace: {},
      push: { lineup: "a" },
      opening: ["lineup"],
      removed: [],
    });
  });

  it("swaps one open lineup for another in place", () => {
    expect(
      addressWrites({ lineup: "a" }, { lineup: "b" }, "replace", OPENED),
    ).toEqual({
      replace: { lineup: "b" },
      push: null,
      opening: [],
      removed: [],
    });
  });

  it("says what it took out by hand", () => {
    const writes = addressWrites(
      { lineup: "a", tab: "meta" },
      { lineup: null, tab: null },
      "replace",
      OPENED,
    );
    expect(writes.replace).toEqual({});
    expect(writes.removed).toEqual(["lineup"]);
  });
});
