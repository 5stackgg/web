// Per-round buy classification from team money. Shared by the match
// economy timeline and the 2D replay buy-round overlay so both agree on
// what counts as a "full buy".
export const ECO_MAX = 5000;
export const FULL_MIN = 20000;

export type BuyType = "eco" | "force" | "full" | "unknown";

export function moneyOf(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function classifyBuyType(money: number | null): BuyType {
  if (money === null) return "unknown";
  if (money >= FULL_MIN) return "full";
  if (money <= ECO_MAX) return "eco";
  return "force";
}

// A round qualifies for the buy-round overlay when either side did a
// full buy — we keep both teams' positions either way.
export function isFullBuyRound(
  lineup1Money: number | null,
  lineup2Money: number | null,
): boolean {
  return (
    classifyBuyType(lineup1Money) === "full" ||
    classifyBuyType(lineup2Money) === "full"
  );
}
