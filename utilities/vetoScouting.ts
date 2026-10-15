// Veto scouting: what each lineup has done before, read during a map veto.
// A team's history is the team's own (its past vetoes and the maps they
// decided). A pickup has no team, so its history is its people: the five
// players' own results on each map, and the captain's past vetoes as captain.

export type ScoutMap = {
  wins: number;
  played: number;
  bans: number;
  picks: number;
};

export type ScoutLineup = {
  source: "team" | "players";
  // Whose habits these are: the team, or in a pickup the captain.
  owner: string;
  // Past vetoes the ban and pick counts come from.
  vetoes: number;
  maps: Record<string, ScoutMap>;
};

// The modes with a scouting switch on Settings › Matchmaking. Other match types
// (Premier, Faceit) have no switch and no scouting.
export const VETO_SCOUTING_MODES = ["competitive", "wingman", "duel", "rush"];

// A habit only counts once there are a few vetoes behind it.
export const SCOUT_MIN_VETOES = 3;
export const SCOUT_BAN_RATE = 0.5;
export const SCOUT_PICK_RATE = 0.4;
export const SCOUT_LIKELY_RATE = 0.3;

export type ScoutHabit = { kind: "ban" | "pick"; n: number; of: number };

export function scoutHabit(
  lineup: ScoutLineup | null | undefined,
  mapId: string,
): ScoutHabit | null {
  if (!lineup || lineup.vetoes < SCOUT_MIN_VETOES) return null;
  const map = lineup.maps[mapId];
  if (!map) return null;
  if (map.bans / lineup.vetoes >= SCOUT_BAN_RATE) {
    return { kind: "ban", n: map.bans, of: lineup.vetoes };
  }
  if (map.picks / lineup.vetoes >= SCOUT_PICK_RATE) {
    return { kind: "pick", n: map.picks, of: lineup.vetoes };
  }
  return null;
}

// The move a lineup most often makes at this kind of step, among the maps
// still open.
export function scoutLikely(
  lineup: ScoutLineup | null | undefined,
  type: "Ban" | "Pick",
  open: string[],
): { mapId: string; n: number; of: number } | null {
  if (!lineup || lineup.vetoes < SCOUT_MIN_VETOES) return null;
  const key = type === "Ban" ? "bans" : "picks";
  let best: { mapId: string; n: number } | null = null;
  for (const mapId of open) {
    const n = lineup.maps[mapId]?.[key] ?? 0;
    if (n > 0 && (!best || n > best.n)) best = { mapId, n };
  }
  if (!best || best.n / lineup.vetoes < SCOUT_LIKELY_RATE) return null;
  return { ...best, of: lineup.vetoes };
}
