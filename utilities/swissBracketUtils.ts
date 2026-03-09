/**
 * Parse a numeric group value into wins/losses for Swiss bracket display.
 *
 * Encoding:
 *  - 0       → 0-0
 *  - < 100   → 0-{group} (e.g. 1 = 0-1, 2 = 0-2)
 *  - >= 100  → {floor(group/100)}-{group%100} (e.g. 100 = 1-0, 101 = 1-1, 202 = 2-2)
 *
 * Also handles string "wins-losses" format.
 */
export function parseGroupToRecord(
  group: any,
): { wins: number; losses: number; recordKey: string } {
  if (group === null || group === undefined) {
    return { wins: 0, losses: 0, recordKey: "0-0" };
  }

  const groupNum = typeof group === "string" ? parseFloat(group) : group;

  if (typeof groupNum === "number") {
    if (groupNum === 0) {
      return { wins: 0, losses: 0, recordKey: "0-0" };
    } else if (groupNum < 100) {
      return { wins: 0, losses: groupNum, recordKey: `0-${groupNum}` };
    } else {
      const wins = Math.floor(groupNum / 100);
      const losses = groupNum % 100;
      return { wins, losses, recordKey: `${wins}-${losses}` };
    }
  }

  if (typeof group === "string") {
    const parts = group.split("-");
    if (parts.length === 2) {
      const wins = parseInt(parts[0], 10) || 0;
      const losses = parseInt(parts[1], 10) || 0;
      return { wins, losses, recordKey: group };
    }
  }

  return { wins: 0, losses: 0, recordKey: "0-0" };
}

export function getBorderColor(wins: number, losses: number): string {
  if (wins >= 3) return "border-green-500";
  if (losses >= 3) return "border-red-500";
  if (wins > losses) return "border-green-400";
  if (losses > wins) return "border-red-400";
  return "border-yellow-400";
}

export function getBackgroundColor(wins: number, losses: number): string {
  if (wins >= 3) return "bg-green-900/20";
  if (losses >= 3) return "bg-red-900/20";
  if (wins > losses) return "bg-green-800/10";
  if (losses > wins) return "bg-red-800/10";
  return "bg-yellow-800/10";
}
