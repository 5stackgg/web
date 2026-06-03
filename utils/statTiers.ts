// Stat quality is expressed with directional chevrons, not color on the number:
//   2 best ⏫  1 ok ⌃  0 normal (nothing)  -1 concerning ⌄  -2 bad ⏬
export type StatLevel = 2 | 1 | 0 | -1 | -2;

export type StatTierConfig = {
  dir: "high" | "low";
  // 4 edges -> 5 levels (preferred):
  //   high: >=cuts[0] best, >=cuts[1] ok, >=cuts[2] normal, >=cuts[3] concerning, else bad
  //   low : mirror with <=
  // 3 edges (legacy) maps to best/normal/concerning/bad (no `ok`).
  cuts: [number, number, number] | [number, number, number, number];
};

// Chevron icon color. Up tiers read green, down tiers amber -> red.
export const LEVEL_CLASS: Record<Exclude<StatLevel, 0>, string> = {
  2: "text-[hsl(var(--success))]",
  1: "text-[hsl(var(--success))]",
  [-1]: "text-[hsl(var(--tac-amber))]",
  [-2]: "text-destructive",
};

export function statLevelFor(
  cfg: StatTierConfig | undefined,
  value: number | null | undefined,
): StatLevel | null {
  if (cfg === undefined || value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;

  if (cfg.cuts.length === 4) {
    const [best, ok, normal, concerning] = cfg.cuts;
    if (cfg.dir === "high") {
      if (value >= best) return 2;
      if (value >= ok) return 1;
      if (value >= normal) return 0;
      if (value >= concerning) return -1;
      return -2;
    }
    if (value <= best) return 2;
    if (value <= ok) return 1;
    if (value <= normal) return 0;
    if (value <= concerning) return -1;
    return -2;
  }

  // Legacy 3-cut config: best / normal / concerning / bad (no `ok`).
  const [best, normal, concerning] = cfg.cuts;
  if (cfg.dir === "high") {
    if (value >= best) return 2;
    if (value >= normal) return 0;
    if (value >= concerning) return -1;
    return -2;
  }
  if (value <= best) return 2;
  if (value <= normal) return 0;
  if (value <= concerning) return -1;
  return -2;
}

// Bucket a value inside a continuous good/bad range into the 5 levels.
// For "lower is better" stats pass good < bad.
export function statLevelFromRange(
  value: number | null | undefined,
  good: number,
  bad: number,
): StatLevel | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  if (good === bad) return 0;
  let t = (value - bad) / (good - bad); // 0 at bad, 1 at good
  t = Math.max(0, Math.min(1, t));
  if (t >= 0.85) return 2;
  if (t >= 0.6) return 1;
  if (t > 0.4) return 0;
  if (t > 0.15) return -1;
  return -2;
}

// Shared canonical configs so kd/hltv/etc. read consistently app-wide.
export const KD_TIER: StatTierConfig = { dir: "high", cuts: [1.3, 1.1, 0.95, 0.85] };
export const HLTV_TIER: StatTierConfig = { dir: "high", cuts: [1.2, 1.05, 0.95, 0.85] };
export const KAST_TIER: StatTierConfig = { dir: "high", cuts: [80, 72, 64, 58] };
export const ADR_TIER: StatTierConfig = { dir: "high", cuts: [90, 75, 60, 50] };
