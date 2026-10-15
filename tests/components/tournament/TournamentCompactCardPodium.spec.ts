import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentCompactCard from "~/components/tournament/TournamentCompactCard.vue";

function standing(rank: number, name: string) {
  return { rank, team: { name: null, team: { name, short_name: null } } };
}

describe("TournamentCompactCard podium", () => {
  it("reads the champion off the standings when only a lower place was granted", async () => {
    const wrapper = await mountSuspended(TournamentCompactCard, {
      props: {
        statusVariant: "finished",
        tournament: {
          id: "tournament-1",
          name: "Copa",
          awards: [
            {
              id: "bronze-1",
              placement: 3,
              tournament_team_id: "tt-3",
              award: { id: "bronze", name: "Third", tier: "bronze" },
              tournament_team: {
                id: "tt-3",
                name: null,
                team: { name: "Brazino69", short_name: null },
              },
            },
          ],
          stages: [
            {
              order: 1,
              type: "SingleElimination",
              results: [standing(1, "100FOFOCA"), standing(2, "SOCAFOFO")],
            },
          ],
        },
      },
    });

    expect(wrapper.text()).toContain("100FOFOCA");
    expect(wrapper.text()).toContain("Brazino69");
  });
});

describe("TournamentCompactCard podium from the placements", () => {
  const placement = (n: number, name: string) => ({
    placement: n,
    tournament_team_id: `tt-${name}`,
    name,
  });

  async function card(tournament: Record<string, unknown>) {
    const wrapper = await mountSuspended(TournamentCompactCard, {
      props: {
        statusVariant: "finished",
        tournament: {
          id: "tournament-1",
          name: "Copa",
          awards_enabled: false,
          awards: [],
          ...tournament,
        },
      },
    });
    return wrapper.findAll(".space-y-1 > div").map((row) =>
      row
        .findAll("span")
        .map((span) => span.text())
        .join(" "),
    );
  }

  it("names 2nd and 3rd the way the podium does, not by the standings' tiebreakers", async () => {
    const runnerUps = await card({
      podium: [
        placement(1, "Alpha"),
        placement(2, "Bravo"),
        placement(3, "Charlie"),
      ],
      stages: [
        {
          order: 1,
          type: "SingleElimination",
          results: [
            standing(1, "Alpha"),
            standing(2, "Charlie"),
            standing(3, "Bravo"),
          ],
        },
      ],
    });

    expect(runnerUps).toEqual(["2nd Bravo", "3rd Charlie"]);
  });

  it("shows both semifinal losers on a shared third", async () => {
    const runnerUps = await card({
      podium: [
        placement(1, "Alpha"),
        placement(2, "Bravo"),
        placement(3, "Charlie"),
        placement(3, "Delta"),
      ],
      stages: [],
    });

    expect(runnerUps).toEqual(["2nd Bravo", "3rd Charlie · Delta"]);
  });
});
