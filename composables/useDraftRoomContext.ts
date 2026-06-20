import { ref } from "vue";

type DraftRoomContextValue = {
  id: string;
  name: string;
} | null;

const draftRoomContext = ref<DraftRoomContextValue>(null);

export function useDraftRoomContext() {
  return draftRoomContext;
}
