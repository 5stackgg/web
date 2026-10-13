import { e_tournament_stage_types_enum } from "~/generated/zeus";
import { calculateRounds } from "~/utilities/tournamentRoundCalculator";

type BestOf = string | number | null | undefined;

type StageFormat = {
  stageType: string | null | undefined;
  maxTeams: number;
  groups: number;
  swissNoElimination: boolean;
  defaultBestOf: BestOf;
  roundBestOf: Record<string, BestOf>;
};

// The per-round keys the editor offers for a stage type. Round robin has no
// editor, so a key carried over from another type would sit there unseen.
export function stageRoundKeys(
  stageType: string | null | undefined,
  maxTeams: number,
  groups: number,
): string[] {
  if (!stageType || !maxTeams) {
    return [];
  }
  return calculateRounds(stageType, maxTeams, groups || 1).map(
    (round) => round.key,
  );
}

// Mirrors get_bracket_best_of. A round robin plays path WB, so every WB:<n>
// key applies (a league season writes one per week); a no-elimination swiss
// only plays "regular"; the third-place bracket is WB in the final round, and
// decider_best_of is never read.
function readByApi(stage: StageFormat, key: string) {
  switch (stage.stageType) {
    case e_tournament_stage_types_enum.RoundRobin:
      return /^WB:\d+$/.test(key);
    case e_tournament_stage_types_enum.Swiss:
      return stage.swissNoElimination
        ? key === "regular"
        : ["regular", "advancement", "elimination"].includes(key);
    default:
      return stageRoundKeys(
        stage.stageType,
        stage.maxTeams,
        stage.groups,
      ).includes(key);
  }
}

export function stageHighestBestOf(stage: StageFormat): number {
  const values = [Number(stage.defaultBestOf) || 1];

  for (const [key, value] of Object.entries(stage.roundBestOf)) {
    if (Number(value) && readByApi(stage, key)) {
      values.push(Number(value));
    }
  }

  return Math.max(...values);
}

export function stageMapPoolShortfall(
  poolSize: number,
  bestOf: number,
): { bestOf: number; size: number } | null {
  if (poolSize >= bestOf && poolSize > 0) {
    return null;
  }
  return { bestOf, size: poolSize };
}
