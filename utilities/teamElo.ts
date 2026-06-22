type RosterPlayer = {
  player?: {
    elo?: Record<string, number> | null;
    premier_rank?: number | null;
  } | null;
};

const average = (values: number[]): number | null =>
  values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;

// Average 5Stack ELO across a roster (defaults to the competitive ladder).
export function teamAvgElo(
  roster: RosterPlayer[],
  key = "competitive",
): number | null {
  return average(
    roster
      .map((entry) => entry.player?.elo?.[key])
      .filter((value): value is number => typeof value === "number" && value > 0),
  );
}

// Average CS2 Premier rating across a roster.
export function teamAvgPremier(roster: RosterPlayer[]): number | null {
  return average(
    roster
      .map((entry) => entry.player?.premier_rank)
      .filter((value): value is number => typeof value === "number" && value > 0),
  );
}
