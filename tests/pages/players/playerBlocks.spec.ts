import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import PlayerPage from "~/pages/players/[id].vue";
import { toast, useToast } from "~/components/ui/toast";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { usePlayerBlocks } from "~/composables/usePlayerBlocks";
import { UNBLOCK_PLAYER_MUTATION } from "~/graphql/playerBlocks";

const graphql = vi.hoisted(() => ({
  mutate: vi.fn(),
  observers: [] as Array<{ observer: any; closed: boolean }>,
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: graphql.mutate,
    subscribe: () => ({
      subscribe(observer: any) {
        const entry = { observer, closed: false };
        graphql.observers.push(entry);
        return {
          unsubscribe() {
            entry.closed = true;
          },
        };
      },
    }),
  }),
}));

mockNuxtImport("useDirectMessages", () => () => ({
  canMessage: () => true,
  openConversation: () => {},
}));

const ME = "76561198000000001";
const DANA = "76561198000000002";

const dana = { steam_id: DANA, name: "Dana" };

function pushBlocks(steamIds: Array<string>) {
  const open = graphql.observers.filter((entry) => !entry.closed);
  expect(open).toHaveLength(1);
  open[0].observer.next({
    data: {
      player_blocks: steamIds.map((steamId) => ({
        blocked_steam_id: steamId,
        created_at: "2026-09-27T12:00:00Z",
        blocked: { steam_id: steamId, name: "Dana", avatar_url: null },
      })),
    },
  });
}

function profile(player: Record<string, any>) {
  const component = PlayerPage as any;
  const context: Record<string, any> = {
    ...component.data.call({ $t: (key: string) => key }),
    player,
    $t: (key: string, values?: Record<string, unknown>) =>
      values?.name ? `${key}:${values.name}` : key,
  };

  for (const [name, definition] of Object.entries<any>(component.computed)) {
    const getter =
      typeof definition === "function" ? definition : definition.get;
    Object.defineProperty(context, name, {
      get: () => getter.call(context),
    });
  }

  for (const [name, method] of Object.entries<any>(component.methods)) {
    context[name] = method.bind(context);
  }

  return context;
}

async function signIn() {
  useAuthStore().me = { steam_id: ME, role: "user" } as any;
  usePlayerBlocks();
  await flushPromises();
}

const actionKeys = (context: Record<string, any>) =>
  context.heroActions.map((action: any) => action.key);

beforeEach(() => {
  graphql.mutate.mockReset();
  useMatchmakingStore().friends = [] as any;
  toast({ title: "earlier" });
});

afterEach(async () => {
  useAuthStore().me = undefined;
  await flushPromises();
});

describe("player profile block gating", () => {
  it("offers nothing to a signed-out visitor", async () => {
    useAuthStore().me = undefined;
    await flushPromises();

    const context = profile(dana);

    expect(context.canBlock).toBe(false);
    expect(context.isBlocked).toBe(false);
    expect(actionKeys(context)).not.toContain("block");
    expect(actionKeys(context)).not.toContain("unblock");
  });

  it("never offers to block yourself", async () => {
    await signIn();
    pushBlocks([]);

    const context = profile({ steam_id: ME, name: "Me" });

    expect(context.canBlock).toBe(false);
    expect(actionKeys(context)).not.toContain("block");
  });

  it("offers Block as a destructive action that only opens the confirm", async () => {
    await signIn();
    pushBlocks([]);

    const context = profile(dana);

    expect(context.isBlocked).toBe(false);
    expect(context.canAddFriend).toBe(true);
    expect(context.canMessage).toBe(true);

    const block = context.heroActions.at(-1);
    expect(block).toMatchObject({
      key: "block",
      label: "player_blocks.block",
      danger: true,
      destructive: true,
    });

    block.run();

    expect(context.blockDialogOpen).toBe(true);
    expect(graphql.mutate).not.toHaveBeenCalled();
  });

  it("swaps friend and message actions for the Blocked badge once blocked", async () => {
    await signIn();
    useMatchmakingStore().friends = [
      { steam_id: DANA, status: "Accepted", invited_by_steam_id: ME },
    ] as any;
    pushBlocks([DANA]);

    const context = profile(dana);

    expect(context.isBlocked).toBe(true);
    expect(context.canAddFriend).toBe(false);
    expect(context.canMessage).toBe(false);
    expect(context.hasRightColumn).toBe(true);
    expect(actionKeys(context)).not.toContain("block");
  });

  it("unblocks straight from the hero action and confirms it", async () => {
    await signIn();
    pushBlocks([DANA]);
    graphql.mutate.mockResolvedValue({
      data: { delete_player_blocks: { affected_rows: 1 } },
    });

    const context = profile(dana);
    const unblock = context.heroActions.at(-1);

    expect(unblock.key).toBe("unblock");
    expect(unblock.destructive).toBeFalsy();

    await unblock.run();

    expect(context.blockDialogOpen).toBe(false);
    expect(graphql.mutate).toHaveBeenCalledWith({
      mutation: UNBLOCK_PLAYER_MUTATION,
      variables: { steamId: DANA },
    });
    expect(useToast().toasts.value[0]?.title).toBe(
      "player_blocks.toasts.unblocked:Dana",
    );
  });
});
