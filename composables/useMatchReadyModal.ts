import { ref } from "vue";

const manuallyOpened = ref(false);

export function useMatchReadyModal() {
  return {
    manuallyOpened,
    openMatchReadyModal: () => {
      manuallyOpened.value = true;
    },
    closeMatchReadyModal: () => {
      manuallyOpened.value = false;
    },
  };
}
