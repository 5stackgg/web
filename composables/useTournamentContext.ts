import { ref } from "vue";

type TournamentContextValue = {
  id: string;
  name: string;
  // Whether the current user can administer this tournament
  isOrganizer?: boolean;
  // Whether the current user has a team or is otherwise participating
  isParticipant?: boolean;
} | null;

const tournamentContext = ref<TournamentContextValue>(null);

export function useTournamentContext() {
  return tournamentContext;
}
