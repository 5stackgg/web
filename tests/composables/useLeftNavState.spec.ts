import { beforeEach, describe, expect, it, vi } from "vitest";

async function freshState() {
  vi.resetModules();
  const { useLeftNavState } = await import("~/composables/useLeftNavState");
  return useLeftNavState();
}

beforeEach(() => {
  localStorage.clear();
});

describe("useLeftNavState", () => {
  it("starts every section open and with nothing pinned", async () => {
    const state = await freshState();

    expect(state.isOpen("play")).toBe(true);
    expect(state.pins.value).toEqual([]);
  });

  it("remembers folded sections and pins for the next visit", async () => {
    const first = await freshState();
    first.setOpen("compete", false);
    first.togglePin("utility");
    first.togglePin("leaderboard");

    const next = await freshState();

    expect(next.isOpen("compete")).toBe(false);
    expect(next.isOpen("watch")).toBe(true);
    expect(next.pins.value).toEqual(["utility", "leaderboard"]);
  });

  it("unpins and reopens", async () => {
    const state = await freshState();
    state.togglePin("utility");
    state.togglePin("utility");
    state.setOpen("watch", false);
    state.setOpen("watch", true);

    expect(state.isPinned("utility")).toBe(false);
    expect(localStorage.getItem("5stack:nav-folded")).toBe("{}");
  });

  it("marks a page as just pinned for a moment, and not when unpinned", async () => {
    vi.useFakeTimers();
    try {
      const state = await freshState();
      state.togglePin("utility");
      expect(state.lastPinned.value).toBe("utility");

      vi.advanceTimersByTime(400);
      expect(state.lastPinned.value).toBeNull();

      state.togglePin("utility");
      expect(state.lastPinned.value).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to the defaults when storage holds junk", async () => {
    localStorage.setItem("5stack:nav-pins", "{not json");

    const state = await freshState();

    expect(state.pins.value).toEqual([]);
  });
});
