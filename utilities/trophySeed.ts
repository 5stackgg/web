export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createSeededRng(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 0x85ebca6b);
    state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35);
    state ^= state >>> 16;
    return (state >>> 0) / 0xffffffff;
  };
}

export function pickFromSeed<T>(seed: number, items: readonly T[]): T {
  return items[seed % items.length];
}

export const TIER_PALETTES = {
  mvp: {
    primary: "#4ad8ff",
    secondary: "#1a7aa6",
    highlight: "#c9f2ff",
    shadow: "#0a3a52",
    gem: ["#ffd24a", "#ff6bd6", "#6bff9f"],
    label: "MVP",
  },
  gold: {
    primary: "#f4c430",
    secondary: "#b8860b",
    highlight: "#fff2a8",
    shadow: "#7a5a00",
    gem: ["#ff3b3b", "#8a2be2", "#2e86ff"],
    label: "GOLD",
  },
  silver: {
    primary: "#d8d8d8",
    secondary: "#8a8a8a",
    highlight: "#ffffff",
    shadow: "#4a4a4a",
    gem: ["#2e86ff", "#2ed573", "#c8a2c8"],
    label: "SILVER",
  },
  bronze: {
    primary: "#cd7f32",
    secondary: "#7a4a1a",
    highlight: "#ffd39b",
    shadow: "#3a1f0a",
    gem: ["#ff8c00", "#2ed573", "#b87333"],
    label: "BRONZE",
  },
} as const;

export type TrophyTier = keyof typeof TIER_PALETTES;

export function placementToTier(placement: number): TrophyTier {
  if (placement === 0) return "mvp";
  if (placement === 1) return "gold";
  if (placement === 2) return "silver";
  return "bronze";
}
