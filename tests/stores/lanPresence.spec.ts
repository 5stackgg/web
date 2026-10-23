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

const ME = "76561198000000501";
const ALPHA = "76561198000000502";
const BRAVO = "76561198000000503";

const profile = (steam_id: string) => ({ steam_id, name: `p${steam_id}` });
const ids = (rows: Array<any>) => rows.map((row) => row.steam_id);

function freshStore() {
  setActivePinia(createPinia());
  useAuthStore().me = { steam_id: ME, role: e_player_roles_enum.user } as any;
  return useMatchmakingStore();
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

describe("the LAN this tab is on", () => {
  it("takes everyone at the LAN from the api's roster", () => {
    const store = freshStore();

    store.setLanRoster({
      region: "vulkan",
      players: [profile(ME), profile(ALPHA)],
    });

    expect(store.lanRegion).toBe("vulkan");
    expect(ids(store.lanPlayers)).toEqual([ME, ALPHA]);
  });

  it("adds arrivals as just arrived and keeps a leaver greyed for 30 seconds", () => {
    vi.useFakeTimers();
    const store = freshStore();
    store.setLanRoster({ region: "vulkan", players: [profile(ALPHA)] });

    store.applyLanPresence({
      region: "vulkan",
      joined: [profile(BRAVO)],
      left: [ALPHA],
    });

    expect(ids(store.lanPlayers)).toEqual([ALPHA, BRAVO]);
    expect(store.lanArrivals).toEqual([BRAVO]);
    expect(store.lanLeft).toEqual([ALPHA]);

    vi.advanceTimersByTime(30_000);
    expect(ids(store.lanPlayers)).toEqual([BRAVO]);
    expect(store.lanLeft).toEqual([]);
  });

  it("keeps someone who comes back before their 30 seconds are up", () => {
    vi.useFakeTimers();
    const store = freshStore();
    store.setLanRoster({ region: "vulkan", players: [profile(ALPHA)] });

    store.applyLanPresence({ region: "vulkan", left: [ALPHA] });
    store.applyLanPresence({ region: "vulkan", joined: [profile(ALPHA)] });
    vi.advanceTimersByTime(30_000);

    expect(ids(store.lanPlayers)).toEqual([ALPHA]);
    expect(store.lanLeft).toEqual([]);
  });

  it("ignores presence for another LAN, and drops the LAN when the api says none", () => {
    const store = freshStore();
    store.setLanRoster({ region: "vulkan", players: [profile(ALPHA)] });

    store.applyLanPresence({ region: "haag", joined: [profile(BRAVO)] });
    expect(ids(store.lanPlayers)).toEqual([ALPHA]);

    store.setLanRoster({ region: null, players: [] });
    expect(store.lanRegion).toBeNull();
    expect(store.lanPlayers).toEqual([]);
  });
});

describe("checking which search results are online", () => {
  it("answers each check by its own request id", async () => {
    const store = freshStore();
    const sent: Array<[string, Array<string>]> = [];
    store.sendOnlineCheck = (requestId: string, steamIds: Array<string>) => {
      sent.push([requestId, steamIds]);
    };

    const first = store.checkOnline([ALPHA, BRAVO, ALPHA]);
    const second = store.checkOnline([BRAVO]);

    expect(sent.map(([, steamIds]) => steamIds)).toEqual([
      [ALPHA, BRAVO],
      [BRAVO],
    ]);
    store.setOnlineCheck({ requestId: sent[1][0], online: [BRAVO] });
    store.setOnlineCheck({ requestId: sent[0][0], online: [ALPHA] });

    expect([...(await first).online]).toEqual([ALPHA]);
    expect([...(await second).online]).toEqual([BRAVO]);
  });
});
