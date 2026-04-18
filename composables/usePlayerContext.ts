import { ref } from "vue";

type PlayerContextValue = {
  id: string;
  name: string;
} | null;

const playerContext = ref<PlayerContextValue>(null);

export function usePlayerContext() {
  return playerContext;
}
