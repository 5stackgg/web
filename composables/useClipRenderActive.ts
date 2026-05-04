import { ref } from "vue";

const active = ref(false);

export function useClipRenderActive() {
  return {
    active,
    setActive: (v: boolean) => {
      active.value = v;
    },
  };
}
