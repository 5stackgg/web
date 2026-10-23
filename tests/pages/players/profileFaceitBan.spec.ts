import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerPage from "~/pages/players/[id].vue";
import PlayerVacBadge from "~/components/PlayerVacBadge.vue";

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

const TARGET = "76561198000000002";

let unmount: (() => void) | undefined;

async function mountProfile(faceitBannedAt: string | null) {
  const wrapper = await mountSuspended(PlayerPage, {
    shallow: true,
    route: `/players/${TARGET}`,
    global: { renderStubDefaultSlot: true },
  } as any);
  unmount = () => wrapper.unmount();
  const vm = wrapper.vm as any;
  vm.player = { steam_id: TARGET, name: "Dana", role: "user" };
  vm.sanctionsSummary = { ...vm.sanctionsSummary, faceitBannedAt };
  await flushPromises();
  return wrapper;
}

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  await flushPromises();
});

describe("player profile FACEIT ban", () => {
  it("shows the ban shield for a FACEIT ban alone", async () => {
    const wrapper = await mountProfile("2026-10-01T00:00:00Z");

    const badge = wrapper.findComponent(PlayerVacBadge);
    expect(badge.exists()).toBe(true);
    expect(badge.props("player")).toMatchObject({
      steam_id: TARGET,
      faceit_banned_at: "2026-10-01T00:00:00Z",
    });
  });

  it("shows no shield without any ban", async () => {
    const wrapper = await mountProfile(null);

    expect(wrapper.findComponent(PlayerVacBadge).exists()).toBe(false);
  });
});
