import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import tabFlashPlugin from "~/plugins/tab-flash.client";

const flash = vi.hoisted(() => ({
  installTabFlash: vi.fn(),
  trackBellCount: vi.fn(),
  signal: vi.fn(),
  clear: vi.fn(),
}));

vi.mock("~/composables/useTabFlash", () => ({
  installTabFlash: flash.installTabFlash,
  trackBellCount: flash.trackBellCount,
  useTabFlash: () => ({ signal: flash.signal, clear: flash.clear }),
}));

function runPlugin() {
  let mounted: (() => void) | undefined;
  const nuxtApp = {
    hook: (name: string, callback: () => void) => {
      if (name === "app:mounted") {
        mounted = callback;
      }
    },
    runWithContext: (fn: () => unknown) => useNuxtApp().runWithContext(fn),
  };
  (tabFlashPlugin as unknown as (app: typeof nuxtApp) => void)(nuxtApp);
  mounted!();
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete useRoute().meta.layout;
});

describe("tab-flash plugin", () => {
  it("tracks the bell in the main window", () => {
    runPlugin();

    expect(flash.trackBellCount).toHaveBeenCalledTimes(1);
  });

  it("leaves store alerts to the main window in a layout-less pop-out", () => {
    vi.stubGlobal("opener", {});
    useRoute().meta.layout = false;

    runPlugin();

    expect(flash.installTabFlash).toHaveBeenCalledTimes(1);
    expect(flash.trackBellCount).not.toHaveBeenCalled();
    expect(flash.clear).not.toHaveBeenCalled();
  });
});
