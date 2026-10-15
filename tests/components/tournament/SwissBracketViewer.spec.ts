import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import SwissBracketViewer from "~/components/tournament/SwissBracketViewer.vue";

const team = (id: string, name: string) => ({ id, team: { name } });

function bracket(
  round: number,
  group: number,
  opponent: ReturnType<typeof team>,
  status: string,
) {
  return {
    id: `r${round}`,
    round,
    group,
    match_number: round,
    team_1: team("alpha", "Alpha"),
    team_2: opponent,
    match: {
      id: `m${round}`,
      status,
      lineup_1_id: `a${round}`,
      lineup_2_id: `o${round}`,
      winning_lineup_id: `a${round}`,
    },
  };
}

describe("SwissBracketViewer records", () => {
  it.each(["Forfeit", "Surrendered"])(
    "counts a %s win toward advancing",
    async (status) => {
      const wrapper = await mountSuspended(SwissBracketViewer, {
        props: {
          tournament: { id: "t1" },
          stage: {
            id: "s1",
            brackets: [
              bracket(1, 0, team("bravo", "Bravo"), "Finished"),
              bracket(2, 100, team("charlie", "Charlie"), "Finished"),
              bracket(3, 200, team("delta", "Delta"), status),
            ],
          },
        },
        global: { stubs: { TournamentMatch: true } },
      });

      const advanced = wrapper
        .findAll(".text-green-300")
        .map((name) => name.text());
      expect(advanced).toContain("Alpha");
    },
  );
});
