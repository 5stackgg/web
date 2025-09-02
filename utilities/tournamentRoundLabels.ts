export function getRoundLabel(
  roundNumber: number,
  isFinalStage: boolean = false,
  totalMathcdesInRound: number,
): string {
  if (isFinalStage) {
    if (totalMathcdesInRound === 4) {
      return "Quarter Finals";
    }

    if (totalMathcdesInRound === 2) {
      return "Semi Finals";
    }

    if (totalMathcdesInRound === 1) {
      return "Grand Final";
    }
  }

  if (roundNumber === 1) {
    return "Opening Round";
  }

  return `${roundNumber}${getOrdinalSuffix(roundNumber)} Round`;
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
