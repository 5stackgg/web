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

// An API from before is_in_another_match was on the friends row.
beforeEach(() => {
  const client = useApollo().clients!.default;
  vi.spyOn(client, "query").mockResolvedValue({
    data: { __type: { fields: [] } },
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

describe("friends list match state from each friend's player", () => {
  it("keeps asking each friend's player until the api has it on the row", async () => {
    useMatchmakingStore();
    useAuthStore().me = {
      steam_id: STEAM_ID,
      role: e_player_roles_enum.user,
    } as any;
    await flushPromises();
    const [{ document, next }] = subscriptions.filter(({ document }) =>
      /^\s*my_friends\b/m.test(document),
    );
    const row = (parse(document).definitions[0] as any).selectionSet
      .selections[0].selectionSet.selections;
    const player = row.find((s: any) => s.name.value === "player");

    expect(row.map((s: any) => s.name.value)).not.toContain(
      "is_in_another_match",
    );
    expect(
      player.selectionSet.selections.map((s: any) => s.name.value),
    ).toContain("is_in_another_match");

    const my_friends = [
      { steam_id: "1", player: { steam_id: "1", is_in_another_match: true } },
    ];
    next({ data: { my_friends } });
    expect(useMatchmakingStore().friends).toEqual(my_friends);
  });
});
