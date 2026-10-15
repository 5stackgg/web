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
// (Premier, Faceit, and Rush, which has no veto) have no switch and no scouting.
export const VETO_SCOUTING_MODES = ["competitive", "wingman", "duel"];

// A habit only counts once there are a few vetoes behind it.
export const SCOUT_MIN_VETOES = 3;
export const SCOUT_BAN_RATE = 0.5;
export const SCOUT_PICK_RATE = 0.4;
export const SCOUT_LIKELY_RATE = 0.3;

// A win rate from one or two games says nothing, so under this it is "—".
export const SCOUT_MIN_GAMES = 3;
// Win rates this close or closer are even.
export const SCOUT_EVEN_POINTS = 5;

export function scoutRate(map: ScoutMap | null | undefined): number | null {
  if (!map || map.played < SCOUT_MIN_GAMES) return null;
  return Math.round((map.wins / map.played) * 100);
}

export type ScoutEdge =
  | { kind: "few" }
  | { kind: "even" }
  | { kind: "ahead"; lineup: 1 | 2; points: number };

// Who is stronger on a map, and by how many win-rate points.
export function scoutEdge(
  lineups: [ScoutLineup | null, ScoutLineup | null],
  mapId: string,
): ScoutEdge {
  const first = scoutRate(lineups[0]?.maps[mapId]);
  const second = scoutRate(lineups[1]?.maps[mapId]);
  if (first == null || second == null) return { kind: "few" };
  const points = first - second;
  if (Math.abs(points) <= SCOUT_EVEN_POINTS) return { kind: "even" };
  return {
    kind: "ahead",
    lineup: points > 0 ? 1 : 2,
    points: Math.abs(points),
  };
}

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
