import type { StageGrenadeType, StageTeam } from "./types";

/**
 * The stage's colours, in one place. The team colours are the app's own
 * (ReplayViewer's CT_HEX / T_HEX, the --tac-amber accent for T); every tint
 * a module needs is a lighter or darker step of the same hue.
 */

/** HSL (degrees, percent, percent) to a 0xRRGGBB sRGB number. */
export function hsl(h: number, s: number, l: number) {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) =>
    Math.round(
      255 * (light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))),
    );
  return (channel(0) << 16) | (channel(8) << 8) | channel(4);
}

/** The app's team colours: CT hsl(210, 80%, 60%), T hsl(33, 94%, 58%). */
export const TEAM_HUE: Record<StageTeam, number> = { ct: 210, t: 33 };
export const TEAM_BASE: Record<StageTeam, number> = {
  ct: hsl(210, 80, 60),
  t: hsl(33, 94, 58),
};

export type TeamStyle = {
  /** Dark body of the puck. */
  rim: number;
  /** Emissive disc on top. */
  core: number;
  /** Portrait ring and pointer. */
  ring: number;
  /** Portrait backing. */
  fill: number;
  /** Death X on the ground. */
  mark: number;
  /** Tracer tint and its near-white core. */
  tracer: number;
  tracerCore: number;
};

export const TEAM_STYLE: Record<StageTeam, TeamStyle> = {
  ct: {
    rim: hsl(212, 72, 19),
    core: hsl(208, 95, 74),
    ring: TEAM_BASE.ct,
    fill: hsl(210, 72, 45),
    mark: TEAM_BASE.ct,
    tracer: hsl(208, 95, 64),
    tracerCore: hsl(205, 100, 94),
  },
  t: {
    rim: hsl(22, 85, 22),
    core: hsl(38, 100, 62),
    ring: TEAM_BASE.t,
    fill: hsl(30, 92, 47),
    mark: hsl(28, 90, 50),
    tracer: hsl(28, 100, 58),
    tracerCore: hsl(42, 100, 88),
  },
};

/**
 * A whisper of a team's hue as per-channel multipliers around 1, for tints
 * that must stay neutral (smoke): `amount` 0 is no tint.
 */
export function teamWhisper(team: StageTeam, amount: number) {
  const hex = TEAM_BASE[team];
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  const mean = (r + g + b) / 3;
  return [r, g, b].map((c) => 1 + (c / mean - 1) * amount) as [
    number,
    number,
    number,
  ];
}

/** Utility colours: a projectile's core and glow, and its icon tint. */
export const UTILITY_COLORS: Record<
  StageGrenadeType,
  [core: number, glow: number]
> = {
  smoke: [0xeef2f5, 0xc9d6df],
  flash: [0xffffff, 0xd9ecff],
  he: [0xff6a3a, 0xff4a1c],
  molotov: [0xffa13a, 0xff6a14],
  incendiary: [0xffc24a, 0xff8a1e],
  decoy: [0xb4bac0, 0xcfd4d8],
};

/**
 * Utility hues for markers that say which utility something is: the chrome's
 * legend, the heatmap, picked throws. The effects themselves (clouds, bursts,
 * fire, grenades in flight) keep `UTILITY_COLORS`.
 */
export const UTILITY_MARKER_COLORS: Record<StageGrenadeType, number> = {
  smoke: 0x32d6e0,
  flash: 0xffd21a,
  he: 0xff3b3b,
  molotov: 0xff6a1a,
  incendiary: 0xff6a1a,
  decoy: 0x66dd55,
};

/** Heat glow over a fire: a molotov burns deeper than an incendiary. */
export const FIRE_GLOW = {
  molotov: hsl(25, 100, 55),
  incendiary: hsl(TEAM_HUE.t, 100, 59),
};
