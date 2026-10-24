import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { defineComponent, h } from "vue";
import TournamentMatch from "~/components/tournament/TournamentMatch.vue";
import { TooltipProvider } from "~/components/ui/tooltip";

const PROBLEM_BORDER = "border-red-500/60";

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

function bracket(status: string, winner: string | null) {
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
      options: { best_of: 3 },
      match_maps: [],
    },
  };
}

async function mountCard(status: string, winner: string | null) {
  wrapper = await mountSuspended(
    defineComponent({
      setup: () => () =>
        h(TooltipProvider, null, () =>
          h(TournamentMatch, {
            round: 1,
            brackets: [bracket(status, winner)] as any,
            stage: { type: "SingleElimination", max_teams: 8, groups: 1 },
            tournament: { is_organizer: false, status: "Live" },
          }),
        ),
    }),
  );
  const card = wrapper.find(".tournament-match");
  return { card, header: card.find("div") };
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("tournament match card for a forfeit or surrender", () => {
  it.each(["Forfeit", "Surrendered"])(
    "shows a %s with a winner as a result: a neutral label, no map dots, no problem red",
    async (status) => {
      const { card, header } = await mountCard(status, "l1");

      expect(card.classes()).not.toContain(PROBLEM_BORDER);
      expect(header.find(".text-red-400").exists()).toBe(false);
      expect(header.text()).toContain(status);
      expect(header.findAll("button.rounded-full")).toHaveLength(0);
    },
  );

  it("keeps a surrender without a winner in problem red", async () => {
    const { card, header } = await mountCard("Surrendered", null);

    expect(card.classes()).toContain(PROBLEM_BORDER);
    expect(header.find(".text-red-400").text()).toBe("Surrendered");
    expect(header.findAll("button.rounded-full")).toHaveLength(0);
  });

  it("keeps a forfeit without a winner quiet: no label, no map dots", async () => {
    const { card, header } = await mountCard("Forfeit", null);

    expect(card.classes()).not.toContain(PROBLEM_BORDER);
    expect(header.text()).not.toContain("Forfeit");
    expect(header.findAll("button.rounded-full")).toHaveLength(0);
  });
});
