import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

vi.mock("~/web-sockets/Socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/web-sockets/Socket")>()),
  default: {
    connect() {},
    rejoinAll() {},
    event() {},
    listen: () => ({ stop() {} }),
    joinLobby: () => ({ messages: [], on() {}, leave() {} }),
    markLobbyRead() {},
  },
}));

const ME = "76561198000000701";
const ALPHA = "76561198000000702";
const BRAVO = "76561198000000703";

function freshStore() {
  setActivePinia(createPinia());
  useAuthStore().me = { steam_id: ME, role: e_player_roles_enum.user } as any;
  const store = useMatchmakingStore();
  const pages: Array<[string, string | null, string]> = [];
  const watches: Array<boolean> = [];
  store.sendOnlinePage = (
    requestId: string,
    after: string | null,
    query: string,
  ) => {
    pages.push([requestId, after, query]);
  };
  store.sendOnlineWatch = (watching: boolean) => {
    watches.push(watching);
  };
  return { store, pages, watches };
}

beforeEach(() => {
  const client = useApollo().clients!.default;
  vi.spyOn(client, "query").mockResolvedValue({ data: {} } as any);
  vi.spyOn(client, "subscribe").mockImplementation(
    () =>
      ({
        subscribe: () => ({ unsubscribe() {}, closed: false }),
      }) as any,
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("everyone online", () => {
  it("answers each page by its own request id", async () => {
    const { store, pages } = freshStore();

    const first = store.fetchOnlinePage({});
    const second = store.fetchOnlinePage({ after: "5:1", query: "al" });
    store.setOnlinePage({
      requestId: pages[1][0],
      listed: true,
      players: [{ steam_id: BRAVO, name: "bravo" }],
      next: null,
    });
    store.setOnlinePage({
      requestId: pages[0][0],
      listed: true,
      players: [{ steam_id: ALPHA, name: "alpha" }],
      next: "9:2",
    });

    expect(pages.map(([, after, query]) => [after, query])).toEqual([
      [null, ""],
      ["5:1", "al"],
    ]);
    expect(await first).toEqual({
      listed: true,
      players: [{ steam_id: ALPHA, name: "alpha" }],
      next: "9:2",
    });
    expect((await second)?.players[0].steam_id).toBe(BRAVO);
  });

  it("gives up on a page nobody answers", async () => {
    vi.useFakeTimers();
    const { store } = freshStore();

    const page = store.fetchOnlinePage({});
    vi.advanceTimersByTime(10_000);

    expect(await page).toBeUndefined();
  });

  it("keeps who came and went only while this tab watches the list", () => {
    const { store, watches } = freshStore();

    store.applyOnlinePresence({ steam_id: ALPHA, online: true });
    expect(store.onlineChanges).toEqual({});

    store.watchOnline(true);
    store.applyOnlinePresence({ steam_id: ALPHA, online: true });
    store.applyOnlinePresence({ steam_id: BRAVO, online: false });
    expect(store.onlineChanges).toEqual({ [ALPHA]: true, [BRAVO]: false });

    store.watchOnline(false);
    store.applyOnlinePresence({ steam_id: ALPHA, online: false });
    expect(store.onlineChanges).toEqual({});
    expect(watches).toEqual([true, false]);
  });

  it("watches again on a new socket and has the list reload", () => {
    const { store, watches } = freshStore();

    store.resumeOnlineWatch();
    expect(watches).toEqual([]);

    store.watchOnline(true);
    store.applyOnlinePresence({ steam_id: ALPHA, online: true });
    store.resumeOnlineWatch();

    expect(watches).toEqual([true, true]);
    expect(store.onlineChanges).toEqual({});
    expect(store.onlineResets).toBe(1);
  });
});
