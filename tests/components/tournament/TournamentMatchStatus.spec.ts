import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { defineComponent, h } from "vue";
import TournamentMatch from "~/components/tournament/TournamentMatch.vue";
import { TooltipProvider } from "~/components/ui/tooltip";

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

function bracket(status: string, bestOf: number, winner: string | null) {
  return {
    id: "bracket-1",
    round: 1,
    match_number: 1,
    group: 1,
    path: "WB",
    bye: false,
    finished: !!winner,
    team_1: { id: "tt-1", name: "Iron Wolves" },
    team_2: { id: "tt-2", name: "Night Owls" },
    feeding_brackets: [],
    parent_bracket: null,
    loser_bracket: null,
    match: {
      id: "match-1",
      status,
      winning_lineup_id: winner,
      lineup_1_id: "l1",
      lineup_2_id: "l2",
      lineup_1: { id: "l1", name: "Iron Wolves" },
      lineup_2: { id: "l2", name: "Night Owls" },
      options: { best_of: bestOf },
      match_maps: [
        { lineup_1_score: 13, lineup_2_score: 8, winning_lineup_id: "l1" },
      ],
    },
  };
}

async function mountHeader(
  status: string,
  bestOf: number,
  winner: string | null = null,
) {
  wrapper = await mountSuspended(
    defineComponent({
      setup: () => () =>
        h(TooltipProvider, null, () =>
          h(TournamentMatch, {
            round: 1,
            brackets: [bracket(status, bestOf, winner)] as any,
            stage: { type: "SingleElimination", max_teams: 8, groups: 1 },
            tournament: { is_organizer: false, status: "Live" },
          }),
        ),
    }),
  );
  return wrapper.find(".tournament-match").find("div");
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("tournament match card header", () => {
  it("says Final once a match is decided, with no map dots", async () => {
    const header = await mountHeader("Finished", 3, "l1");

    expect(header.text()).toContain("Final");
    expect(header.findAll("button.rounded-full")).toHaveLength(0);
  });

  it("shows a live series' maps beside LIVE", async () => {
    const header = await mountHeader("Live", 3);

    expect(header.text()).toContain("Live");
    expect(header.findAll("button.rounded-full")).toHaveLength(3);
  });

  it("leaves a live Bo1 at LIVE", async () => {
    const header = await mountHeader("Live", 1);

    expect(header.text()).toContain("Live");
    expect(header.findAll("button.rounded-full")).toHaveLength(0);
  });
});
