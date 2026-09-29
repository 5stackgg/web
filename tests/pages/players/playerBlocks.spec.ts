import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { provideApolloClient } from "@vue/apollo-composable";
import PlayerPage from "~/pages/players/[id].vue";
import BlockPlayerDialog from "~/components/player/BlockPlayerDialog.vue";
import { toast, useToast } from "~/components/ui/toast";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { usePlayerBlocks } from "~/composables/usePlayerBlocks";
import {
  MY_PLAYER_BLOCKS_SUBSCRIPTION,
  UNBLOCK_PLAYER_MUTATION,
} from "~/graphql/playerBlocks";

const graphql = vi.hoisted(() => ({
  mutate: vi.fn(),
  observers: [] as Array<{ query: unknown; observer: any; closed: boolean }>,
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: graphql.mutate,
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

vi.mock("~/components/ui/sidebar/utils", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSidebar: () => ({ isMobile: ref(false) }),
}));

mockNuxtImport("useDirectMessages", () => () => ({
  canMessage: () => true,
  openConversation: () => {},
}));

const ME = "76561198000000001";
const DANA = "76561198000000002";

let unmount: (() => void) | undefined;

function pushBlocks(steamIds: Array<string>) {
  const open = graphql.observers.filter(
    (entry) => !entry.closed && entry.query === MY_PLAYER_BLOCKS_SUBSCRIPTION,
  );
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

async function signIn() {
  useAuthStore().me = { steam_id: ME, role: "user" } as any;
  usePlayerBlocks();
  await flushPromises();
}

async function mountProfile(player: { steam_id: string; name: string }) {
  provideApolloClient((useNuxtApp() as any).$apollo.defaultClient);
  const wrapper = await mountSuspended(PlayerPage, {
    shallow: true,
    route: `/players/${player.steam_id}`,
    global: { renderStubDefaultSlot: true },
  } as any);
  unmount = () => wrapper.unmount();
  (wrapper.vm as any).player = player;
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountProfile>>;

const button = (wrapper: Wrapper, text: string) =>
  wrapper.findAll("button").find((candidate) => candidate.text() === text);

const heroAction = (wrapper: Wrapper, label: string) =>
  wrapper.find(`button[aria-label="${label}"]`);

const dialog = (wrapper: Wrapper) => wrapper.findComponent(BlockPlayerDialog);

beforeEach(() => {
  graphql.mutate.mockReset();
  useMatchmakingStore().friends = [] as any;
  toast({ title: "earlier" });
});

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  await flushPromises();
});

describe("player profile blocking", () => {
  it("offers nothing to a signed-out visitor", async () => {
    const wrapper = await mountProfile({ steam_id: DANA, name: "Dana" });

    expect(heroAction(wrapper, "Block").exists()).toBe(false);
    expect(dialog(wrapper).exists()).toBe(false);
  });

  it("never offers to block yourself", async () => {
    await signIn();
    pushBlocks([]);
    const wrapper = await mountProfile({ steam_id: ME, name: "Me" });

    expect(heroAction(wrapper, "Block").exists()).toBe(false);
    expect(dialog(wrapper).exists()).toBe(false);
  });

  it("waits for the block list before offering to block", async () => {
    await signIn();
    const wrapper = await mountProfile({ steam_id: DANA, name: "Dana" });

    expect(heroAction(wrapper, "Block").exists()).toBe(false);

    pushBlocks([]);
    await flushPromises();

    expect(heroAction(wrapper, "Block").exists()).toBe(true);
  });

  it("opens the confirm from the Block action without blocking yet", async () => {
    await signIn();
    pushBlocks([]);
    const wrapper = await mountProfile({ steam_id: DANA, name: "Dana" });

    expect(button(wrapper, "Add as friend")).toBeDefined();
    expect(button(wrapper, "Message")).toBeDefined();
    expect(dialog(wrapper).props("open")).toBe(false);

    await heroAction(wrapper, "Block").trigger("click");
    await flushPromises();

    expect(dialog(wrapper).props("open")).toBe(true);
    expect(dialog(wrapper).props("player")).toMatchObject({ steam_id: DANA });
    expect(graphql.mutate).not.toHaveBeenCalled();
  });

  it("shows the Blocked badge instead of friend and message actions", async () => {
    await signIn();
    useMatchmakingStore().friends = [
      { steam_id: DANA, status: "Accepted", invited_by_steam_id: ME },
    ] as any;
    pushBlocks([DANA]);
    const wrapper = await mountProfile({ steam_id: DANA, name: "Dana" });

    const badge = wrapper
      .findAll("span")
      .find((span) => span.classes().includes("bg-muted/40"));
    expect(badge?.text()).toBe("Blocked");
    expect(button(wrapper, "Add as friend")).toBeUndefined();
    expect(button(wrapper, "Message")).toBeUndefined();
    expect(wrapper.text()).not.toContain("Friend");
    expect(heroAction(wrapper, "Block").exists()).toBe(false);
  });

  it("unblocks straight from the hero action and confirms it", async () => {
    await signIn();
    pushBlocks([DANA]);
    graphql.mutate.mockResolvedValue({
      data: { delete_player_blocks: { affected_rows: 1 } },
    });
    const wrapper = await mountProfile({ steam_id: DANA, name: "Dana" });

    await heroAction(wrapper, "Unblock").trigger("click");
    await flushPromises();

    expect(dialog(wrapper).props("open")).toBe(false);
    expect(graphql.mutate).toHaveBeenCalledWith({
      mutation: UNBLOCK_PLAYER_MUTATION,
      variables: { steamId: DANA },
    });
    expect(useToast().toasts.value[0]?.title).toBe("Dana unblocked");
  });
});
