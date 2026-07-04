import { ref } from "vue";

type EventContextValue = {
  id: string;
  name: string;
} | null;

const eventContext = ref<EventContextValue>(null);

export function useEventContext() {
  return eventContext;
}
