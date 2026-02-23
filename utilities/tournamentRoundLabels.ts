import { e_tournament_stage_types_enum } from "~/generated/zeus";

export function getRoundLabel(
  roundNumber: number,
  stage: number,
  isFinalStage: boolean = false,
  totalMathcdesInRound: number,
  isLoserBracket: boolean = false,
  stageType?: string | null,
  isLastRound: boolean = false,
): string {
  // For round robin, just show the round number
  if (stageType === e_tournament_stage_types_enum.RoundRobin) {
    return `Round ${roundNumber}`;
  }

  // For Swiss format, show record labels (handled in SwissBracketViewer)
  if (stageType === e_tournament_stage_types_enum.Swiss) {
    return `Round ${roundNumber}`;
  }

  const isDE = stageType === e_tournament_stage_types_enum.DoubleElimination;
  const wbPrefix = isDE ? "WB " : "";

  if (isLoserBracket) {
    if (isLastRound) {
      return "LB Final";
    }
    return `LB Round ${roundNumber}`;
  }

  if (stage === 1 && roundNumber === 1) {
    return `${wbPrefix}Opening Round`;
  }

  if (isFinalStage) {
    if (totalMathcdesInRound === 4) {
      return `${wbPrefix}Quarter Finals`;
    }

    if (totalMathcdesInRound === 2) {
      if (isLastRound && stageType === e_tournament_stage_types_enum.SingleElimination) {
        return "Final";
      }
      return `${wbPrefix}Semi Finals`;
    }

    if (totalMathcdesInRound === 1) {
      if (isDE && !isLastRound) {
        return "WB Final";
      }
      return "Grand Final";
    }
  }

  return `${wbPrefix}Round ${roundNumber}`;
}

export function getWinnerLabel(isFinalStage: boolean = false): string {
  if (isFinalStage) {
    return "Winner";
  }
  return "Advances to Next Stage";
}
