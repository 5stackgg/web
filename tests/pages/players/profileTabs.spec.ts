import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerPage from "~/pages/players/[id].vue";
import PageTabsDock from "~/components/common/PageTabsDock.vue";
import PlayerHighlights from "~/components/clips/PlayerHighlights.vue";
import PlayerTournaments from "~/components/player/PlayerTournaments.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import { Tabs, TabsList } from "~/components/ui/tabs";
import { e_player_roles_enum } from "~/generated/zeus";

// Every count says the player has matches, so the stats tabs show.
const client = vi.hoisted(() => ({
  query: () =>
    Promise.resolve({
      data: { matches_aggregate: { aggregate: { count: 3 } } },
    }),
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

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  await flushPromises();
});

async function mountProfile(query = "") {
  const wrapper = await mountSuspended(PlayerPage, {
    shallow: true,
    route: `/players/${TARGET}${query}`,
    global: { renderStubDefaultSlot: true },
  } as any);
  unmount = () => wrapper.unmount();
  (wrapper.vm as any).player = {
    steam_id: TARGET,
    name: "Dana",
    role: e_player_roles_enum.user,
  };
  // Awards loaded: the tabs no longer wait on the highlights row.
  (wrapper.vm as any).playerAwards = [];
  await flushPromises();
  return wrapper;
}

const filterFold = (wrapper: Awaited<ReturnType<typeof mountProfile>>) =>
  wrapper
    .findAllComponents(Fold)
    .find((fold) => fold.findComponent(AnimatedFilters).exists())!;

describe("player profile tabs", () => {
  it("docks a track of stat tabs under the hero, with no phone dropdown", async () => {
    const wrapper = await mountProfile();

    const dock = wrapper.findComponent(PageTabsDock);
    expect(dock.exists()).toBe(true);
    expect(dock.findComponent(TabsList).props("variant")).toBe("track");
    expect(dock.text()).toContain("Stats Guide");
    expect(wrapper.html()).not.toContain("select-trigger");
  });

  it("puts the highlights below the tab panels and above tournaments", async () => {
    const wrapper = await mountProfile();

    const tabs = wrapper.findComponent(Tabs);
    const highlights = tabs.findComponent(PlayerHighlights);
    expect(highlights.exists()).toBe(true);
    expect(highlights.props("steamId")).toBe(TARGET);
    expect(wrapper.findAllComponents(PlayerHighlights)).toHaveLength(1);

    const html = tabs.html();
    const lastPanel = html.lastIndexOf("tabs-content");
    expect(html.indexOf("player-highlights")).toBeGreaterThan(lastPanel);
    expect(html.indexOf("player-highlights")).toBeLessThan(
      html.indexOf("player-tournaments"),
    );
    expect(tabs.findComponent(PlayerTournaments).exists()).toBe(true);
  });

  it("keeps the filter row on stat tabs and folds it away on Community", async () => {
    expect(filterFold(await mountProfile()).props("open")).toBe(true);
    unmount?.();

    expect(
      filterFold(await mountProfile("?tab=community")).props("open"),
    ).toBe(false);
  });
});
