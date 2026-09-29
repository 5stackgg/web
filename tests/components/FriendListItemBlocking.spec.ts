import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import FriendListItem from "~/components/matchmaking-lobby/FriendListItem.vue";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { usePlayerBlocks } from "~/composables/usePlayerBlocks";
import { MY_PLAYER_BLOCKS_SUBSCRIPTION } from "~/graphql/playerBlocks";

const graphql = vi.hoisted(() => ({
  observers: [] as Array<{ query: unknown; observer: any; closed: boolean }>,
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
    subscribe: (options: { query: unknown }) => ({
      subscribe(observer: any) {
        const entry = { query: options.query, observer, closed: false };
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

const ME = "76561198000000001";
const DANA = "76561198000000002";

let unmount: (() => void) | undefined;

function pushBlocks() {
  const open = graphql.observers.filter(
    (entry) => !entry.closed && entry.query === MY_PLAYER_BLOCKS_SUBSCRIPTION,
  );
  expect(open).toHaveLength(1);
  open[0].observer.next({ data: { player_blocks: [] } });
}

async function openRowMenu() {
  const wrapper = await mountSuspended(
    defineComponent({
      setup: () => () =>
        h(TooltipProvider, null, () =>
          h(FriendListItem, {
            player: { steam_id: DANA, name: "Dana", avatar_url: null },
          }),
        ),
    }),
  );
  unmount = () => wrapper.unmount();
  await flushPromises();

  await wrapper.find("[data-state]").trigger("contextmenu");
  await flushPromises();

  return wrapper;
}

function menuItem(label: string) {
  return Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).find((item) => item.textContent?.trim() === label);
}

beforeEach(async () => {
  useAuthStore().me = { steam_id: ME, current_lobby_id: null } as any;
  const matchmaking = useMatchmakingStore();
  matchmaking.friends = [
    { steam_id: DANA, status: "Pending", invited_by_steam_id: DANA },
  ] as any;
  matchmaking.lobbies = [];
  usePlayerBlocks();
  await flushPromises();
});

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  await flushPromises();
});

describe("FriendListItem blocking", () => {
  it("lets you block the sender of an incoming request from the row menu", async () => {
    pushBlocks();
    await openRowMenu();

    const block = menuItem("Block");
    expect(block).toBeDefined();
    expect(block!.className).toContain("text-destructive");

    block!.click();
    await flushPromises();

    const dialog = document.body.querySelector('[role="alertdialog"]');
    expect(dialog?.textContent).toContain("Block Dana?");
  });

  it("has no Block entry before the block list has loaded", async () => {
    await openRowMenu();

    expect(menuItem("Block")).toBeUndefined();
  });
});
