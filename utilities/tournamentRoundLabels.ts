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

  if (stage === 1 && roundNumber === 1 && !isLoserBracket) {
    return "Opening Round";
  }

  if (isFinalStage && !isLoserBracket) {
    if (totalMathcdesInRound === 4) {
      return "Quarter Finals";
    }

    if (totalMathcdesInRound === 2) {
      if (isLastRound && stageType === e_tournament_stage_types_enum.SingleElimination) {
        return "Grand Final";
      }
      return "Semi Finals";
    }

    if (totalMathcdesInRound === 1) {
      if (stageType === e_tournament_stage_types_enum.DoubleElimination && !isLastRound) {
        return "WB Final";
      }
      return "Grand Final";
    }
  }

  if (isLoserBracket && isLastRound) {
    return "Losers Final";
  }

  return `${isLoserBracket ? "Losers" : ""} ${roundNumber}${getOrdinalSuffix(roundNumber)} Round`;
}

export function getWinnerLabel(isFinalStage: boolean = false): string {
  if (isFinalStage) {
    return "Winner";
  }
  return "Advances to Next Stage";
}

function getOrdinalSuffix(num: number): string {
  if (num >= 11 && num <= 13) {
    return "th";
  }

  switch (num % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
