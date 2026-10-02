import { computed, ref } from "vue";

// Phone surfaces that sit where the match action toasts do. A surface that
// holds the bottom hides the toasts while it is up; one that reserves it only
// pushes the stack above itself, for surfaces that can stay up indefinitely.
const holders = ref<string[]>([]);
const reserved = ref<Record<string, number>>({});

export function useMobileToastYield() {
  function holdBottom(key: string, active: boolean) {
    const others = holders.value.filter((holder) => holder !== key);
    holders.value = active ? [...others, key] : others;
  }

  function reserveBottom(key: string, height: number) {
    const { [key]: _previous, ...others } = reserved.value;
    reserved.value = height > 0 ? { ...others, [key]: height } : others;
  }

  return {
    yielding: computed(() => holders.value.length > 0),
    reservedHeight: computed(() =>
      Math.max(0, ...Object.values(reserved.value)),
    ),
    holdBottom,
    reserveBottom,
  };
}
