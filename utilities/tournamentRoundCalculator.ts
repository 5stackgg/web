import { e_tournament_stage_types_enum } from "~/generated/zeus";

export interface RoundInfo {
  key: string;
  label: string;
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

    let label: string;
    if (matchesInRound === 1) {
      label = "Final";
    } else if (matchesInRound === 2) {
      label = "Semi Finals";
    } else if (matchesInRound === 4) {
      label = "Quarter Finals";
    } else if (r === 1) {
      label = "Opening Round";
    } else {
      label = `Round ${r}`;
    }

    rounds.push({
      key: `WB:${r}`,
      label,
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
    let label: string;
    if (r === wbRounds) {
      label = "WB Final";
    } else if (matchesInRound === 2) {
      label = "WB Semi Finals";
    } else if (matchesInRound === 4) {
      label = "WB Quarter Finals";
    } else if (r === 1) {
      label = "WB Opening Round";
    } else {
      label = `WB Round ${r}`;
    }

    rounds.push({
      key: `WB:${r}`,
      label,
      path: "WB",
      round: r,
    });
  }

  // LB rounds
  for (let r = 1; r <= lbRounds; r++) {
    let label: string;
    if (r === lbRounds) {
      label = "LB Final";
    } else {
      label = `LB Round ${r}`;
    }

    rounds.push({
      key: `LB:${r}`,
      label,
      path: "LB",
      round: r,
    });
  }

  // Grand Final
  if (wbRounds > 0) {
    rounds.push({
      key: "GF",
      label: "Grand Final",
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
      label: "Regular Rounds",
      path: "WB",
      round: 0,
    },
    {
      key: "advancement",
      label: "Advancement Matches",
      path: "WB",
      round: 0,
    },
    {
      key: "elimination",
      label: "Elimination Matches",
      path: "WB",
      round: 0,
    },
  ];
}
