import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerPage from "~/pages/players/[id].vue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";

const client = vi.hoisted(() => ({
  query: () => Promise.resolve({ data: {} }),
  subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client }),
}));

vi.mock("~/components/ui/sidebar/utils", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSidebar: () => ({ isMobile: ref(false) }),
}));

const ME = "76561198000000001";
const DANA = "76561198000000002";

let unmount: (() => void) | undefined;

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  useMatchmakingStore().friends = [] as any;
  await flushPromises();
});

describe("player profile outgoing friend request", () => {
  it("names the button with the label it shows at rest", async () => {
    useAuthStore().me = { steam_id: ME, name: "Viewer", role: "user" } as any;
    useMatchmakingStore().friends = [
      {
        steam_id: DANA,
        name: "Dana",
        status: "Pending",
        invited_by_steam_id: ME,
      },
    ] as any;

    const wrapper = await mountSuspended(PlayerPage, {
      shallow: true,
      route: `/players/${DANA}`,
      global: { renderStubDefaultSlot: true },
    } as any);
    unmount = () => wrapper.unmount();
    (wrapper.vm as any).player = { steam_id: DANA, name: "Dana" };
    await flushPromises();

    const button = wrapper
      .findAll("button")
      .find((candidate) => candidate.text().includes("Requested"));
    expect(button).toBeDefined();

    const name = button!.attributes("aria-label") ?? "";
    expect(name).toContain("Requested");
    expect(name).toContain("Cancel Request");
  });
});
