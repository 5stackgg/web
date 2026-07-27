import { ref } from "vue";

type AwardContextValue = {
  id: string;
  name: string;
} | null;

const awardContext = ref<AwardContextValue>(null);

export function useAwardContext() {
  return awardContext;
}
