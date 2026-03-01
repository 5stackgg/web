import { e_tournament_stage_types_enum } from "~/generated/zeus";
import { getRoundLabel, type TranslatableLabel } from "~/utilities/tournamentRoundLabels";

export interface RoundInfo {
  key: string;
  label: TranslatableLabel;
  path: string;
  round: number;
}

/**
 * Calculate the rounds for a tournament stage based on type and team count.
 * Must match the SQL logic in update_tournament_stages.sql (lines 160-191).
 */
export function calculateRounds(
  stageType: string,
  maxTeams: number,
  groups: number = 1,
): RoundInfo[] {
  const teamsPerGroup = Math.ceil(maxTeams / groups);

  if (stageType === e_tournament_stage_types_enum.SingleElimination) {
    return calculateSERounds(teamsPerGroup);
  }

  if (stageType === e_tournament_stage_types_enum.DoubleElimination) {
    return calculateDERounds(teamsPerGroup);
  }

  if (stageType === e_tournament_stage_types_enum.Swiss) {
    return calculateSwissRounds();
  }

  return [];
}

function calculateSERounds(teamsPerGroup: number): RoundInfo[] {
  const totalRounds = Math.max(
    Math.ceil(Math.log(teamsPerGroup) / Math.log(2)),
    1,
  );
  const rounds: RoundInfo[] = [];

  for (let r = 1; r <= totalRounds; r++) {
    const matchesInRound =
      r === 1
        ? Math.pow(2, totalRounds) / 2
        : Math.pow(2, totalRounds - r);

    rounds.push({
      key: `WB:${r}`,
      label: getRoundLabel(r, 1, true, matchesInRound, false, 'SingleElimination', r === totalRounds),
      path: "WB",
      round: r,
    });
  }

  return rounds;
}

function calculateDERounds(teamsPerGroup: number): RoundInfo[] {
  const W = Math.pow(2, Math.ceil(Math.log(teamsPerGroup) / Math.log(2)));
  const wbRounds = Math.round(Math.log(W) / Math.log(2));
  const lbRounds = wbRounds <= 1 ? 0 : 2 * (wbRounds - 1);
  const rounds: RoundInfo[] = [];

  // WB rounds
  for (let r = 1; r <= wbRounds; r++) {
    const matchesInRound = Math.pow(2, wbRounds - r);

    rounds.push({
      key: `WB:${r}`,
      label: getRoundLabel(r, 1, true, matchesInRound, false, 'DoubleElimination', false),
      path: "WB",
      round: r,
    });
  }

  // LB rounds
  for (let r = 1; r <= lbRounds; r++) {
    rounds.push({
      key: `LB:${r}`,
      label: getRoundLabel(r, 1, true, 0, true, 'DoubleElimination', r === lbRounds),
      path: "LB",
      round: r,
    });
  }

  // Grand Final
  if (wbRounds > 0) {
    rounds.push({
      key: "GF",
      label: getRoundLabel(wbRounds + 1, 1, true, 1, false, 'DoubleElimination', true),
      path: "WB",
      round: wbRounds + 1,
    });
  }

  return rounds;
}

function calculateSwissRounds(): RoundInfo[] {
  // Swiss always has 3 match types
  return [
    {
      key: "regular",
      label: { key: "tournament.round_labels.regular_rounds" },
      path: "WB",
      round: 0,
    },
    {
      key: "advancement",
      label: { key: "tournament.round_labels.advancement_matches" },
      path: "WB",
      round: 0,
    },
    {
      key: "elimination",
      label: { key: "tournament.round_labels.elimination_matches" },
      path: "WB",
      round: 0,
    },
  ];
}
