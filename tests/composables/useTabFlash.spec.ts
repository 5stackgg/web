import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import {
  installTabFlash,
  trackBellCount,
  useTabFlash,
} from "~/composables/useTabFlash";
import { faviconOverride } from "~/composables/useBranding";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";

const BASE_TITLE = "Matches | 5Stack";
const SETTING_KEYS = ["match-found", "admin-call", "chat", "bell"];

let visibility: DocumentVisibilityState = "visible";

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

// Fake timers hold back anything scheduled on a timer, so only drain the
// microtask queue the icon's promise chain runs on.
async function drainMicrotasks() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  installTabFlash();
  document.title = BASE_TITLE;
  vi.useFakeTimers();
});

afterEach(() => {
  setVisibility("visible");
  vi.useRealTimers();
  delete (document as { visibilityState?: unknown }).visibilityState;
  for (const key of SETTING_KEYS) {
    localStorage.removeItem(`5stack:tab-flash:${key}`);
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useTabFlash title", () => {
  it("ignores signals while the tab is visible", () => {
    const flash = useTabFlash();

    flash.signal("chat", "visible-1");
    flash.signal("bell");
    vi.advanceTimersByTime(3000);

    expect(document.title).toBe(BASE_TITLE);
    expect(flash.counts.chat).toBe(0);
    expect(flash.counts.bell).toBe(0);
  });

  it("alternates a counted title with the page's own while hidden", () => {
    setVisibility("hidden");
    useTabFlash().signal("chat", "hidden-1");

    expect(document.title).toBe("(1) New message");
    vi.advanceTimersByTime(1000);
    expect(document.title).toBe(BASE_TITLE);
    vi.advanceTimersByTime(1000);
    expect(document.title).toBe("(1) New message");
  });

  it("counts every kind and names the most urgent one", () => {
    setVisibility("hidden");
    const flash = useTabFlash();

    flash.signal("bell");
    expect(document.title).toBe("(1) New notification");

    flash.signal("chat", "priority-1");
    expect(document.title).toBe("(2) New messages");

    flash.signal("match_found", "priority-confirmation");
    expect(document.title).toBe("(3) Match found");

    flash.signal("admin_call");
    expect(document.title).toBe("(4) An organizer is calling");
  });

  it("updates the title in place when a count changes mid-blink", () => {
    setVisibility("hidden");
    const flash = useTabFlash();

    flash.signal("chat", "mid-blink-1");
    vi.advanceTimersByTime(1000);
    expect(document.title).toBe(BASE_TITLE);

    flash.signal("chat", "mid-blink-2");
    expect(document.title).toBe(BASE_TITLE);
    vi.advanceTimersByTime(1000);
    expect(document.title).toBe("(2) New messages");
  });

  it("stops, resets and restores the title once the tab is visible", () => {
    setVisibility("hidden");
    const flash = useTabFlash();
    flash.signal("chat", "restore-1");
    flash.signal("match_found", "restore-confirmation");

    setVisibility("visible");

    expect(document.title).toBe(BASE_TITLE);
    expect(flash.counts.chat).toBe(0);
    expect(flash.counts.match_found).toBe(0);
    expect(faviconOverride.value).toBeNull();
    vi.advanceTimersByTime(5000);
    expect(document.title).toBe(BASE_TITLE);

    setVisibility("hidden");
    flash.signal("chat", "restore-2");
    expect(document.title).toBe("(1) New message");
  });

  it("adopts a title unhead writes mid-flash and restores that one", () => {
    setVisibility("hidden");
    useTabFlash().signal("chat", "unhead-1");

    document.title = "Inferno | 5Stack";
    vi.advanceTimersByTime(1000);
    expect(document.title).toBe("Inferno | 5Stack");
    vi.advanceTimersByTime(1000);
    expect(document.title).toBe("(1) New message");

    setVisibility("visible");
    expect(document.title).toBe("Inferno | 5Stack");
  });

  it("holds the alert title steady for reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
        }) as MediaQueryList,
    );
    setVisibility("hidden");
    useTabFlash().signal("chat", "reduced-1");

    vi.advanceTimersByTime(1000);
    expect(document.title).toBe("(1) New message");
    vi.advanceTimersByTime(1000);
    expect(document.title).toBe("(1) New message");

    setVisibility("visible");
    expect(document.title).toBe(BASE_TITLE);
  });

  it("respects a kind switched off in settings", () => {
    localStorage.setItem("5stack:tab-flash:chat", "false");
    setVisibility("hidden");
    const flash = useTabFlash();

    flash.signal("chat", "off-1");
    expect(document.title).toBe(BASE_TITLE);
    expect(flash.counts.chat).toBe(0);

    flash.signal("bell");
    expect(document.title).toBe("(1) New notification");
  });

  it("counts a message once however many handlers report it", () => {
    setVisibility("hidden");
    const flash = useTabFlash();

    flash.signal("chat", "dupe-1");
    flash.signal("chat", "dupe-1");

    expect(flash.counts.chat).toBe(1);
    expect(document.title).toBe("(1) New message");
  });

  it("never flashes for something already seen while visible", () => {
    const flash = useTabFlash();
    flash.signal("match_found", "seen-confirmation");

    setVisibility("hidden");
    flash.signal("match_found", "seen-confirmation");

    expect(document.title).toBe(BASE_TITLE);
  });

  it("never flashes for a line relayed from in-game, in any room", () => {
    setVisibility("hidden");
    const flash = useTabFlash();

    flash.signalChat("match_team", { id: "relay-1", source: "game" });
    flash.signalChat("direct", { id: "relay-2", source: "game" });
    expect(document.title).toBe(BASE_TITLE);

    flash.signalChat("match_team", { id: "relay-3", source: "web" });
    expect(document.title).toBe("(1) New message");
  });

  it("leaves out match rooms even without a source, for older APIs", () => {
    setVisibility("hidden");
    const flash = useTabFlash();

    flash.signalChat("match", { id: "legacy-1" });
    flash.signalChat("match", { id: "legacy-2", source: "web" });
    expect(document.title).toBe(BASE_TITLE);

    flash.signalChat("tournament", { id: "legacy-3" });
    expect(document.title).toBe("(1) New message");
  });

  it("drops a cleared kind and stops once nothing is left", () => {
    setVisibility("hidden");
    const flash = useTabFlash();
    flash.signal("match_found", "clear-confirmation");
    flash.signal("chat", "clear-1");
    expect(document.title).toBe("(2) Match found");

    flash.clear("match_found");
    expect(document.title).toBe("(1) New message");

    flash.clear("chat");
    expect(document.title).toBe(BASE_TITLE);
    vi.advanceTimersByTime(3000);
    expect(document.title).toBe(BASE_TITLE);
  });
});

// The Nuxt app boots with its own copy of the composable's module, so these go
// through the plugin and read the title rather than the test's own counts.
describe("tab flash sources", () => {
  it("flashes a new match confirmation and clears it once ready", async () => {
    const matchmaking = useMatchmakingStore();
    setVisibility("hidden");

    const confirmation = {
      matchId: "",
      isReady: false,
      expiresAt: new Date().toISOString(),
      confirmed: 0,
      confirmationId: "store-confirmation-1",
      type: "Competitive",
      region: "us",
      players: 10,
    };

    matchmaking.joinedMatchmakingQueues = { confirmation } as never;
    await nextTick();
    expect(document.title).toBe("(1) Match found");

    matchmaking.joinedMatchmakingQueues = {
      confirmation: { ...confirmation, confirmed: 3 },
    } as never;
    await nextTick();
    expect(document.title).toBe("(1) Match found");

    matchmaking.joinedMatchmakingQueues = {
      confirmation: { ...confirmation, isReady: true },
    } as never;
    await nextTick();
    expect(document.title).toBe(BASE_TITLE);

    matchmaking.joinedMatchmakingQueues = {} as never;
  });

});

describe("trackBellCount", () => {
  function trackFake(initial: { loaded: boolean; count: number }) {
    const loaded = ref(initial.loaded);
    const count = ref(initial.count);
    const scope = effectScope();

    scope.run(() =>
      trackBellCount(() => ({ loaded: loaded.value, count: count.value })),
    );

    return { loaded, count, stop: () => scope.stop() };
  }

  it("flashes only what arrives after the tab is hidden", async () => {
    const bell = trackFake({ loaded: true, count: 2 });

    setVisibility("hidden");
    bell.count.value = 1;
    await nextTick();
    bell.count.value = 2;
    await nextTick();
    expect(document.title).toBe(BASE_TITLE);

    bell.count.value = 4;
    await nextTick();
    expect(document.title).toBe("(2) New notifications");

    bell.stop();
  });

  it("never flashes what the first load delivers to a hidden tab", async () => {
    setVisibility("hidden");
    const bell = trackFake({ loaded: false, count: 0 });

    bell.count.value = 3;
    bell.loaded.value = true;
    await nextTick();
    expect(document.title).toBe(BASE_TITLE);

    bell.count.value = 4;
    await nextTick();
    expect(document.title).toBe("(1) New notification");

    bell.stop();
  });

  it("takes a fresh baseline every time the tab is hidden", async () => {
    const bell = trackFake({ loaded: true, count: 0 });

    setVisibility("hidden");
    bell.count.value = 1;
    await nextTick();
    expect(document.title).toBe("(1) New notification");

    setVisibility("visible");
    setVisibility("hidden");
    await nextTick();
    expect(document.title).toBe(BASE_TITLE);

    bell.stop();
  });

  it("ignores rises while the tab is visible", async () => {
    const bell = trackFake({ loaded: true, count: 0 });

    bell.count.value = 5;
    await nextTick();
    setVisibility("hidden");
    await nextTick();

    expect(document.title).toBe(BASE_TITLE);

    bell.stop();
  });
});

describe("tab flash icon", () => {
  type FakeContext = Record<string, unknown> & {
    fillText: ReturnType<typeof vi.fn>;
  };

  function fakeCanvas() {
    const context: FakeContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      measureText: vi.fn(() => ({ width: 18 })),
      beginPath: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as never,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,ALERT",
    );
    return context;
  }

  function fakeImages(fails: (src: string) => boolean) {
    const loaded: Array<{ src: string; crossOrigin: string | null }> = [];

    class FakeImage {
      crossOrigin: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(value: string) {
        loaded.push({ src: value, crossOrigin: this.crossOrigin });
        queueMicrotask(() => {
          if (fails(value)) {
            this.onerror?.();
            return;
          }
          this.onload?.();
        });
      }
    }

    vi.stubGlobal("Image", FakeImage);
    return loaded;
  }

  function brandFavicon(version: string) {
    useApplicationSettingsStore().settings = [
      { name: "public.favicon_url", value: version },
    ];
  }

  afterEach(() => {
    useApplicationSettingsStore().settings = [];
  });

  it("falls back to title-only flashing when there is no canvas", async () => {
    brandFavicon("no-canvas");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    setVisibility("hidden");

    useTabFlash().signal("chat", "no-canvas-1");
    await drainMicrotasks();

    expect(faviconOverride.value).toBeNull();
    expect(document.title).toBe("(1) New message");
  });

  it("draws the count over the branded icon through CORS", async () => {
    brandFavicon("cors-ok");
    const context = fakeCanvas();
    const loaded = fakeImages(() => false);
    setVisibility("hidden");

    useTabFlash().signal("chat", "cors-ok-1");
    await drainMicrotasks();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].src).toMatch(
      /\/branding\/favicon\?v=cors-ok&tab-flash=1$/,
    );
    expect(loaded[0].crossOrigin).toBe("anonymous");
    expect(context.fillText).toHaveBeenCalledWith("1", expect.any(Number), 21);
    expect(faviconOverride.value).toBe("data:image/png;base64,ALERT");

    setVisibility("visible");
    expect(faviconOverride.value).toBeNull();
  });

  it("stays title-only rather than show 5stack's icon on a brand", async () => {
    brandFavicon("cors-broken");
    fakeCanvas();
    const loaded = fakeImages((src) => src.includes("/branding/"));
    setVisibility("hidden");

    useTabFlash().signal("chat", "cors-broken-1");
    await drainMicrotasks();

    expect(loaded.map((image) => image.src)).toEqual([
      expect.stringContaining("/branding/favicon?v=cors-broken&tab-flash=1"),
    ]);
    expect(faviconOverride.value).toBeNull();
    expect(document.title).toBe("(1) New message");
  });

  it("draws on the bundled icon when there is no branding", async () => {
    fakeCanvas();
    const loaded = fakeImages(() => false);
    setVisibility("hidden");

    useTabFlash().signal("chat", "unbranded-1");
    await drainMicrotasks();

    expect(loaded.map((image) => image.src)).toEqual(["/favicon/64.png"]);
    expect(faviconOverride.value).toBe("data:image/png;base64,ALERT");
  });

  it("caps the icon's count at 9+", async () => {
    brandFavicon("cap");
    const context = fakeCanvas();
    fakeImages(() => false);
    setVisibility("hidden");
    const flash = useTabFlash();

    for (let i = 0; i < 12; i++) {
      flash.signal("chat", `cap-${i}`);
    }
    await drainMicrotasks();

    expect(document.title).toBe("(12) New messages");
    expect(context.fillText).toHaveBeenLastCalledWith(
      "9+",
      expect.any(Number),
      21,
    );
  });

  it("retries an icon that failed to draw a minute later", async () => {
    brandFavicon("retry");
    fakeCanvas();
    let failing = true;
    const loaded = fakeImages(() => failing);
    setVisibility("hidden");

    useTabFlash().signal("chat", "retry-1");
    await drainMicrotasks();
    expect(faviconOverride.value).toBeNull();

    setVisibility("visible");
    failing = false;
    vi.advanceTimersByTime(60_000);
    setVisibility("hidden");
    useTabFlash().signal("chat", "retry-2");
    await drainMicrotasks();

    expect(loaded).toHaveLength(2);
    expect(faviconOverride.value).toBe("data:image/png;base64,ALERT");
  });

  it("never applies an icon that finishes loading after the flash stopped", async () => {
    brandFavicon("late");
    fakeCanvas();
    fakeImages(() => false);
    setVisibility("hidden");

    useTabFlash().signal("chat", "late-1");
    setVisibility("visible");
    await drainMicrotasks();

    expect(faviconOverride.value).toBeNull();
  });
});
