import { ref, inject, provide } from "vue";

export type MatchSide = "all" | "T" | "CT";

const KEY = Symbol("match-side");

export function provideMatchSide(initial: MatchSide = "all") {
  const side = ref<MatchSide>(initial);
  provide(KEY, side);
  return side;
}

export function useMatchSide() {
  const side = inject(KEY, ref<MatchSide>("all"));
  return side;
}

export function roundMatchesSide(
  round: { lineup_1_side?: string; lineup_2_side?: string } | null,
  lineupId: string,
  matchLineup1Id: string,
  side: MatchSide,
): boolean {
  if (side === "all") return true;
  if (!round) return true;
  const playerSide =
    lineupId === matchLineup1Id ? round.lineup_1_side : round.lineup_2_side;
  return playerSide === side;
}
