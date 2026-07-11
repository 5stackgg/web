import { ref } from "vue";

// One active media element across the whole app: starting any event-media
// player claims the slot and every other player pauses/unmounts itself.
const current = ref<string | null>(null);

export function useMediaPlayback() {
  return {
    current,
    claim(id: string) {
      current.value = id;
    },
    release(id: string) {
      if (current.value === id) {
        current.value = null;
      }
    },
  };
}
