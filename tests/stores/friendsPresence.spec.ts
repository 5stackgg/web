import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
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

const ME = "76561198000000301";
const ALPHA = "76561198000000302";
const BRAVO = "76561198000000303";
const CHARLIE = "76561198000000304";

let requests = 0;

function freshStore() {
  setActivePinia(createPinia());
  const store = useMatchmakingStore();
  store.sendFriendsOnlineRequest = () => {
    requests++;
  };
  return store;
}

const signIn = () => {
  useAuthStore().me = {
    steam_id: ME,
    role: e_player_roles_enum.user,
  } as any;
};

beforeEach(() => {
  requests = 0;
  const client = useApollo().clients!.default;
  vi.spyOn(client, "query").mockResolvedValue({
    data: { __type: { fields: [] } },
  } as any);
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

describe("friends' presence from the api", () => {
  it("takes who is online from friends-online, with me in it", async () => {
    const store = freshStore();
    signIn();
    await nextTick();

    store.setFriendsOnline([ALPHA, BRAVO]);
    expect(store.onlinePlayerSteamIds).toEqual([ALPHA, BRAVO, ME]);
    expect(store.presenceLoaded).toBe(true);

    store.setFriendsOnline([BRAVO]);
    expect(store.onlinePlayerSteamIds).toEqual([BRAVO, ME]);
  });

  it("adds and drops a friend on friend-presence", () => {
    const store = freshStore();

    store.setFriendsOnline([ALPHA]);
    store.setFriendPresence({ steam_id: BRAVO, online: true });
    store.setFriendPresence({ steam_id: BRAVO, online: true });
    store.setFriendPresence({ steam_id: ALPHA, online: false });

    expect(store.onlinePlayerSteamIds).toEqual([BRAVO]);
  });

  it("takes the online count from players-online:count", () => {
    const store = freshStore();

    store.setOnlineCount(1234);

    expect(store.onlineCount).toBe(1234);
  });

  it("uses the full roster only from an api that sends nothing newer", () => {
    const store = freshStore();

    store.setLegacyRoster([ALPHA, BRAVO, CHARLIE]);
    expect(store.onlinePlayerSteamIds).toEqual([ALPHA, BRAVO, CHARLIE]);
    expect(store.onlineCount).toBe(3);

    store.setOnlineCount(7);
    store.setFriendsOnline([ALPHA]);
    store.setLegacyRoster([CHARLIE]);

    expect(store.onlinePlayerSteamIds).toEqual([ALPHA]);
    expect(store.onlineCount).toBe(7);
  });

  it("asks again when the friends list changes, not on its first load", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const store = freshStore();

    store.friends = [{ steam_id: ALPHA }] as any;
    await nextTick();
    await vi.advanceTimersByTimeAsync(600);
    expect(requests).toBe(0);

    store.friends = [{ steam_id: ALPHA }, { steam_id: BRAVO }] as any;
    await nextTick();
    await vi.advanceTimersByTimeAsync(600);
    expect(requests).toBe(1);

    store.friends = [{ steam_id: BRAVO }, { steam_id: ALPHA }] as any;
    await nextTick();
    await vi.advanceTimersByTimeAsync(600);
    expect(requests).toBe(1);
  });

  it("asks again five minutes after the last answer", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const store = freshStore();
    signIn();
    await nextTick();

    store.setFriendsOnline([ALPHA]);
    await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
    store.setFriendsOnline([ALPHA]);
    await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
    expect(requests).toBe(0);

    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(requests).toBe(1);
  });

  it("forgets who is online when signing out", async () => {
    const store = freshStore();
    signIn();
    await nextTick();
    store.setFriendsOnline([ALPHA]);

    useAuthStore().me = undefined;
    await nextTick();

    expect(store.onlinePlayerSteamIds).toEqual([]);
    expect(store.presenceLoaded).toBe(false);
  });
});
