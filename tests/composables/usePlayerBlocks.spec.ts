import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { useAuthStore } from "~/stores/AuthStore";
import { usePlayerBlocks } from "~/composables/usePlayerBlocks";
import {
  BLOCK_PLAYER_MUTATION,
  MY_PLAYER_BLOCKS_SUBSCRIPTION,
  UNBLOCK_PLAYER_MUTATION,
} from "~/graphql/playerBlocks";

type Observer = {
  next: (value: { data: any }) => void;
  error: (error: unknown) => void;
};

const graphql = vi.hoisted(() => ({
  mutate: vi.fn(),
  subscribe: vi.fn(),
  observers: [] as Array<{ options: any; observer: any; closed: boolean }>,
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({ mutate: graphql.mutate, subscribe: graphql.subscribe }),
}));

const ME = "76561198000000001";
const DANA = "76561198000000002";
const EVAN = "76561198000000003";

function row(steamId: string, name: string) {
  return {
    blocked_steam_id: steamId,
    created_at: "2026-09-27T12:00:00Z",
    blocked: { steam_id: steamId, name, avatar_url: null },
  };
}

function live(): Observer {
  const open = graphql.observers.filter((entry) => !entry.closed);
  expect(open).toHaveLength(1);
  return open[0].observer;
}

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function signIn() {
  useAuthStore().me = { steam_id: ME } as any;
  usePlayerBlocks();
  await flushPromises();
}

beforeEach(() => {
  graphql.observers.length = 0;
  graphql.mutate.mockReset();
  graphql.subscribe.mockReset();
  graphql.subscribe.mockImplementation((options: any) => ({
    subscribe(observer: any) {
      const entry = { options, observer, closed: false };
      graphql.observers.push(entry);
      return {
        unsubscribe() {
          entry.closed = true;
        },
      };
    },
  }));
});

afterEach(async () => {
  useAuthStore().me = undefined;
  await flushPromises();
});

describe("usePlayerBlocks", () => {
  it("subscribes to the viewer's own blocks once they sign in, as an optional document", async () => {
    await signIn();

    expect(graphql.subscribe).toHaveBeenCalledTimes(1);
    const [options] = graphql.subscribe.mock.calls[0];
    expect(options.query).toBe(MY_PLAYER_BLOCKS_SUBSCRIPTION);
    expect(options.context).toEqual({ optional: true });
  });

  it("answers isBlocked from the live list, comparing steam ids as strings", async () => {
    await signIn();
    const blocks = usePlayerBlocks();

    expect(blocks.loaded.value).toBe(false);

    live().next({ data: { player_blocks: [row(DANA, "Dana")] } });

    expect(blocks.loaded.value).toBe(true);
    const ids = blocks.blocks.value.map((entry) => entry.blocked_steam_id);
    expect(ids).toEqual([DANA]);
    expect(blocks.isBlocked(DANA)).toBe(true);
    expect(blocks.isBlocked(BigInt(DANA))).toBe(true);
    expect(blocks.isBlocked(EVAN)).toBe(false);
    expect(blocks.isBlocked(null)).toBe(false);
    expect(blocks.isBlocked(undefined)).toBe(false);

    live().next({ data: { player_blocks: [] } });

    expect(blocks.isBlocked(DANA)).toBe(false);
  });

  it("offers blocking only once the list has arrived", async () => {
    await signIn();
    const blocks = usePlayerBlocks();

    expect(blocks.available.value).toBe(false);

    live().next({ data: { player_blocks: [] } });

    expect(blocks.available.value).toBe(true);
  });

  it("reads an api without the table as nobody blocked and nothing to offer", async () => {
    await signIn();
    const blocks = usePlayerBlocks();

    live().error(new Error("field 'player_blocks' not found"));

    expect(blocks.loaded.value).toBe(true);
    expect(blocks.available.value).toBe(false);
    expect(blocks.blocks.value).toEqual([]);
  });

  it("keeps the last list when the stream dies after delivering", async () => {
    await signIn();
    const blocks = usePlayerBlocks();
    live().next({ data: { player_blocks: [row(DANA, "Dana")] } });

    live().error(new Error("socket closed"));

    expect(blocks.isBlocked(DANA)).toBe(true);
    expect(blocks.available.value).toBe(true);
  });

  it("drops the list and the subscription when the viewer signs out", async () => {
    await signIn();
    const blocks = usePlayerBlocks();
    live().next({ data: { player_blocks: [row(DANA, "Dana")] } });

    useAuthStore().me = undefined;
    await flushPromises();

    expect(graphql.observers.every((entry) => entry.closed)).toBe(true);
    expect(blocks.isBlocked(DANA)).toBe(false);
    expect(blocks.available.value).toBe(false);
  });

  it("blocks by steam id and holds a second call while the first is in flight", async () => {
    await signIn();
    const { block, isBusy } = usePlayerBlocks();
    const request = deferred();
    graphql.mutate.mockReturnValue(request.promise);

    const first = block(DANA);
    const second = block(DANA);

    expect(second).toBe(first);
    expect(graphql.mutate).toHaveBeenCalledTimes(1);
    expect(graphql.mutate).toHaveBeenCalledWith({
      mutation: BLOCK_PLAYER_MUTATION,
      variables: { steamId: DANA },
    });
    expect(isBusy(DANA)).toBe(true);
    expect(isBusy(EVAN)).toBe(false);

    request.resolve({ data: { insert_player_blocks_one: null } });
    await expect(first).resolves.toBeUndefined();

    expect(isBusy(DANA)).toBe(false);
  });

  it("unblocks through the delete mutation", async () => {
    await signIn();
    const { unblock } = usePlayerBlocks();
    graphql.mutate.mockResolvedValue({
      data: { delete_player_blocks: { affected_rows: 1 } },
    });

    await unblock(BigInt(DANA));

    expect(graphql.mutate).toHaveBeenCalledWith({
      mutation: UNBLOCK_PLAYER_MUTATION,
      variables: { steamId: DANA },
    });
  });

  it("rejects a refused request and lets the next attempt through", async () => {
    await signIn();
    const { block, isBusy } = usePlayerBlocks();
    graphql.mutate.mockRejectedValueOnce(new Error("player_blocked"));

    await expect(block(DANA)).rejects.toThrow("player_blocked");
    expect(isBusy(DANA)).toBe(false);

    graphql.mutate.mockResolvedValueOnce({ data: {} });
    await block(DANA);

    expect(graphql.mutate).toHaveBeenCalledTimes(2);
  });
});
