import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import BlockedPlayers from "~/pages/settings/blocked-players.vue";
import { toast, useToast } from "~/components/ui/toast";
import { useAuthStore } from "~/stores/AuthStore";
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

const ME = "76561198000000001";
const DANA = "76561198000000002";
const EVAN = "76561198000000003";

function push(rows: Array<Record<string, any>>) {
  const open = graphql.observers.filter((entry) => !entry.closed);
  expect(open).toHaveLength(1);
  open[0].observer.next({ data: { player_blocks: rows } });
}

function blocked(steamId: string, name: string) {
  return {
    blocked_steam_id: steamId,
    created_at: "2026-09-27T12:00:00Z",
    blocked: {
      steam_id: steamId,
      name,
      avatar_url: null,
      custom_avatar_url: null,
      country: null,
    },
  };
}

let unmount: (() => void) | undefined;

beforeEach(async () => {
  graphql.mutate.mockReset();
  useAuthStore().me = { steam_id: ME, role: "user" } as any;
  await flushPromises();
  toast({ title: "earlier" });
});

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  await flushPromises();
});

async function mountPage() {
  const wrapper = await mountSuspended(BlockedPlayers);
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountPage>>;

const unblockButtons = (wrapper: Wrapper) =>
  wrapper.findAll("button").filter((button) => button.text() === "Unblock");

describe("blocked players settings page", () => {
  it("shows a skeleton until the list arrives, then the empty state", async () => {
    const wrapper = await mountPage();

    expect(wrapper.findAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(wrapper.text()).not.toContain("No blocked players");

    push([]);
    await flushPromises();

    expect(wrapper.findAll(".animate-pulse")).toHaveLength(0);
    expect(wrapper.text()).toContain("No blocked players");
    expect(unblockButtons(wrapper)).toHaveLength(0);
  });

  it("lists every blocked player with an Unblock action", async () => {
    const wrapper = await mountPage();

    push([blocked(DANA, "Dana"), blocked(EVAN, "Evan")]);
    await flushPromises();

    expect(wrapper.text()).toContain("Dana");
    expect(wrapper.text()).toContain("Evan");
    expect(wrapper.text()).toContain("Blocked");
    expect(unblockButtons(wrapper)).toHaveLength(2);
  });

  it("unblocks the row's player and confirms it", async () => {
    graphql.mutate.mockResolvedValue({
      data: { delete_player_blocks: { affected_rows: 1 } },
    });
    const wrapper = await mountPage();
    push([blocked(DANA, "Dana"), blocked(EVAN, "Evan")]);
    await flushPromises();

    await unblockButtons(wrapper)[1].trigger("click");
    await flushPromises();

    expect(graphql.mutate).toHaveBeenCalledTimes(1);
    expect(graphql.mutate).toHaveBeenCalledWith({
      mutation: UNBLOCK_PLAYER_MUTATION,
      variables: { steamId: EVAN },
    });
    expect(useToast().toasts.value[0]?.title).toBe("Evan unblocked");
  });

  it("does not claim success when the unblock is refused", async () => {
    graphql.mutate.mockRejectedValue(new Error("permission denied"));
    const wrapper = await mountPage();
    push([blocked(DANA, "Dana")]);
    await flushPromises();

    await unblockButtons(wrapper)[0].trigger("click");
    await flushPromises();

    expect(useToast().toasts.value[0]?.title).toBe("earlier");
  });
});
