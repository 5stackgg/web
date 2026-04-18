import { ref } from "vue";

type TeamContextValue = {
  id: string;
  name: string;
} | null;

const teamContext = ref<TeamContextValue>(null);

export function useTeamContext() {
  return teamContext;
}
