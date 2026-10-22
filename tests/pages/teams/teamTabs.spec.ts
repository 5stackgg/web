import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TeamPage from "~/pages/teams/[id].vue";
import PageTabsDock from "~/components/common/PageTabsDock.vue";
import TeamResultsTicker from "~/components/team/TeamResultsTicker.vue";
import TeamOverview from "~/components/team/TeamOverview.vue";
import { TabsContent, TabsList } from "~/components/ui/tabs";

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

let unmount: (() => void) | undefined;

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  await flushPromises();
});

async function mountTeam() {
  const wrapper = await mountSuspended(TeamPage, {
    shallow: true,
    route: "/teams/team-1",
    global: { renderStubDefaultSlot: true },
  } as any);
  unmount = () => wrapper.unmount();
  (wrapper.vm as any).team = {
    id: "team-1",
    name: "Alpha",
    short_name: "ALP",
    owner_steam_id: "1",
    owner: { steam_id: "1" },
    roster: [],
    matches: [],
    scrim_settings: null,
  };
  await flushPromises();
  return wrapper;
}

describe("team page tabs", () => {
  it("docks a track of tabs right under the hero, with no phone dropdown", async () => {
    const wrapper = await mountTeam();

    const dock = wrapper.findComponent(PageTabsDock);
    expect(dock.exists()).toBe(true);
    expect(dock.findComponent(TabsList).props("variant")).toBe("track");
    expect(wrapper.html()).not.toContain("mobile-tab-select");
  });

  it("opens Overview with the results row above the activity and roster", async () => {
    const wrapper = await mountTeam();

    const overview = wrapper
      .findAllComponents(TabsContent)
      .find((panel) => panel.props("value") === "overview")!;
    const ticker = overview.findComponent(TeamResultsTicker);
    expect(ticker.exists()).toBe(true);
    expect(ticker.props("teamId")).toBe("team-1");
    expect(overview.findComponent(TeamOverview).exists()).toBe(true);
    const html = overview.html();
    expect(html.indexOf("team-results-ticker")).toBeLessThan(
      html.indexOf("team-overview"),
    );
    // It no longer sits between the hero and the tabs.
    expect(wrapper.findAllComponents(TeamResultsTicker)).toHaveLength(1);
  });

  it("sends the results row's All matches to the Matches tab", async () => {
    const wrapper = await mountTeam();

    wrapper.findComponent(TeamResultsTicker).vm.$emit("all-matches");
    await flushPromises();
    expect((wrapper.vm as any).tab).toBe("matches");
  });
});
