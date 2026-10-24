// @vitest-environment node
import { describe, expect, it } from "vitest";
import { eliminationStandings } from "~/utilities/eliminationStandings";

type Spec = {
  id: string;
  round: number;
  match_number?: number;
  path?: string;
  parent?: string;
  loser?: string;
};

// Brackets wired the way the api serves them: parent and loser links, plus
// the feeds each bracket is filled from.
function bracketTree(specs: Spec[]) {
  const brackets = specs.map((spec) => ({
    id: spec.id,
    round: spec.round,
    match_number: spec.match_number ?? 1,
    path: spec.path ?? "WB",
    bye: false,
    finished: false,
    team_1: null as any,
    team_2: null as any,
    team_1_seed: null as number | null,
    team_2_seed: null as number | null,
    match: null as any,
    parent_bracket: spec.parent ? { id: spec.parent } : null,
    loser_bracket: spec.loser ? { id: spec.loser } : null,
    feeding_brackets: specs
      .filter((other) => other.parent === spec.id || other.loser === spec.id)
      .map((other) => ({
        id: other.id,
        parent_bracket_id: other.parent ?? null,
        loser_parent_bracket_id: other.loser ?? null,
      })),
  }));
  return Object.fromEntries(brackets.map((bracket) => [bracket.id, bracket]));
}

function team(name: string) {
  return { id: `tt-${name}`, name, team_id: null };
}

function seat(bracket: any, a: string, b: string, seeds?: [number, number]) {
  bracket.team_1 = team(a);
  bracket.team_2 = team(b);
  if (seeds) [bracket.team_1_seed, bracket.team_2_seed] = seeds;
}

function play(bracket: any, score: [number, number], status = "Finished") {
  const finished = status === "Finished";
  bracket.match = {
    status,
    lineup_1_id: `${bracket.id}-1`,
    lineup_2_id: `${bracket.id}-2`,
    winning_lineup_id: finished
      ? score[0] > score[1]
        ? `${bracket.id}-1`
        : `${bracket.id}-2`
      : null,
    options: { best_of: 1 },
    match_maps: [{ lineup_1_score: score[0], lineup_2_score: score[1] }],
  };
}

function singleElimination(thirdPlace = false) {
  return bracketTree([
    { id: "qf1", round: 1, match_number: 1, parent: "sf1" },
    { id: "qf2", round: 1, match_number: 2, parent: "sf1" },
    { id: "qf3", round: 1, match_number: 3, parent: "sf2" },
    { id: "qf4", round: 1, match_number: 4, parent: "sf2" },
    {
      id: "sf1",
      round: 2,
      match_number: 1,
      parent: "f",
      loser: thirdPlace ? "third" : undefined,
    },
    {
      id: "sf2",
      round: 2,
      match_number: 2,
      parent: "f",
      loser: thirdPlace ? "third" : undefined,
    },
    { id: "f", round: 3, match_number: 1 },
    ...(thirdPlace ? [{ id: "third", round: 3, match_number: 2 }] : []),
  ]);
}

function playQuarterfinals(tree: any) {
  seat(tree.qf1, "Northside", "Vanta", [1, 8]);
  seat(tree.qf2, "Ember", "Driftwood", [4, 5]);
  seat(tree.qf3, "Halcyon", "Larkspur", [2, 7]);
  seat(tree.qf4, "Kilo", "Quarry", [3, 6]);
  play(tree.qf1, [13, 9]);
  play(tree.qf2, [13, 11]);
  play(tree.qf3, [13, 6]);
  play(tree.qf4, [13, 10]);
  seat(tree.sf1, "Northside", "Ember");
  seat(tree.sf2, "Halcyon", "Kilo");
}

const names = (band: any) => band.entries.map((entry: any) => entry.team.name);

describe("eliminationStandings", () => {
  it("places nobody still playing and shares a round's range", () => {
    const tree = singleElimination();
    playQuarterfinals(tree);
    play(tree.sf1, [9, 7], "Live");

    const standings = eliminationStandings(Object.values(tree));

    expect(standings.total).toBe(8);
    expect(standings.remaining).toBe(4);
    expect(standings.bands).toHaveLength(1);
    expect(standings.bands[0]).toMatchObject({ from: 5, to: 8 });
    expect(names(standings.bands[0])).toEqual([
      "Driftwood",
      "Quarry",
      "Larkspur",
      "Vanta",
    ]);
    expect(standings.bands[0].entries[0]).toMatchObject({
      opponent: { name: "Ember" },
      score: [11, 13],
      won: false,
    });

    expect(standings.games.map((game) => game.bracket.id)).toEqual([
      "sf1",
      "sf2",
    ]);
    expect(standings.games[0]).toMatchObject({
      live: true,
      winnerTo: { id: "f" },
      loserTo: null,
      loserPlace: { from: 3, to: 4 },
    });
    expect(standings.games[0].slots.map((slot) => slot.score)).toEqual([9, 7]);
  });

  it("knows a quarterfinal loser is 5th–8th before the others are played", () => {
    const tree = singleElimination();
    seat(tree.qf1, "Northside", "Vanta");
    play(tree.qf1, [13, 9]);

    const standings = eliminationStandings(Object.values(tree));

    expect(standings.bands[0]).toMatchObject({ from: 5, to: 8 });
    expect(standings.remaining).toBe(7);
  });

  it("fills 1st and 2nd on top once the final is played", () => {
    const tree = singleElimination();
    playQuarterfinals(tree);
    play(tree.sf1, [13, 11]);
    play(tree.sf2, [13, 8]);
    seat(tree.f, "Northside", "Halcyon");
    play(tree.f, [16, 14]);

    const standings = eliminationStandings(Object.values(tree));

    expect(standings.games).toHaveLength(0);
    expect(standings.remaining).toBe(0);
    expect(
      standings.bands.map((band) => [band.from, band.to, names(band)]),
    ).toEqual([
      [1, 1, ["Northside"]],
      [2, 2, ["Halcyon"]],
      [3, 4, ["Kilo", "Ember"]],
      [5, 8, ["Driftwood", "Quarry", "Larkspur", "Vanta"]],
    ]);
    expect(standings.bands[0].entries[0]).toMatchObject({
      won: true,
      opponent: { name: "Halcyon" },
      score: [16, 14],
    });
    expect(standings.bands[0].entries[0].team).toMatchObject({
      wins: 3,
      losses: 0,
    });
  });

  it("splits 3rd and 4th with a third-place match", () => {
    const tree = singleElimination(true);
    playQuarterfinals(tree);
    play(tree.sf1, [13, 11]);
    play(tree.sf2, [13, 8]);

    const midway = eliminationStandings(Object.values(tree));
    // The semifinal losers play on, so they aren't placed yet.
    expect(midway.bands.map((band) => band.from)).toEqual([5]);

    seat(tree.third, "Ember", "Kilo");
    play(tree.third, [13, 5]);
    seat(tree.f, "Northside", "Halcyon");
    play(tree.f, [13, 7]);

    const standings = eliminationStandings(Object.values(tree));
    expect(
      standings.bands.map((band) => [band.from, band.to, names(band)]),
    ).toEqual([
      [1, 1, ["Northside"]],
      [2, 2, ["Halcyon"]],
      [3, 3, ["Ember"]],
      [4, 4, ["Kilo"]],
      [5, 8, ["Driftwood", "Quarry", "Larkspur", "Vanta"]],
    ]);
  });

  it("places double elimination by the lower round a team went out in", () => {
    const tree = bracketTree([
      { id: "w1", round: 1, match_number: 1, parent: "w5", loser: "l1" },
      { id: "w2", round: 1, match_number: 2, parent: "w5", loser: "l1" },
      { id: "w3", round: 1, match_number: 3, parent: "w6", loser: "l2" },
      { id: "w4", round: 1, match_number: 4, parent: "w6", loser: "l2" },
      { id: "w5", round: 2, match_number: 1, parent: "w7", loser: "l4" },
      { id: "w6", round: 2, match_number: 2, parent: "w7", loser: "l3" },
      { id: "w7", round: 3, parent: "gf", loser: "l6" },
      { id: "gf", round: 4 },
      { id: "l1", round: 1, path: "LB", parent: "l3" },
      { id: "l2", round: 1, match_number: 2, path: "LB", parent: "l4" },
      { id: "l3", round: 2, path: "LB", parent: "l5" },
      { id: "l4", round: 2, match_number: 2, path: "LB", parent: "l5" },
      { id: "l5", round: 3, path: "LB", parent: "l6" },
      { id: "l6", round: 4, path: "LB", parent: "gf" },
    ]);
    seat(tree.l1, "Driftwood", "Larkspur");
    play(tree.l1, [16, 14]);
    seat(tree.l2, "Kilo", "Quarry");
    play(tree.l2, [13, 4]);
    seat(tree.l3, "Ember", "Driftwood");
    play(tree.l3, [13, 10]);
    seat(tree.l4, "Vanta", "Kilo");
    play(tree.l4, [7, 13]);
    seat(tree.w7, "Northside", "Halcyon");
    play(tree.w7, [11, 8], "Live");
    seat(tree.l5, "Ember", "Kilo");

    const standings = eliminationStandings(Object.values(tree));

    expect(standings.total).toBe(8);
    expect(standings.remaining).toBe(4);
    expect(
      standings.bands.map((band) => [band.from, band.to, names(band)]),
    ).toEqual([
      [5, 6, ["Driftwood", "Vanta"]],
      [7, 8, ["Larkspur", "Quarry"]],
    ]);
    const [upperFinal, lowerRound3] = standings.games;
    expect(upperFinal).toMatchObject({
      live: true,
      winnerTo: { id: "gf" },
      loserTo: { id: "l6" },
      loserPlace: null,
    });
    expect(lowerRound3).toMatchObject({
      winnerTo: { id: "l6" },
      loserPlace: { from: 4, to: 4 },
    });
  });
});
