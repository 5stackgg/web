import { e_tournament_stage_types_enum } from "~/generated/zeus";

export interface TranslatableLabel {
  key: string;
  params?: Record<string, string | number>;
}

export function getRoundLabel(
  roundNumber: number,
  stage: number,
  isFinalStage: boolean = false,
  totalMatchesInRound: number,
  isLoserBracket: boolean = false,
  stageType?: string | null,
  isLastRound: boolean = false,
): TranslatableLabel {
  // For round robin, just show the round number
  if (stageType === e_tournament_stage_types_enum.RoundRobin) {
    return {
      key: "tournament.round_labels.round",
      params: { number: roundNumber },
    };
  }

  // For Swiss format, show record labels (handled in SwissBracketViewer)
  if (stageType === e_tournament_stage_types_enum.Swiss) {
    return {
      key: "tournament.round_labels.round",
      params: { number: roundNumber },
    };
  }

  const isDE = stageType === e_tournament_stage_types_enum.DoubleElimination;

  if (isLoserBracket) {
    if (isLastRound) {
      return { key: "tournament.round_labels.lb_final" };
    }
    return {
      key: "tournament.round_labels.lb_round",
      params: { number: roundNumber },
    };
  }

  if (stage === 1 && roundNumber === 1) {
    return isDE
      ? { key: "tournament.round_labels.wb_opening_round" }
      : { key: "tournament.round_labels.opening_round" };
  }

  if (isFinalStage) {
    if (totalMatchesInRound === 4) {
      return isDE
        ? { key: "tournament.round_labels.wb_quarter_finals" }
        : { key: "tournament.round_labels.quarter_finals" };
    }

    if (totalMatchesInRound === 2) {
      if (
        isLastRound &&
        stageType === e_tournament_stage_types_enum.SingleElimination
      ) {
        return { key: "tournament.round_labels.final" };
      }
      return isDE
        ? { key: "tournament.round_labels.wb_semi_finals" }
        : { key: "tournament.round_labels.semi_finals" };
    }

    if (totalMatchesInRound === 1) {
      if (isDE && !isLastRound) {
        return { key: "tournament.round_labels.wb_final" };
      }
      return isDE
        ? { key: "tournament.round_labels.grand_final" }
        : { key: "tournament.round_labels.final" };
    }
  }

  return isDE
    ? {
        key: "tournament.round_labels.wb_round",
        params: { number: roundNumber },
      }
    : { key: "tournament.round_labels.round", params: { number: roundNumber } };
}

export function getWinnerLabel(
  isFinalStage: boolean = false,
): TranslatableLabel {
  if (isFinalStage) {
    return { key: "tournament.round_labels.winner" };
  }
  return { key: "tournament.round_labels.advances_to_next_stage" };
}
