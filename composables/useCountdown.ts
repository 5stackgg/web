import { ref, watch, computed, onUnmounted, type Ref } from "vue";

// Drives the remaining seconds off requestAnimationFrame rather than
// setInterval so anything bound to `fraction` interpolates every frame — a
// one-second tick makes progress rings and bars visibly step.
export function useCountdown(
  deadline: Ref<string | null | undefined>,
  total: Ref<number>,
  urgentAt = 6,
) {
  const remaining = ref(0);
  let raf: number | null = null;

  const tick = () => {
    if (!deadline.value) {
      remaining.value = 0;
      raf = null;
      return;
    }

    const ms = new Date(deadline.value).getTime() - Date.now();
    remaining.value = Math.max(0, ms / 1000);
    raf = remaining.value > 0 ? requestAnimationFrame(tick) : null;
  };

  watch(
    deadline,
    () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      tick();
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (raf) {
      cancelAnimationFrame(raf);
    }
  });

  const fraction = computed(() => {
    if (!deadline.value || total.value <= 0) {
      return 1;
    }
    return Math.max(0, Math.min(1, remaining.value / total.value));
  });

  const urgent = computed(
    () => remaining.value <= urgentAt && remaining.value > 0,
  );

  return { remaining, fraction, urgent };
}
