import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import StageStandings from "~/components/tournament/StageStandings.vue";
import TournamentResults from "~/components/tournament/TournamentResults.vue";

function row(id: string, name: string, rank: number, placement = rank) {
  return {
    tournament_team_id: id,
    group_number: 1,
    rank,
    placement,
    wins: 0,
    losses: 0,
    matches_played: 0,
    team: { id, name, team: null, roster: [] },
  };
}

async function standings(results: any[], placements?: any[]) {
  const wrapper = await mountSuspended(StageStandings, {
    props: { stage: { groups: 1, results }, placements },
  });
  return wrapper.findAll("tbody > tr").map((tr) => {
    const [, rank, team] = tr.findAll("td");
    const [ordinal, tied] = rank.findAll("span");
    return [ordinal.text(), team.text(), tied ? tied.text() : ""];
  });
}

describe("StageStandings with the tournament's placements", () => {
  it("orders the top of a finished final like the podium, not the tiebreakers", async () => {
    // The runner-up and the third-place decider's winner both end 1-1, so the
    // tiebreakers can put the decider's winner second.
    const results = [
      row("tt-a", "Alpha", 1),
      row("tt-c", "Charlie", 2),
      row("tt-b", "Bravo", 3),
      row("tt-d", "Delta", 4),
    ];

    expect(
      await standings(results, [
        { placement: 1, tournament_team_id: "tt-a" },
        { placement: 2, tournament_team_id: "tt-b" },
        { placement: 3, tournament_team_id: "tt-c" },
      ]),
    ).toEqual([
      ["1st", "Alpha", ""],
      ["2nd", "Bravo", ""],
      ["3rd", "Charlie", ""],
      ["4th", "Delta", ""],
    ]);
  });

  it("shows both semifinal losers third when there was no decider", async () => {
    const results = [
      row("tt-a", "Alpha", 1),
      row("tt-b", "Bravo", 2),
      row("tt-c", "Charlie", 3),
      row("tt-d", "Delta", 4),
      row("tt-e", "Echo", 5),
    ];

    const rows = await standings(results, [
      { placement: 1, tournament_team_id: "tt-a" },
      { placement: 2, tournament_team_id: "tt-b" },
      { placement: 3, tournament_team_id: "tt-c" },
      { placement: 3, tournament_team_id: "tt-d" },
    ]);

    expect(rows).toEqual([
      ["1st", "Alpha", ""],
      ["2nd", "Bravo", ""],
      ["3rd", "Charlie", "TIED"],
      ["3rd", "Delta", "TIED"],
      ["5th", "Echo", ""],
    ]);
  });

  it("keeps the tiebreakers while there are no placements", async () => {
    const results = [
      row("tt-a", "Alpha", 1),
      row("tt-c", "Charlie", 2),
      row("tt-b", "Bravo", 3),
    ];

    expect(await standings(results)).toEqual([
      ["1st", "Alpha", ""],
      ["2nd", "Charlie", ""],
      ["3rd", "Bravo", ""],
    ]);
  });
});

describe("TournamentResults standings", () => {
  it("orders only the final stage by the placements", async () => {
    const swiss = [
      row("tt-c", "Charlie", 1),
      row("tt-a", "Alpha", 2),
      row("tt-b", "Bravo", 3),
    ];
    const playoff = [
      row("tt-a", "Alpha", 1),
      row("tt-c", "Charlie", 2),
      row("tt-b", "Bravo", 3),
    ];
    const wrapper = await mountSuspended(TournamentResults, {
      props: {
        tournament: {
          id: "tournament-1",
          status: "Finished",
          awards: [],
          stages: [
            { id: "stage-1", order: 1, groups: 1, results: swiss },
            { id: "stage-2", order: 2, groups: 1, results: playoff },
          ],
        },
      },
    });
    (wrapper.vm as any).podiumSteps = [
      { placement: 1, tournament_team_id: "tt-a" },
      { placement: 2, tournament_team_id: "tt-b" },
      { placement: 3, tournament_team_id: "tt-c" },
    ];
    await wrapper.vm.$nextTick();

    const tables = wrapper
      .findAll("table")
      .map((table) =>
        table.findAll("tbody > tr").map((tr) => tr.findAll("td")[2].text()),
      );
    expect(tables).toEqual([
      ["Charlie", "Alpha", "Bravo"],
      ["Alpha", "Bravo", "Charlie"],
    ]);
  });
});
