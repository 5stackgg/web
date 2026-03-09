import { getRoundLabel, getWinnerLabel } from "./tournamentRoundLabels";

describe("getRoundLabel", () => {
  describe("Single Elimination", () => {
    it("returns opening round for round 1", () => {
      const label = getRoundLabel(1, 1, true, 8, false, "SingleElimination");
      expect(label.key).toBe("tournament.round_labels.opening_round");
    });

    it("returns quarter finals for 4 matches", () => {
      const label = getRoundLabel(2, 1, true, 4, false, "SingleElimination");
      expect(label.key).toBe("tournament.round_labels.quarter_finals");
    });

    it("returns semi finals for 2 matches (not last round)", () => {
      const label = getRoundLabel(
        3,
        1,
        true,
        2,
        false,
        "SingleElimination",
        false,
      );
      expect(label.key).toBe("tournament.round_labels.semi_finals");
    });

    it("returns final for 2 matches when last round", () => {
      const label = getRoundLabel(
        3,
        1,
        true,
        2,
        false,
        "SingleElimination",
        true,
      );
      expect(label.key).toBe("tournament.round_labels.final");
    });

    it("returns final for 1 match", () => {
      const label = getRoundLabel(
        4,
        1,
        true,
        1,
        false,
        "SingleElimination",
        true,
      );
      expect(label.key).toBe("tournament.round_labels.final");
    });
  });

  describe("Double Elimination", () => {
    it("returns WB opening round for round 1", () => {
      const label = getRoundLabel(
        1,
        1,
        true,
        8,
        false,
        "DoubleElimination",
        false,
      );
      expect(label.key).toBe("tournament.round_labels.wb_opening_round");
    });

    it("returns WB semi finals for 2 matches", () => {
      const label = getRoundLabel(
        3,
        1,
        true,
        2,
        false,
        "DoubleElimination",
        false,
      );
      expect(label.key).toBe("tournament.round_labels.wb_semi_finals");
    });

    it("returns WB final for 1 match (not last round)", () => {
      const label = getRoundLabel(
        4,
        1,
        true,
        1,
        false,
        "DoubleElimination",
        false,
      );
      expect(label.key).toBe("tournament.round_labels.wb_final");
    });

    it("returns grand final for 1 match when last round", () => {
      const label = getRoundLabel(
        5,
        1,
        true,
        1,
        false,
        "DoubleElimination",
        true,
      );
      expect(label.key).toBe("tournament.round_labels.grand_final");
    });

    it("returns LB round label for loser bracket", () => {
      const label = getRoundLabel(
        2,
        1,
        true,
        0,
        true,
        "DoubleElimination",
        false,
      );
      expect(label.key).toBe("tournament.round_labels.lb_round");
      expect(label.params).toEqual({ number: 2 });
    });

    it("returns LB final for last loser bracket round", () => {
      const label = getRoundLabel(
        4,
        1,
        true,
        0,
        true,
        "DoubleElimination",
        true,
      );
      expect(label.key).toBe("tournament.round_labels.lb_final");
    });
  });

  describe("Swiss and RoundRobin", () => {
    it("returns generic round label for Swiss", () => {
      const label = getRoundLabel(1, 1, true, 4, false, "Swiss");
      expect(label.key).toBe("tournament.round_labels.round");
      expect(label.params).toEqual({ number: 1 });
    });

    it("returns generic round label for RoundRobin", () => {
      const label = getRoundLabel(2, 1, true, 4, false, "RoundRobin");
      expect(label.key).toBe("tournament.round_labels.round");
      expect(label.params).toEqual({ number: 2 });
    });
  });
});

describe("getWinnerLabel", () => {
  it("returns winner label for final stage", () => {
    expect(getWinnerLabel(true).key).toBe("tournament.round_labels.winner");
  });

  it("returns advances label for non-final stage", () => {
    expect(getWinnerLabel(false).key).toBe(
      "tournament.round_labels.advances_to_next_stage",
    );
  });

  it("returns advances label by default", () => {
    expect(getWinnerLabel().key).toBe(
      "tournament.round_labels.advances_to_next_stage",
    );
  });
});
