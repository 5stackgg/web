// ELO rank tiers — shared so the leaderboard, PlayerElo card, and anywhere
// else that shows an ELO value tint it with the same tier color.

export interface RankTier {
  threshold: number;
  label: string;
  rgb: string;
}

// ELO baseline — every player starts here. Tiers anchor at 5000 and climb;
// values below 5000 surface as "Provisional".
export const ELO_BASELINE = 5000;

export const RANK_TIERS: RankTier[] = [
  { threshold: 22000, label: "Apex", rgb: "235 75 75" },
  { threshold: 17000, label: "Phantom", rgb: "210 44 230" },
  { threshold: 13000, label: "Legend", rgb: "254 215 0" },
  { threshold: 10000, label: "Master", rgb: "136 70 255" },
  { threshold: 7500, label: "Veteran", rgb: "75 105 255" },
  { threshold: 6000, label: "Operator", rgb: "94 152 215" },
  { threshold: ELO_BASELINE, label: "Recruit", rgb: "177 195 217" },
];

export const PROVISIONAL_TIER: RankTier = {
  threshold: 0,
  label: "Provisional",
  rgb: "120 130 140",
};

export function tierFor(elo: number): RankTier {
  if (elo < ELO_BASELINE) return PROVISIONAL_TIER;
  for (const t of RANK_TIERS) {
    if (elo >= t.threshold) return t;
  }
  return RANK_TIERS[RANK_TIERS.length - 1];
}

// CSS color string for an ELO value's tier, or undefined when the value
// isn't a usable number (so callers can spread into :style safely).
export function eloTierColor(
  elo: number | null | undefined,
): string | undefined {
  if (elo === null || elo === undefined || !Number.isFinite(elo)) {
    return undefined;
  }
  return `rgb(${tierFor(elo).rgb})`;
}
