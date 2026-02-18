import { ref } from "vue";

const matchContext = ref<{
  id: string;
  displayText: string;
  tournament?: { id: string; name: string };
} | null>(null);

export function useMatchContext() {
  return matchContext;
}
