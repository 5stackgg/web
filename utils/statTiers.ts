export type StatTier = "good" | "neutral" | "warn" | "poor" | null;

export type StatTierConfig = {
  dir: "high" | "low";
  // [goodEdge, neutralEdge, warnEdge]
  // high: value >= goodEdge -> good, >= neutralEdge -> neutral, >= warnEdge -> warn, else poor
  // low:  value <= goodEdge -> good, <= neutralEdge -> neutral, <= warnEdge -> warn, else poor
  cuts: [number, number, number];
};

const TIER_CLASS: Record<Exclude<StatTier, null>, string> = {
  good: "text-[hsl(var(--success))]",
  neutral: "",
  warn: "text-[hsl(var(--tac-amber))]",
  poor: "text-destructive",
};

export function statTierFor(
  cfg: StatTierConfig | undefined,
  value: number | null,
): StatTier {
  if (cfg === undefined || value === null) return null;
  const [a, b, c] = cfg.cuts;
  if (cfg.dir === "high") {
    if (value >= a) return "good";
    if (value >= b) return "neutral";
    if (value >= c) return "warn";
    return "poor";
  }
  if (value <= a) return "good";
  if (value <= b) return "neutral";
  if (value <= c) return "warn";
  return "poor";
}

export function statTierClass(
  cfg: StatTierConfig | undefined,
  value: number | null,
): string {
  const tier = statTierFor(cfg, value);
  return tier ? TIER_CLASS[tier] : "";
}
