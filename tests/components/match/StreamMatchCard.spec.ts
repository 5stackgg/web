import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import StreamMatchCard from "~/components/match/StreamMatchCard.vue";

const { subscriptions } = vi.hoisted(() => ({
  subscriptions: [] as Array<(result: any) => void>,
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      subscribe: () => ({
        subscribe: ({ next }: { next: (result: any) => void }) => {
          subscriptions.push(next);
          return { unsubscribe() {} };
        },
      }),
    },
  }),
}));

function liveMatch(map: { name: string; label: string | null }) {
  return {
    id: "match-1",
    status: "Live",
    scheduled_at: null,
    winning_lineup_id: null,
    lineup_1_id: "l1",
    lineup_2_id: "l2",
    options: { best_of: 1, type: "Competitive" },
    lineup_1: { name: "Alpha" },
    lineup_2: { name: "Bravo" },
    tournament_brackets: [],
    match_maps: [
      {
        id: "mm-1",
        status: "Live",
        is_current_map: true,
        lineup_1_score: 4,
        lineup_2_score: 2,
        winning_lineup_id: null,
        map: { ...map, poster: null },
      },
    ],
  };
}

async function mountCard(map: { name: string; label: string | null }) {
  const wrapper = await mountSuspended(StreamMatchCard, {
    props: { matchId: "match-1" },
  });
  for (const next of subscriptions) {
    next({ data: { matches_by_pk: liveMatch(map) } });
  }
  await flushPromises();
  return wrapper;
}

describe("StreamMatchCard map name", () => {
  beforeEach(() => {
    subscriptions.length = 0;
  });

  it("names an official map by its label, never its de_ name", async () => {
    const wrapper = await mountCard({ name: "de_ancient", label: null });

    expect(wrapper.text()).toContain("Ancient");
    expect(wrapper.text()).not.toContain("de_ancient");
  });

  it("keeps a workshop map's own label", async () => {
    const wrapper = await mountCard({ name: "3070923343", label: "Rooftops" });

    expect(wrapper.text()).toContain("Rooftops");
  });
});
