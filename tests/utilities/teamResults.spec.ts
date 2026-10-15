import { describe, expect, it } from "vitest";
import { print } from "graphql";
import { generateQuery } from "~/graphql/graphqlGen";
import {
  isEndedWithResult,
  RESULT_MATCHES_WHERE,
  resultStatusLabelKey,
  teamForm,
  teamResult,
} from "~/utilities/teamResults";

function match(status: string, winner: string | null) {
  return {
    id: `${status}-${winner}`,
    status,
    winning_lineup_id: winner,
    lineup_1_id: "l1",
    lineup_2_id: "l2",
    lineup_1: { id: "l1", team_id: "alpha" },
    lineup_2: { id: "l2", team_id: "bravo" },
  };
}

describe("teamResult", () => {
  it.each(["Forfeit", "Surrendered"])(
    "reads a %s with a winner as a win and a loss",
    (status) => {
      expect(teamResult(match(status, "l1"), "alpha")).toBe("W");
      expect(teamResult(match(status, "l1"), "bravo")).toBe("L");
    },
  );

  it.each(["Forfeit", "Surrendered"])(
    "has no result, not a draw, for a %s without a winner",
    (status) => {
      expect(teamResult(match(status, null), "alpha")).toBeNull();
    },
  );

  it("reads a finished match without a winner as a draw", () => {
    expect(teamResult(match("Finished", null), "alpha")).toBe("T");
  });

  it.each(["Live", "Canceled", "Scheduled"])(
    "has no result for a %s match",
    (status) => {
      expect(teamResult(match(status, null), "alpha")).toBeNull();
    },
  );

  it("puts decided forfeits and surrenders in a team's form, and no others", () => {
    expect(
      teamForm(
        [
          match("Forfeit", null),
          match("Surrendered", "l2"),
          match("Forfeit", "l1"),
          match("Surrendered", null),
          match("Finished", "l1"),
        ],
        "alpha",
      ),
    ).toEqual(["W", "W", "L"]);
  });
});

describe("isEndedWithResult", () => {
  it.each([
    ["Finished", "l1", true],
    ["Finished", null, true],
    ["Forfeit", "l1", true],
    ["Surrendered", "l2", true],
    ["Forfeit", null, false],
    ["Surrendered", null, false],
    ["Tie", null, false],
    ["Canceled", null, false],
    ["Live", null, false],
  ])("%s won by %s -> %s", (status, winner, expected) => {
    expect(isEndedWithResult(match(status, winner))).toBe(expected);
  });

  it("has no result without a match", () => {
    expect(isEndedWithResult(null)).toBe(false);
    expect(isEndedWithResult(undefined)).toBe(false);
  });
});

describe("resultStatusLabelKey", () => {
  it("labels a decided forfeit and surrender, and nothing else", () => {
    expect(resultStatusLabelKey(match("Forfeit", "l1"))).toBe(
      "match.stream.card.forfeit",
    );
    expect(resultStatusLabelKey(match("Surrendered", "l2"))).toBe(
      "match.stream.card.surrendered",
    );
    expect(resultStatusLabelKey(match("Forfeit", null))).toBeNull();
    expect(resultStatusLabelKey(match("Surrendered", null))).toBeNull();
    expect(resultStatusLabelKey(match("Finished", "l1"))).toBeNull();
  });
});

describe("RESULT_MATCHES_WHERE", () => {
  it("takes finished matches, and forfeits and surrenders only with a winner", () => {
    const query = print(
      generateQuery({
        matches: [{ where: RESULT_MATCHES_WHERE }, { id: true }],
      } as any),
    );

    expect(query).toContain(
      "_or: [{status: {_eq: Finished}}, {status: {_in: [Forfeit, Surrendered]}, winning_lineup_id: {_is_null: false}}]",
    );
  });
});
