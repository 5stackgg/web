import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse, print } from "graphql";
import { flushPromises } from "@vue/test-utils";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
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

let subscriptions: Array<{ document: string; next: (result: any) => void }> =
  [];

// An API that keeps is_in_another_match on each friends row. The answer is
// cached for the whole file, so the per-player fallback has its own file.
beforeEach(() => {
  const client = useApollo().clients!.default;
  vi.spyOn(client, "query").mockResolvedValue({
    data: { __type: { fields: [{ name: "is_in_another_match" }] } },
  } as any);
  vi.spyOn(client, "subscribe").mockImplementation(
    (options: any) =>
      ({
        subscribe(observer: { next: (result: any) => void }) {
          subscriptions.push({
            document: print(options.query),
            next: observer.next,
          });
          return { unsubscribe() {}, closed: false };
        },
      }) as any,
  );
});

afterEach(() => {
  subscriptions = [];
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

// The friends row's own fields and its player's.
function fields(document: string) {
  const row = (parse(document).definitions[0] as any).selectionSet.selections[0]
    .selectionSet.selections;
  const names = (selections: any[]) => selections.map((s) => s.name.value);
  return {
    row: names(row),
    player: names(
      row.find((s: any) => s.name.value === "player").selectionSet.selections,
    ),
  };
}

async function friendsSubscription() {
  useMatchmakingStore();
  useAuthStore().me = {
    steam_id: STEAM_ID,
    role: e_player_roles_enum.user,
  } as any;
  await flushPromises();
  const found = subscriptions.filter(({ document }) =>
    /^\s*my_friends\b/m.test(document),
  );
  expect(found).toHaveLength(1);
  return found[0];
}

describe("friends list match state from the friends row", () => {
  it("asks each friends row, not each friend's player, whether they are in another match", async () => {
    const { document } = await friendsSubscription();
    const { row, player } = fields(document);

    expect(row).toContain("is_in_another_match");
    expect(player).not.toContain("is_in_another_match");
  });

  it("hands each friend's state on where it was read from before", async () => {
    const { next } = await friendsSubscription();
    next({
      data: {
        my_friends: [
          {
            steam_id: "1",
            is_in_another_match: true,
            player: { steam_id: "1", is_in_lobby: false },
          },
          {
            steam_id: "2",
            is_in_another_match: false,
            player: { steam_id: "2", is_in_lobby: true },
          },
        ],
      },
    });

    expect(
      useMatchmakingStore().friends.map((friend: any) => friend.player),
    ).toEqual([
      { steam_id: "1", is_in_lobby: false, is_in_another_match: true },
      { steam_id: "2", is_in_lobby: true, is_in_another_match: false },
    ]);
  });
});
