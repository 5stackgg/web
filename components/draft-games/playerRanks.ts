import type { ComputedRef, InjectionKey } from "vue";

export type RankSlots = { premier: boolean; faceit: boolean };

// Provided by the draft room: the ranks anyone in the lobby has, so every
// player's hover shows the same pills and a missing one reads as a blank.
export const RANK_SLOTS_KEY: InjectionKey<ComputedRef<RankSlots>> =
  Symbol("rankSlots");

export const hasPremierRank = (player: any) => (player?.premier_rank ?? 0) > 0;

export const hasFaceitRank = (player: any) =>
  (player?.faceit_skill_level ?? null) !== null;

export const rankSlotsFor = (players: Array<any>): RankSlots => ({
  premier: players.some(hasPremierRank),
  faceit: players.some(hasFaceitRank),
});
