// Prize amounts are free-text (organizers type "$5,000", "€1000", "Custom Knife"),
// so a pool total is best-effort: sum only the entries that clearly read as a
// currency amount, and carry the first symbol we see for formatting.
import { DEFAULT_CURRENCY } from "~/utilities/prizes";

const CURRENCY = /[$€£¥₩₽₴]/;

interface PrizeLike {
  prize?: string | null;
}

function amountOf(raw: string): { value: number; symbol: string } | null {
  const str = raw.trim();
  const cleaned = str.replace(/[,\s]/g, "");
  const hasSymbol = CURRENCY.test(cleaned);
  // Only count values that are a bare amount (optionally symbol-prefixed);
  // this keeps "Top 3 teams" or "3x knives" out of the total.
  const isPureAmount = /^[$€£¥₩₽₴]?\d+(?:\.\d+)?$/.test(cleaned);
  if (!hasSymbol && !isPureAmount) {
    return null;
  }
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }
  const value = parseFloat(match[0]);
  if (!isFinite(value) || value <= 0) {
    return null;
  }
  return { value, symbol: str.match(CURRENCY)?.[0] ?? "" };
}

// Returns a formatted pool total (e.g. "$10,000") or null when no prize row
// parses as an amount. Mixed currencies don't sum: only entries matching the
// first symbol seen (or symbol-less bare amounts) count toward the total, and
// legacy symbol-less rows fall back to the default currency.
export function formatPrizePool(prizes?: PrizeLike[] | null): string | null {
  if (!prizes || prizes.length === 0) {
    return null;
  }
  let total = 0;
  let symbol = "";
  let counted = 0;
  for (const prize of prizes) {
    const parsed = amountOf(String(prize?.prize ?? ""));
    if (!parsed) {
      continue;
    }
    if (!symbol && parsed.symbol) {
      symbol = parsed.symbol;
    }
    if (parsed.symbol && parsed.symbol !== symbol) {
      continue;
    }
    total += parsed.value;
    counted += 1;
  }
  if (counted === 0) {
    return null;
  }
  return `${symbol || DEFAULT_CURRENCY}${total.toLocaleString()}`;
}
