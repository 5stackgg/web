import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

const STORAGE_KEY = "hub-friends-seen-online";
const DANA = "76561198000000002";
const ERIN = "76561198000000003";

const MINUTE = 60 * 1000;

let store: ReturnType<typeof useMatchmakingStore>;
let arrivals: Awaited<ReturnType<typeof load>>;

async function load() {
  vi.resetModules();
  const { useFriendArrivals } = await import("~/composables/useFriendArrivals");
  return useFriendArrivals();
}

async function online(...ids: string[]) {
  store.onlinePlayerSteamIds = ids;
  await nextTick();
}

describe("useFriendArrivals", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([DANA, ERIN]));
    store = useMatchmakingStore();
    store.friends = [DANA, ERIN].map((steam_id) => ({
      steam_id,
      status: "Accepted",
    })) as any;
    store.onlinePlayerSteamIds = [DANA, ERIN];
    store.presenceLoaded = true;
    arrivals = await load();
    await nextTick();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it("doesn't count a friend whose tab was gone for a few minutes", async () => {
    await online(ERIN);
    vi.advanceTimersByTime(5 * MINUTE);
    await online(DANA, ERIN);
    vi.advanceTimersByTime(2 * MINUTE);
    await nextTick();

    expect(arrivals.newlyOnline.value).toEqual([]);
    expect(arrivals.arrivals.value).toBe(0);
  });

  it("announces a friend back after a long absence once they've stayed", async () => {
    await online(ERIN);
    vi.advanceTimersByTime(15 * MINUTE);
    await online(DANA, ERIN);

    expect(arrivals.newlyOnline.value).toEqual([]);

    vi.advanceTimersByTime(MINUTE);
    await nextTick();

    expect(arrivals.newlyOnline.value).toEqual([DANA]);
    expect(arrivals.arrivals.value).toBe(1);
  });

  it("lets a short visit go by without cutting the absence short", async () => {
    await online(ERIN);
    vi.advanceTimersByTime(15 * MINUTE);
    await online(DANA, ERIN);
    vi.advanceTimersByTime(20 * 1000);
    await online(ERIN);
    vi.advanceTimersByTime(MINUTE);
    await nextTick();

    expect(arrivals.arrivals.value).toBe(0);

    await online(DANA, ERIN);
    vi.advanceTimersByTime(MINUTE);
    await nextTick();

    expect(arrivals.newlyOnline.value).toEqual([DANA]);
    expect(arrivals.arrivals.value).toBe(1);
  });

  it("rings once for a new friend who reloads before you look", async () => {
    await online(ERIN);
    vi.advanceTimersByTime(15 * MINUTE);
    await online(DANA, ERIN);
    vi.advanceTimersByTime(MINUTE);
    await online(ERIN);
    vi.advanceTimersByTime(1000);
    await online(DANA, ERIN);

    expect(arrivals.newlyOnline.value).toEqual([DANA]);
    expect(arrivals.arrivals.value).toBe(1);
  });

  it("takes what another tab has seen", async () => {
    await online(ERIN);
    vi.advanceTimersByTime(15 * MINUTE);
    await online(DANA, ERIN);
    vi.advanceTimersByTime(MINUTE);
    await nextTick();

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([DANA, ERIN]));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    await nextTick();

    expect(arrivals.newlyOnline.value).toEqual([]);
  });
});
