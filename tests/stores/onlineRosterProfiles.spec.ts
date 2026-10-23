import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";

const sent = vi.hoisted(() => [] as Array<{ event: string; data: any }>);

const ALPHA = "76561198000000201";
const BRAVO = "76561198000000202";
const CHARLIE = "76561198000000203";
const DELTA = "76561198000000204";

const profile = (steam_id: string) => ({
  steam_id,
  name: steam_id,
  elo: { competitive: 1000 },
  allow_message_requests: true,
});

let lookups = 0;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  sent.length = 0;
  useMatchmakingStore().sendProfilesRequest = (steamIds: string[]) => {
    sent.push({ event: "players-online:profiles", data: { steamIds } });
  };
  lookups = 0;
  const client = useApollo().clients!.default;
  vi.spyOn(client, "query").mockImplementation((async (options: any) => {
    if (options.variables?.steam_ids || options.variables?.steamIds) {
      lookups++;
      return { data: { players: [] } };
    }
    return { data: { __type: { fields: [] } } };
  }) as any);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const requests = () =>
  sent
    .filter(({ event }) => event === "players-online:profiles")
    .map(({ data }) => data.steamIds);

async function roster(
  store: ReturnType<typeof useMatchmakingStore>,
  ids: string[],
) {
  store.onlinePlayerSteamIds = ids;
  await nextTick();
  await vi.advanceTimersByTimeAsync(300);
}

describe("the online list's profiles from the socket", () => {
  it("lists the players from the profiles the api sent, with no lookup", async () => {
    const store = useMatchmakingStore();

    store.addOnlineProfiles([profile(ALPHA), profile(BRAVO)]);
    await roster(store, [BRAVO, ALPHA]);
    await vi.advanceTimersByTimeAsync(6000);

    expect(store.playersOnline.map((p: any) => p.steam_id)).toEqual([
      BRAVO,
      ALPHA,
    ]);
    expect(requests()).toEqual([]);
    expect(lookups).toBe(0);
  });

  it("asks the api once for a player it has no profile for", async () => {
    const store = useMatchmakingStore();
    store.addOnlineProfiles([profile(ALPHA)]);

    await roster(store, [ALPHA, CHARLIE]);
    await roster(store, [CHARLIE, ALPHA]);
    await roster(store, [ALPHA, CHARLIE]);
    store.addOnlineProfiles([profile(CHARLIE)]);
    await vi.advanceTimersByTimeAsync(6000);

    expect(requests()).toEqual([[CHARLIE]]);
    expect(lookups).toBe(0);
    expect(store.playersOnline.map((p: any) => p.steam_id)).toEqual([
      ALPHA,
      CHARLIE,
    ]);
  });

  it("doesn't fall back once the api has sent profiles", async () => {
    const store = useMatchmakingStore();
    store.addOnlineProfiles([]);

    await roster(store, [DELTA]);
    await vi.advanceTimersByTimeAsync(6000);

    expect(requests()).toEqual([[DELTA]]);
    expect(lookups).toBe(0);
  });
});
