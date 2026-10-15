import { describe, expect, it } from "vitest";
import {
  isEndedWithResult,
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

  it.each(["Live", "Canceled", "Scheduled"])(
    "has no result for a %s match",
    (status) => {
      expect(teamResult(match(status, null), "alpha")).toBeNull();
    },
  );

  it("puts forfeits and surrenders in a team's form", () => {
    expect(
      teamForm(
        [
          match("Surrendered", "l2"),
          match("Forfeit", "l1"),
          match("Finished", "l1"),
        ],
        "alpha",
      ),
    ).toEqual(["W", "W", "L"]);
  });
});

describe("isEndedWithResult", () => {
  it.each([
    ["Finished", true],
    ["Forfeit", true],
    ["Surrendered", true],
    ["Tie", false],
    ["Canceled", false],
    ["Live", false],
    [null, false],
  ])("%s -> %s", (status, expected) => {
    expect(isEndedWithResult(status)).toBe(expected);
  });
});

describe("resultStatusLabelKey", () => {
  it("labels a forfeit and a surrender, and nothing else", () => {
    expect(resultStatusLabelKey("Forfeit")).toBe("match.stream.card.forfeit");
    expect(resultStatusLabelKey("Surrendered")).toBe(
      "match.stream.card.surrendered",
    );
    expect(resultStatusLabelKey("Finished")).toBeNull();
  });
});
