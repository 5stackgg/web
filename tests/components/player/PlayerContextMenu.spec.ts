import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerContextMenu from "~/components/player/PlayerContextMenu.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { usePlayerBlocks } from "~/composables/usePlayerBlocks";

const graphql = vi.hoisted(() => ({
  observers: [] as Array<{ observer: any; closed: boolean }>,
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
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

const ME = "76561198000000001";
const DANA = "76561198000000002";

let unmount: (() => void) | undefined;

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

async function openMenu() {
  const wrapper = await mountSuspended(PlayerContextMenu, {
    props: {
      player: { steam_id: DANA, name: "Dana" },
      x: 0,
      y: 0,
      open: true,
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
}

function items() {
  return Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  );
}

const labels = () => items().map((item) => item.textContent?.trim());

beforeEach(async () => {
  useAuthStore().me = {
    steam_id: ME,
    role: "user",
    current_lobby_id: null,
  } as any;
  useMatchmakingStore().friends = [] as any;
  useMatchmakingStore().lobbies = [] as any;
  usePlayerBlocks();
  await flushPromises();
});

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  await flushPromises();
});

describe("PlayerContextMenu blocking", () => {
  it("ends with a destructive Block entry", async () => {
    pushBlocks([]);
    await openMenu();

    expect(labels()).toContain("Invite to Lobby");
    expect(labels()).toContain("Add as friend");

    const last = items().at(-1)!;
    expect(last.textContent?.trim()).toBe("Block");
    expect(last.className).toContain("text-destructive");
    expect(last.querySelector(".lucide-ban")).not.toBeNull();
  });

  it("drops invites and friend requests for a player you blocked", async () => {
    pushBlocks([DANA]);
    await openMenu();

    expect(labels()).not.toContain("Invite to Lobby");
    expect(labels()).not.toContain("Add as friend");
    expect(labels()).not.toContain("Block");

    const last = items().at(-1)!;
    expect(last.textContent?.trim()).toBe("Unblock");
    expect(last.className).not.toContain("text-destructive");
  });

  it("offers no Block entry until the block list has loaded", async () => {
    await openMenu();

    expect(labels()).toContain("Invite to Lobby");
    expect(labels()).not.toContain("Block");
    expect(labels()).not.toContain("Unblock");
  });

  it("confirms before blocking", async () => {
    pushBlocks([]);
    await openMenu();

    items().at(-1)!.click();
    await flushPromises();

    const dialog = document.body.querySelector('[role="alertdialog"]');
    expect(dialog?.textContent).toContain("Block Dana?");
  });
});
