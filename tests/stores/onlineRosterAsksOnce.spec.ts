import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { print } from "graphql";
import { flushPromises } from "@vue/test-utils";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";

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

const ALPHA = "76561198000000101";
const BRAVO = "76561198000000102";
const CHARLIE = "76561198000000103";
const UNKNOWN = "76561198000000199";
const DELTA = "76561198000000104";
const ECHO = "76561198000000105";
const KNOWN = new Set([ALPHA, BRAVO, CHARLIE, DELTA, ECHO]);
let failNextPlayers = false;

let asked: Array<{ kind: "players" | "message_requests"; ids: string[] }> = [];

beforeEach(() => {
  const client = useApollo().clients!.default;
  vi.spyOn(client, "query").mockImplementation((async (options: any) => {
    const document = print(options.query);
    if (/allow_message_requests/.test(document)) {
      asked.push({
        kind: "message_requests",
        ids: options.variables.steamIds.map(String),
      });
      return { data: { players: [] } };
    }
    if (options.variables?.steam_ids) {
      const ids = options.variables.steam_ids.map(String);
      if (failNextPlayers) {
        failNextPlayers = false;
        throw new Error("offline");
      }
      asked.push({ kind: "players", ids });
      return {
        data: {
          players: ids
            .filter((id: string) => KNOWN.has(id))
            .map((steam_id: string) => ({ steam_id, name: steam_id })),
        },
      };
    }
    return { data: { __type: { fields: [] } } };
  }) as any);
});

afterEach(() => {
  asked = [];
  vi.restoreAllMocks();
});

async function roster(
  store: ReturnType<typeof useMatchmakingStore>,
  ids: string[],
) {
  store.onlinePlayerSteamIds = ids;
  await new Promise((resolve) => setTimeout(resolve, 300));
  await flushPromises();
}

describe("the online roster", () => {
  it("asks about each player once, however often the roster is broadcast", async () => {
    const store = useMatchmakingStore();

    await roster(store, [ALPHA, BRAVO, UNKNOWN]);
    await roster(store, [UNKNOWN, BRAVO, ALPHA]);
    await roster(store, [ALPHA, UNKNOWN]);
    await roster(store, [ALPHA, BRAVO, UNKNOWN]);
    await roster(store, [ALPHA, BRAVO, UNKNOWN, CHARLIE]);

    expect(asked.filter((a) => a.kind === "players")).toEqual([
      { kind: "players", ids: [ALPHA, BRAVO, UNKNOWN] },
      { kind: "players", ids: [CHARLIE] },
    ]);
    expect(asked.filter((a) => a.kind === "message_requests")).toHaveLength(2);
    expect(store.playersOnline.map((p: any) => p.steam_id)).toEqual([
      ALPHA,
      BRAVO,
      CHARLIE,
    ]);
  });

  it("asks again for players whose lookup failed", async () => {
    const store = useMatchmakingStore();
    failNextPlayers = true;
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    await roster(store, [DELTA]);
    await roster(store, [DELTA, ECHO]);
    process.off("unhandledRejection", unhandled);

    expect(asked.filter((a) => a.kind === "players")).toEqual([
      { kind: "players", ids: [DELTA, ECHO] },
    ]);
  });
});
