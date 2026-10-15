import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import StageStandings from "~/components/tournament/StageStandings.vue";
import TournamentResults from "~/components/tournament/TournamentResults.vue";
import { print } from "graphql";

const KAIRO = "76561198000000001";

const stage = {
  groups: 1,
  results: [
    {
      tournament_team_id: "tt-1",
      group_number: 1,
      rank: 1,
      placement: 1,
      wins: 2,
      losses: 0,
      matches_played: 2,
      team: {
        id: "tt-1",
        name: "Northwind",
        team: null,
        roster: [{ player: { steam_id: KAIRO, name: "kairo" } }],
      },
    },
  ],
};

const stats = {
  player_steam_id: KAIRO,
  kills: 40,
  deaths: 20,
  assists: 6,
  headshots: 20,
  kdr: 2,
  headshot_percentage: 50,
  matches_played: 2,
};

async function expandedRoster(playerStats: any[]) {
  const wrapper = await mountSuspended(StageStandings, {
    props: { stage, playerStats },
  });
  await wrapper.find("tbody > tr").trigger("click");
  const table = wrapper.find("tbody table");
  return {
    headers: table.findAll("th").map((th) => th.text()),
    cells: table.findAll("tbody td").map((td) => td.text()),
  };
}

describe("tournament stats ADR", () => {
  it("shows each player's ADR once the api sends it", async () => {
    const { headers, cells } = await expandedRoster([{ ...stats, adr: 87.6 }]);

    expect(headers).toContain("ADR");
    expect(headers.indexOf("ADR")).toBe(headers.indexOf("HS%") - 1);
    expect(cells).toContain("88");
  });

  it("leaves the column out for an api without it", async () => {
    const { headers } = await expandedRoster([stats]);

    expect(headers).not.toContain("ADR");
  });

  it("asks for ADR only from an api that serves it", () => {
    const subscription = (TournamentResults as any).apollo.$subscribe
      .tournamentPlayerStats;
    const fields = (statsHaveAdr: boolean | null) =>
      print(subscription.query.call({ statsHaveAdr }));

    expect(fields(true)).toMatch(/\badr\b/);
    expect(fields(false)).not.toMatch(/\badr\b/);
    expect(
      subscription.skip.call({
        tournament: { id: "t" },
        showStandings: true,
        statsHaveAdr: null,
      }),
    ).toBe(true);
  });
});
