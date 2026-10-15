import { ref } from "vue";

// A match whose veto board still holds the page: its start stage is up
// ("stage"), or its maps and order of play are flying home to the page
// ("flying"). Until then the map cards and the header's veto row stay folded;
// while flying each stays hidden until its copy lands on it.
type VetoHandoff = { matchId: string; phase: "stage" | "flying" };

const handoff = ref<VetoHandoff | null>(null);

export function useVetoHandoff() {
  return handoff;
}

export function vetoHandoffPhase(matchId: string | null | undefined) {
  return matchId && handoff.value?.matchId === matchId
    ? handoff.value.phase
    : null;
}
