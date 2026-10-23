import { DEMO_PLAYER_NAMES } from "~/utilities/demoMatch";
import type { ScoutLineup, ScoutMap } from "~/utilities/vetoScouting";

// A pickup's history is its captain's past vetoes and its five players' own
// results, keyed by map id (the demo's map ids are their names).
type Row = [wins: number, played: number, bans: number, picks: number];

function lineup(owner: string, vetoes: number, rows: Record<string, Row>) {
  const maps: Record<string, ScoutMap> = {};
  for (const [map, [wins, played, bans, picks]] of Object.entries(rows)) {
    maps[map] = { wins, played, bans, picks };
  }
  return { source: "players", owner, vetoes, maps } satisfies ScoutLineup;
}

export const DEMO_SCOUTS: [ScoutLineup, ScoutLineup] = [
  lineup(DEMO_PLAYER_NAMES[1][0], 14, {
    de_ancient: [9, 16, 3, 2],
    de_anubis: [6, 13, 4, 1],
    de_dust2: [8, 15, 5, 2],
    de_inferno: [11, 18, 2, 4],
    de_mirage: [19, 27, 0, 7],
    de_nuke: [4, 11, 9, 0],
    de_vertigo: [2, 7, 11, 0],
  }),
  lineup(DEMO_PLAYER_NAMES[2][0], 11, {
    de_ancient: [12, 17, 1, 5],
    de_anubis: [3, 10, 8, 0],
    de_dust2: [7, 14, 4, 1],
    de_inferno: [9, 19, 6, 2],
    de_mirage: [16, 25, 1, 3],
    de_nuke: [8, 13, 3, 1],
    de_vertigo: [5, 9, 5, 0],
  }),
];
