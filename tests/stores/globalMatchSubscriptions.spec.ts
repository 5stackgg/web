import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { print } from "graphql";
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

const STEAM_ID = "76561198000000001";

let documents: Array<string> = [];

// An API that serves active_matches. The answer is cached for the whole file,
// so the matches-only fallback is covered by myMatches.spec.ts.
beforeEach(() => {
  const client = useApollo().clients!.default;
  vi.spyOn(client, "query").mockResolvedValue({
    data: { __type: { fields: [{ name: "active_matches" }] } },
  } as any);
  vi.spyOn(client, "subscribe").mockImplementation(
    (options: any) =>
      ({
        subscribe() {
          documents.push(print(options.query));
          return { unsubscribe() {}, closed: false };
        },
      }) as any,
  );
});

afterEach(() => {
  documents = [];
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

const SUBSCRIPTIONS = {
  "live matches count": () => useMatchLobbyStore().subscribeToLiveMatches(),
  "managing matches count": () =>
    useMatchLobbyStore().subscribeToManagingMatches(),
  "my matches": () => useMatchLobbyStore().subscribeToMyMatches(),
  "my matches as an organizer": async () => {
    useAuthStore().me!.role = e_player_roles_enum.match_organizer;
    await useMatchLobbyStore().subscribeToMyMatches();
  },
};

const settle = () => new Promise((resolve) => setTimeout(resolve));

async function documentFor(name: keyof typeof SUBSCRIPTIONS) {
  useAuthStore().me = {
    steam_id: STEAM_ID,
    role: e_player_roles_enum.user,
  } as any;
  await settle();
  documents = [];
  await SUBSCRIPTIONS[name]();
  await settle();
  const matches = documents.filter((document) =>
    /^\s*matches(_aggregate)?\b/m.test(document),
  );
  expect(matches).toHaveLength(1);
  return matches[0];
}

describe("global match subscriptions", () => {
  it("count live matches by their in-play statuses", async () => {
    expect(await documentFor("live matches count")).toMatch(
      /^\s*matches_aggregate\b.*\(\s*where: \{status: \{_in: \[Live, Veto, WaitingForCheckIn, WaitingForServer\]\}\}\s*\)/m,
    );
  });

  it("count managed matches through picking players", async () => {
    expect(await documentFor("managing matches count")).toMatch(
      /^\s*matches_aggregate\b.*\(\s*where: \{status: \{_in: \[Live, Veto, WaitingForCheckIn, WaitingForServer, Scheduled, PickingPlayers\]\}\}\s*\)/m,
    );
  });

  it.each(Object.keys(SUBSCRIPTIONS) as Array<keyof typeof SUBSCRIPTIONS>)(
    "%s: reads active_matches under the matches key",
    async (name) => {
      expect(await documentFor(name)).toMatch(
        /^\s*(matches(_aggregate)?): active_\1\(/m,
      );
    },
  );
});
