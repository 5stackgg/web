import { describe, expect, it } from "vitest";
import {
  tournamentEloLadder,
  tournamentPlayerElo,
} from "~/utilities/tournamentElo";

describe("tournamentEloLadder", () => {
  it("rates a 2-per-lineup format on Wingman", () => {
    expect(tournamentEloLadder({ min_players_per_lineup: 2 })).toBe("Wingman");
  });

  it("rates a 3-per-lineup format on Rush", () => {
    expect(tournamentEloLadder({ min_players_per_lineup: 3 })).toBe("Rush");
  });

  it("rates everything else on Competitive", () => {
    expect(tournamentEloLadder({ min_players_per_lineup: 5 })).toBe(
      "Competitive",
    );
    expect(tournamentEloLadder(null)).toBe("Competitive");
  });

  it("falls back to the lineup maximum when there is no minimum", () => {
    expect(tournamentEloLadder({ max_players_per_lineup: "3" })).toBe("Rush");
  });
});

describe("tournamentPlayerElo", () => {
  it("reads the Rush ladder for a 3-per-lineup tournament", () => {
    expect(
      tournamentPlayerElo(
        { min_players_per_lineup: 3 },
        { elo: { competitive: 5000, rush: 4200 } },
      ),
    ).toBe(4200);
  });

  it("is null when the player has no rating on that ladder", () => {
    expect(
      tournamentPlayerElo(
        { min_players_per_lineup: 3 },
        { elo: { competitive: 5000 } },
      ),
    ).toBeNull();
  });
});
