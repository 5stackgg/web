import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { print } from "graphql";
import { flushPromises } from "@vue/test-utils";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

vi.mock("~/web-sockets/Socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/web-sockets/Socket")>()),
  default: {
    connect() {},
    rejoinAll() {},
    listen: () => ({ stop() {} }),
    joinLobby: () => ({ messages: [], on() {}, leave() {} }),
    markLobbyRead() {},
  },
}));

const NOW = new Date("2026-10-14T12:00:00.000Z");
const MINUTE = 60 * 1000;
const STEAM_ID = "76561198000000001";

const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

const match = (
  id: string,
  status: string,
  createdAgo: number,
  scheduled_at: string | null = null,
) => ({
  id,
  status,
  created_at: at(-createdAgo),
  scheduled_at,
  is_in_lineup: true,
});

let subscriptions: Array<{ options: any; observer: any }> = [];

function serve() {
  const client = useApollo().clients!.default;
  // An API without active_matches yet: my matches read matches directly.
  vi.spyOn(client, "query").mockResolvedValue({
    data: { __type: { fields: [] } },
  } as any);
  vi.spyOn(client, "subscribe").mockImplementation(
    (options: any) =>
      ({
        subscribe(observer: any) {
          subscriptions.push({ options, observer });
          return { unsubscribe() {}, closed: false };
        },
      }) as any,
  );
  return client;
}

const subscriptionsTo = (field: string) =>
  subscriptions.filter(({ options }) =>
    new RegExp(`^\\s*${field}\\b`, "m").test(print(options.query)),
  );

async function deliver(rows: unknown[]) {
  await useMatchLobbyStore().subscribeToMyMatches();
  subscriptionsTo("matches")
    .at(-1)!
    .observer.next({ data: { matches: rows } });
  await nextTick();
}

const ids = () =>
  (useMatchLobbyStore().myMatches as Array<{ id: string }>).map(({ id }) => id);

const current = () => (useMatchLobbyStore().currentMatch as any)?.id;

beforeEach(() => {
  vi.useFakeTimers({
    now: NOW,
    toFake: ["Date", "setInterval", "clearInterval"],
  });
  serve();
  useAuthStore().me = {
    steam_id: STEAM_ID,
    role: e_player_roles_enum.user,
  } as any;
});

afterEach(() => {
  subscriptions = [];
  useMatchLobbyStore().myMatches = [];
  useAuthStore().me = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("current match", () => {
  it("is the live match even when newer matches are waiting", async () => {
    await deliver([
      match("scheduled", "Scheduled", 1 * MINUTE, at(30 * MINUTE)),
      match("server", "WaitingForServer", 2 * MINUTE),
      match("live", "Live", 90 * MINUTE),
    ]);

    expect(current()).toBe("live");
  });

  it("follows Live, Veto, check-in, server, picking players, then scheduled", async () => {
    const order = [
      match("live", "Live", 60 * MINUTE),
      match("veto", "Veto", 50 * MINUTE),
      match("check-in", "WaitingForCheckIn", 40 * MINUTE),
      match("server", "WaitingForServer", 30 * MINUTE),
      match("picking", "PickingPlayers", 20 * MINUTE),
      match("scheduled", "Scheduled", 10 * MINUTE, at(30 * MINUTE)),
    ];

    for (let index = 0; index < order.length; index++) {
      await deliver(order.slice(index).reverse());
      expect(current()).toBe(order[index].id);
    }
  });

  it("is the newest of two matches in the same status", async () => {
    await deliver([
      match("older", "Live", 90 * MINUTE),
      match("newer", "Live", 5 * MINUTE),
    ]);

    expect(current()).toBe("newer");
  });
});

describe("scheduled matches", () => {
  it("joins my matches once kickoff is within the hour, with no new result", async () => {
    await deliver([match("later", "Scheduled", 5 * MINUTE, at(90 * MINUTE))]);
    expect(ids()).toEqual([]);

    vi.advanceTimersByTime(29 * MINUTE);
    expect(ids()).toEqual([]);

    vi.advanceTimersByTime(2 * MINUTE);
    expect(ids()).toEqual(["later"]);
    expect(current()).toBe("later");
  });

  it("hands back the same list while the clock ticks and nothing changes", async () => {
    await deliver([match("live", "Live", 5 * MINUTE)]);
    const before = useMatchLobbyStore().myMatches;

    vi.advanceTimersByTime(5 * MINUTE);

    expect(useMatchLobbyStore().myMatches).toBe(before);
  });
});

describe("role change", () => {
  const organizerBranch = (options: any) =>
    print(options.query).match(/organizer_steam_id[^\n]*/)![0];

  it("asks for my matches again when my role changes", async () => {
    const client = serve();
    const player = { steam_id: STEAM_ID, role: e_player_roles_enum.user };
    vi.spyOn(client, "query").mockResolvedValue({
      data: { me: { steam_id: STEAM_ID, role: player.role, player } },
    } as any);
    useAuthStore().me = undefined;

    await useAuthStore().getMe();

    expect(subscriptionsTo("matches")).toHaveLength(1);
    expect(organizerBranch(subscriptionsTo("matches")[0].options)).not.toMatch(
      /is_in_lineup/,
    );

    const meSubscription = subscriptionsTo("players_by_pk").find(
      ({ options }) => /^\s*role$/m.test(print(options.query)),
    )!;
    meSubscription.observer.next({
      data: {
        players_by_pk: {
          ...player,
          role: e_player_roles_enum.match_organizer,
        },
      },
    });
    await flushPromises();

    expect(subscriptionsTo("matches")).toHaveLength(2);
    expect(organizerBranch(subscriptionsTo("matches")[1].options)).toMatch(
      /is_in_lineup/,
    );
  });
});
