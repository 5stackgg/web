export interface StatScale {
  unit?: string;
  steps: [string, string, string, string, string];
}

export const STAT_SCALES: Record<string, StatScale> = {
  accuracy: { unit: "%", steps: ["8", "14", "18", "23", "30"] },
  accuracy_spotted: { unit: "%", steps: ["20", "28", "34", "42", "52"] },
  rifle_accuracy: { unit: "%", steps: ["12", "17", "21", "26", "32"] },
  pistol_accuracy: { unit: "%", steps: ["10", "15", "19", "24", "30"] },
  sniper_accuracy: { unit: "%", steps: ["25", "35", "45", "55", "68"] },
  head_accuracy: { unit: "%", steps: ["10", "16", "22", "30", "42"] },
  hs_kill_pct: { unit: "%", steps: ["25", "38", "48", "58", "70"] },
  hs: { unit: "%", steps: ["25", "38", "48", "58", "70"] },
  first_bullet_accuracy: { unit: "%", steps: ["20", "30", "40", "52", "65"] },
  spray_accuracy: { unit: "%", steps: ["8", "13", "17", "22", "28"] },
  time_to_damage: { unit: "ms", steps: ["900", "700", "550", "420", "300"] },
  crosshair_placement: { unit: "°", steps: ["12", "9", "7", "5", "3"] },
  counter_strafing: { unit: "%", steps: ["55", "70", "81", "88", "94"] },
  tracking: { unit: "%", steps: ["30", "42", "52", "63", "75"] },
  spotted_acc: { unit: "%", steps: ["25", "35", "45", "55", "68"] },
  hltv: { steps: ["0.85", "0.95", "1.00", "1.10", "1.25"] },
  kast: { unit: "%", steps: ["55", "65", "70", "75", "82"] },
  adr: { steps: ["55", "70", "80", "92", "110"] },
  kd: { steps: ["0.70", "0.90", "1.00", "1.15", "1.40"] },
  kpr: { steps: ["0.50", "0.60", "0.68", "0.78", "0.90"] },
  dpr: { steps: ["0.85", "0.75", "0.68", "0.60", "0.50"] },
  survived_pct: { unit: "%", steps: ["25", "33", "40", "48", "58"] },
  trade_kill_pct: { unit: "%", steps: ["25", "35", "45", "55", "68"] },
  traded: { unit: "%", steps: ["15", "22", "28", "35", "45"] },
  opening: { unit: "%", steps: ["38", "45", "50", "56", "65"] },
  flash_assists: {
    unit: "/rd",
    steps: ["0.02", "0.05", "0.08", "0.12", "0.18"],
  },
  flash_blind: { unit: "s/rd", steps: ["0.3", "0.6", "0.9", "1.3", "1.8"] },
  avg_flash_duration: { unit: "s", steps: ["1.0", "1.5", "2.0", "2.6", "3.4"] },
  enemies_flashed_per: { steps: ["0.4", "0.7", "1.0", "1.4", "1.9"] },
  util_efficiency: { steps: ["15", "25", "35", "48", "65"] },
  udr: { steps: ["2", "4", "6", "9", "13"] },
  wasted_magazine_pct: { unit: "%", steps: ["45", "35", "28", "22", "15"] },
  unused_utility: { unit: "$", steps: ["800", "600", "450", "300", "150"] },
  buy_win_rate: { unit: "%", steps: ["40", "47", "52", "58", "66"] },
  man_advantage: { unit: "%", steps: ["55", "65", "72", "80", "88"] },
  man_disadvantage: { unit: "%", steps: ["10", "16", "22", "30", "40"] },
  clutch_win_rate: { unit: "%", steps: ["15", "22", "28", "35", "45"] },
};

export function scoreToTier(score: number | null | undefined): number | null {
  if (score == null || Number.isNaN(score)) {
    return null;
  }
  return Math.max(0, Math.min(4, Math.floor(score / 20)));
}
