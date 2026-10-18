// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { dockTier, observeDockTier } from "~/composables/dockTier";

describe("dockTier", () => {
  // Room = width - 1248 - 16.
  it("docks wide with 640px of room, narrow with 400px, else a sheet", () => {
    expect(dockTier(1248 + 16 + 640)).toBe("wide");
    expect(dockTier(1248 + 16 + 639)).toBe("docked");
    expect(dockTier(1248 + 16 + 400)).toBe("docked");
    expect(dockTier(1248 + 16 + 399)).toBe("sheet");
    expect(dockTier(1248)).toBe("sheet");
    expect(dockTier(390)).toBe("sheet");
    expect(dockTier(0)).toBe("sheet");
  });

  it("takes another cap, gap and thresholds", () => {
    const options = { cap: 1000, gap: 0, wide: 500, narrow: 300 };
    expect(dockTier(1500, options)).toBe("wide");
    expect(dockTier(1499, options)).toBe("docked");
    expect(dockTier(1299, options)).toBe("sheet");
  });
});

describe("observeDockTier", () => {
  const observers: Array<{
    callback: ResizeObserverCallback;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];

  afterEach(() => {
    observers.length = 0;
    vi.unstubAllGlobals();
  });

  it("reports the tier at once and again only when it changes", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect = vi.fn();
        constructor(callback: ResizeObserverCallback) {
          observers.push({ callback, disconnect: this.disconnect });
        }
        observe() {}
      },
    );
    const element = document.createElement("div");
    Object.defineProperty(element, "clientWidth", { value: 1700 });
    const seen: Array<string> = [];
    const stop = observeDockTier(element, (tier) => seen.push(tier));

    const resize = (width: number) =>
      observers[0].callback(
        [{ contentRect: { width } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    resize(1710);
    resize(2000);
    resize(1300);

    expect(seen).toEqual(["docked", "wide", "sheet"]);
    stop();
    expect(observers[0].disconnect).toHaveBeenCalled();
  });
});
