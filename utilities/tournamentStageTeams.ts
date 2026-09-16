// Mirrors the team-count rules of the api's validate_tournament_stage and the
// groups check in taiu_tournament_stages; change them together. The form is
// only stricter where the database accepts a degenerate count: elimination
// stages under 4 (except a final after a ranked stage) and Swiss outside 10-64
// or odd.
import { e_tournament_stage_types_enum } from "~/generated/zeus";

const MAX_TEAMS = 256;

export interface AdjacentStage {
  type: string;
  max_teams: number;
  min_teams?: number | null;
  groups?: number | null;
  swiss_no_elimination?: boolean | null;
  brackets?: Array<{ round: number }> | null;
}

export interface StageTeamLimits {
  min: number;
  max: number;
  step: number;
  maxTeamsFloor: number;
}

export function ranksWholeField(stage?: AdjacentStage | null): boolean {
  if (!stage) {
    return false;
  }
  return (
    stage.type === e_tournament_stage_types_enum.RoundRobin ||
    (stage.type === e_tournament_stage_types_enum.Swiss &&
      !!stage.swiss_no_elimination)
  );
}

export function advancingTeams(stage?: AdjacentStage | null): number | null {
  if (!stage) {
    return null;
  }
  if (ranksWholeField(stage)) {
    return stage.max_teams;
  }
  // A Valve Swiss advances only its 3-0, 3-1 and 3-2 teams: half the field,
  // rounded up because an odd field's bye is a free win.
  if (stage.type === e_tournament_stage_types_enum.Swiss) {
    return Math.ceil(stage.max_teams / 2);
  }
  return null;
}

// An elimination stage sends on one team per match in its current last round,
// or, before it has brackets, half of its per-group minimum.
export function lastRoundTeams(stage?: AdjacentStage | null): number {
  if (!stage || advancingTeams(stage) !== null) {
    return 0;
  }
  const rounds = (stage.brackets ?? []).map((bracket) => bracket.round);
  if (rounds.length > 0) {
    const lastRound = Math.max(...rounds);
    return rounds.filter((round) => round === lastRound).length;
  }
  if (!stage.groups || stage.min_teams == null) {
    return 0;
  }
  return Math.floor(Math.floor(stage.min_teams / stage.groups) / 2);
}

export function stageTeamLimits({
  type,
  order,
  groups,
  swissNoElimination = false,
  previousStage,
  nextStage,
}: {
  type: string;
  order: number;
  groups: number | string;
  swissNoElimination?: boolean;
  previousStage?: AdjacentStage | null;
  nextStage?: AdjacentStage | null;
}): StageTeamLimits {
  const groupCount = Math.max(1, Math.floor(Number(groups)) || 1);
  const previousAdvancing = advancingTeams(previousStage);
  let min = 4;
  let max = MAX_TEAMS;
  let step = 1;

  switch (type) {
    case e_tournament_stage_types_enum.RoundRobin:
      min = 3 * groupCount;
      break;
    case e_tournament_stage_types_enum.Swiss:
      min = 10;
      max = 64;
      step = 2;
      break;
    case e_tournament_stage_types_enum.SingleElimination:
      if (previousAdvancing !== null) {
        min = 2;
      } else if (order === 1) {
        min = 4 * groupCount;
      }
      break;
    case e_tournament_stage_types_enum.DoubleElimination:
      if (order === 1) {
        min = 4 * groupCount;
      }
      break;
  }

  min = Math.max(min, lastRoundTeams(previousStage));
  if (min % step !== 0) {
    min += step - (min % step);
  }

  if (previousAdvancing !== null) {
    max = Math.min(max, previousAdvancing);
  }

  let maxTeamsFloor = 0;
  if (nextStage) {
    if (
      ranksWholeField({
        type,
        max_teams: max,
        swiss_no_elimination: swissNoElimination,
      })
    ) {
      maxTeamsFloor = nextStage.max_teams;
    } else if (type === e_tournament_stage_types_enum.Swiss) {
      maxTeamsFloor = nextStage.max_teams * 2;
    }
  }

  return { min, max, step, maxTeamsFloor };
}

// Saving a grouped elimination stage first halves its minimum into the next
// stage (Postgres rounds the halved float to the nearest even integer), then
// requires the next stage's minimum to split evenly across the groups.
export function groupsSplitNextStage({
  type,
  groups,
  minTeams,
  nextStage,
}: {
  type: string;
  groups: number | string;
  minTeams: number | string;
  nextStage?: AdjacentStage | null;
}): boolean {
  const groupCount = Math.floor(Number(groups)) || 1;
  if (
    !nextStage ||
    groupCount <= 1 ||
    type === e_tournament_stage_types_enum.RoundRobin
  ) {
    return true;
  }
  const half = Number(minTeams) / 2;
  const halved =
    Number.isInteger(half) || Math.floor(half) % 2 === 0
      ? Math.floor(half)
      : Math.ceil(half);
  const nextMin = Math.max(nextStage.min_teams ?? 0, halved);
  return nextMin % groupCount === 0;
}

export function teamCountOptions(
  limits: Pick<StageTeamLimits, "min" | "max" | "step">,
  atLeast = limits.min,
): number[] {
  const options: number[] = [];
  for (let count = limits.min; count <= limits.max; count += limits.step) {
    if (count >= atLeast) {
      options.push(count);
    }
  }
  return options;
}
