import { ref } from "vue";

const tournamentContext = ref<{ id: string; name: string } | null>(null);

export function useTournamentContext() {
  return tournamentContext;
}
