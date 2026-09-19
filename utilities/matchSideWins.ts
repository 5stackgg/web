import { e_sides_enum } from "~/generated/zeus";

export type Side = "CT" | "TERRORIST";

export type SideWinRound = {
  round?: number | null;
  lineup_1_score?: number | null;
  lineup_2_score?: number | null;
  lineup_1_side?: string | null;
  lineup_2_side?: string | null;
  winning_side?: string | null;
};

export type SideWins = { ct: number; t: number };

const EMPTY: SideWins = { ct: 0, t: 0 };

export function normalizeSide(
  value: string | null | undefined,
): Side | null {
  if (value === "CT" || value === e_sides_enum.CT) {
    return "CT";
  }
  if (
    value === "T" ||
    value === "TERRORIST" ||
    value === e_sides_enum.TERRORIST
  ) {
    return "TERRORIST";
  }
  return null;
}

export function oppositeSide(side: Side): Side {
  return side === "CT" ? "TERRORIST" : "CT";
}

function scoreOf(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// Current map sides apply to the half being played now. First half is
// rounds 1..mr; second half flips; CS2 overtime is 3-round halves starting
// on the second-half assignment.
export function sideForRoundNumber(
  roundNumber: number,
  currentSide: Side | null,
  latestRound: number,
  mr: number,
): Side | null {
  if (!currentSide || roundNumber <= 0 || mr <= 0) {
    return null;
  }

  const firstHalfSide =
    latestRound <= mr ? currentSide : oppositeSide(currentSide);

  if (roundNumber <= mr) {
    return firstHalfSide;
  }
  if (roundNumber <= mr * 2) {
    return oppositeSide(firstHalfSide);
  }

  const otIndex = roundNumber - mr * 2;
  const otHalf = Math.ceil(otIndex / 3);
  const secondHalfSide = oppositeSide(firstHalfSide);
  return otHalf % 2 === 1 ? secondHalfSide : firstHalfSide;
}

function lineupSideForRound(
  round: SideWinRound,
  isLineup1: boolean,
  currentSide: Side | null,
  latestRound: number,
  mr: number,
): Side | null {
  const own = normalizeSide(
    isLineup1 ? round.lineup_1_side : round.lineup_2_side,
  );
  if (own) {
    return own;
  }
  const other = normalizeSide(
    isLineup1 ? round.lineup_2_side : round.lineup_1_side,
  );
  if (other) {
    return oppositeSide(other);
  }
  return sideForRoundNumber(round.round ?? 0, currentSide, latestRound, mr);
}

function lineupWonRound(
  round: SideWinRound,
  isLineup1: boolean,
  prev1: number,
  prev2: number,
  lineupSide: Side | null,
): boolean {
  const score1 = scoreOf(round.lineup_1_score);
  const score2 = scoreOf(round.lineup_2_score);
  // Once either score moves, the delta is the source of truth — the game
  // server has been known to report winning_side for the other team.
  if (score1 > prev1 || score2 > prev2) {
    return isLineup1 ? score1 > prev1 : score2 > prev2;
  }
  // Live rows sometimes keep both scores at 0; winning_side is the fallback,
  // after normalizing the "T" alias the game server sends.
  const winning = normalizeSide(round.winning_side);
  return !!(winning && lineupSide && winning === lineupSide);
}

export function matchSideWins(
  rounds: SideWinRound[] | null | undefined,
  isLineup1: boolean,
  options?: {
    currentSide?: string | null;
    mr?: number | null;
  },
): SideWins {
  if (!rounds?.length) {
    return { ...EMPTY };
  }

  const chronological = rounds
    .filter((round) => (round.round ?? 0) > 0)
    .slice()
    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0));

  if (!chronological.length) {
    return { ...EMPTY };
  }

  const mr = options?.mr && options.mr > 0 ? options.mr : 12;
  const currentSide = normalizeSide(options?.currentSide);
  const latestRound = chronological[chronological.length - 1]?.round ?? 0;

  let ct = 0;
  let t = 0;
  let prev1 = 0;
  let prev2 = 0;

  for (const round of chronological) {
    const lineupSide = lineupSideForRound(
      round,
      isLineup1,
      currentSide,
      latestRound,
      mr,
    );
    if (lineupWonRound(round, isLineup1, prev1, prev2, lineupSide)) {
      if (lineupSide === "CT") {
        ct++;
      } else if (lineupSide === "TERRORIST") {
        t++;
      }
    }
    prev1 = scoreOf(round.lineup_1_score);
    prev2 = scoreOf(round.lineup_2_score);
  }

  return { ct, t };
}
