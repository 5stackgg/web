import {
  e_map_pool_types_enum,
  e_tournament_stage_types_enum,
} from "~/generated/zeus";
import { calculateRounds } from "~/utilities/tournamentRoundCalculator";

export type StageMapPoolMode = "tournament" | "seeded" | "custom";

type BestOf = string | number | null | undefined;

// Seeded pools are typed by match type and every hand-picked pool is Custom,
// so the stage's pool says what it is before the seeded pools have loaded.
export function stageMapPoolMode(
  stagePool: { id: string; type?: string | null } | null | undefined,
  tournamentPoolId: string | null | undefined,
): StageMapPoolMode {
  if (!stagePool || stagePool.id === tournamentPoolId) {
    return "tournament";
  }
  if (stagePool.type && stagePool.type !== e_map_pool_types_enum.Custom) {
    return "seeded";
  }
  return "custom";
}

// Per-round overrides only count for rounds the stage has now: the config UI
// keeps keys for rounds a smaller bracket dropped, and the api never asks for
// them.
export function stageHighestBestOf(stage: {
  stageType: string | null | undefined;
  maxTeams: number;
  groups: number;
  defaultBestOf: BestOf;
  thirdPlaceMatch: boolean;
  deciderBestOf: BestOf;
  roundBestOf: Record<string, BestOf>;
}): number {
  const values = [Number(stage.defaultBestOf) || 1];

  if (
    stage.thirdPlaceMatch &&
    stage.stageType === e_tournament_stage_types_enum.SingleElimination
  ) {
    values.push(Number(stage.deciderBestOf ?? stage.defaultBestOf) || 1);
  }

  if (stage.stageType && stage.maxTeams) {
    for (const round of calculateRounds(
      stage.stageType,
      stage.maxTeams,
      stage.groups || 1,
    )) {
      const value = Number(stage.roundBestOf[round.key]);
      if (value) {
        values.push(value);
      }
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
