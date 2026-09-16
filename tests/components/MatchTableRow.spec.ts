import { describe, expect, it, vi } from "vitest";
import { RouterLink } from "vue-router";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchTableRow from "~/components/MatchTableRow.vue";

function finishedMatch() {
  return {
    id: "match-1",
    status: "Finished",
    source: null,
    created_at: "2026-01-01T00:00:00Z",
    started_at: "2026-01-01T00:00:00Z",
    ended_at: "2026-01-01T00:40:00Z",
    lineup_1_id: "lineup-1",
    lineup_2_id: "lineup-2",
    winning_lineup_id: "lineup-1",
    lineup_1: { id: "lineup-1", name: "Alpha", team_id: "team-1" },
    lineup_2: { id: "lineup-2", name: "Pick-up Five", team_id: null },
    lineup_counts: { lineup_1_count: 5, lineup_2_count: 5 },
    max_players_per_lineup: 5,
    options: { best_of: 1, type: "Competitive" },
    match_maps: [],
    streams: [],
    tournament_brackets: [],
  };
}

describe.each([
  { layout: "compact", compact: true },
  { layout: "full", compact: false },
])("MatchTableRow team names ($layout)", ({ compact }) => {
  it("links a lineup with a team to /teams/<id>", async () => {
    const wrapper = await mountSuspended(MatchTableRow, {
      props: { match: finishedMatch(), compact },
    });

    const links = wrapper.findAll('a[href="/teams/team-1"]');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].text()).toBe("Alpha");
    expect(wrapper.find("nuxtlink").exists()).toBe(false);
  });

  it("does not link a lineup without a team", async () => {
    const wrapper = await mountSuspended(MatchTableRow, {
      props: { match: finishedMatch(), compact },
    });

    const pickUp = wrapper
      .findAll("span")
      .find((span) => span.text() === "Pick-up Five");
    expect(pickUp).toBeDefined();
    expect(pickUp!.element.closest("a")).toBeNull();
  });

  it("clicking the team name opens the team, not the match", async () => {
    const router = useRouter();
    const push = vi.spyOn(router, "push").mockResolvedValue(undefined);

    try {
      // mountSuspended swaps in a RouterLink whose navigate() is a no-op.
      const wrapper = await mountSuspended(MatchTableRow, {
        props: { match: finishedMatch(), compact },
        global: { components: { RouterLink } },
      });

      const teamName = wrapper
        .findAll("h3 > *")
        .find((element) => element.text() === "Alpha");
      await teamName!.trigger("click");

      expect(push).toHaveBeenCalledTimes(1);
      expect(router.resolve(push.mock.calls[0][0]).path).toBe("/teams/team-1");
    } finally {
      push.mockRestore();
    }
  });
});
