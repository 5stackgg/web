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
