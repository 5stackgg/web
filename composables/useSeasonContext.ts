import { ref } from "vue";

type SeasonContextValue = {
  id: string;
  name: string;
} | null;

const seasonContext = ref<SeasonContextValue>(null);

export function useSeasonContext() {
  return seasonContext;
}
