import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchTabs from "~/components/match/MatchTabs.vue";

function finishedMatch() {
  return {
    id: "m-1",
    status: "Finished",
    is_organizer: false,
    is_in_lineup: false,
    is_server_online: false,
    server_id: null,
    server_type: null,
    server_plugin_runtime: null,
    min_players_per_lineup: 5,
    options: { type: "Competitive" },
    match_maps: [
      { id: "map-1", status: "Finished", map: { name: "de_dust2" } },
    ],
    streams: [],
    lineup_1_id: "l-1",
    lineup_2_id: "l-2",
    lineup_1: { id: "l-1", lineup_players: [] },
    lineup_2: { id: "l-2", lineup_players: [] },
  };
}

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

async function mountTabs(route: string) {
  wrapper = await mountSuspended(MatchTabs, {
    route,
    props: { match: finishedMatch() },
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
      stubs: {
        MatchUtilityUtility: true,
        Tooltip: true,
        TooltipProvider: true,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

const routeTab = () => useRouter().currentRoute.value.query.tab;

beforeEach(() => {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  vi.spyOn(client, "subscribe").mockImplementation(() => ({
    subscribe: () => ({ unsubscribe() {}, closed: false }),
  }));
  vi.spyOn(client, "query").mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.restoreAllMocks();
});

describe("match tabs route sync", () => {
  // Picking the Utility tab writes ?tab=utility, which lands here too.
  it("opens the Utility tab from a ?tab=utility link", async () => {
    const tabs = await mountTabs("/?tab=utility");

    expect((tabs.vm as any).activeTab).toBe("utility");
    expect((tabs.vm as any).scoreboardLens).toBe("general");
    expect(routeTab()).toBe("utility");
  });

  it("still folds legacy lens links into the scoreboard", async () => {
    const tabs = await mountTabs("/?tab=aim-stats");

    expect((tabs.vm as any).activeTab).toBe("scoreboard");
    expect((tabs.vm as any).scoreboardLens).toBe("aim");
  });
});
