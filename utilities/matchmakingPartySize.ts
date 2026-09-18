import { e_match_types_enum } from "~/generated/zeus";

/**
 * Total players a queueable match type needs (both lineups combined).
 * Premier and Faceit are demo-import only — they are never matchmade.
 */
export const EXPECTED_PLAYERS: Partial<Record<e_match_types_enum, number>> = {
  [e_match_types_enum.Duel]: 2,
  [e_match_types_enum.Wingman]: 4,
  [e_match_types_enum.Competitive]: 10,
};

/**
 * A party can queue a match type when it either fits inside a single lineup
 * (half the match, so the other half gets filled by matchmaking) or fills the
 * entire match on its own (both lineups, split in-house).
 *
 * Duel (2): 1 or 2 · Wingman (4): 1-2 or 4 · Competitive (10): 1-5 or 10
 */
export function canPartyQueue(
  type: e_match_types_enum,
  partySize: number,
): boolean {
  const expected = EXPECTED_PLAYERS[type];

  if (!expected) {
    return true;
  }

  return partySize <= expected / 2 || partySize === expected;
}

/**
 * One lobby waiting in a region's queue, as the api broadcasts it. A lobby that
 * queued for several regions carries the same `lobby` index in each of them.
 */
export interface QueuedLobbyStat {
  lobby: number;
  players: number;
}

export type RegionStats = Partial<
  Record<string, Partial<Record<e_match_types_enum, QueuedLobbyStat[]>>>
>;

/**
 * How many players are waiting for a match type across the given regions.
 *
 * Counts people, not parties: a queued trio is three players waiting. Lobbies
 * are deduplicated by index, so a lobby queued in three regions is counted
 * once rather than three times.
 */
export function playersInQueue(
  regionStats: RegionStats,
  type: e_match_types_enum,
  regionValues: string[],
): number {
  const counted = new Map<number, number>();

  for (const regionValue of regionValues) {
    for (const queued of regionStats[regionValue]?.[type] ?? []) {
      counted.set(queued.lobby, queued.players);
    }
  }

  return [...counted.values()].reduce((total, players) => total + players, 0);
}
