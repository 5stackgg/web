import { computed, ref } from "vue";

// Phone surfaces that sit where the match action toasts do. The toasts render
// above them, so they hide on phones while any of these is up.
const holders = ref<string[]>([]);

export function useMobileToastYield() {
  function holdBottom(key: string, active: boolean) {
    const others = holders.value.filter((holder) => holder !== key);
    holders.value = active ? [...others, key] : others;
  }

  return {
    yielding: computed(() => holders.value.length > 0),
    holdBottom,
  };
}
