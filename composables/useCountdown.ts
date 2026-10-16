import { ref, watch, computed, onUnmounted, type Ref } from "vue";
import { serverNow, useServerClockStore } from "~/stores/ServerClockStore";

// Only the whole seconds are reactive: the share of time left goes to `meter`
// as --countdown every frame, so a bar or ring bound to it moves smoothly
// without re-rendering the component that holds it on every frame.
export function useCountdown(
  deadline: Ref<string | null | undefined>,
  total: Ref<number>,
  urgentAt = 6,
) {
  const clock = useServerClockStore();
  const seconds = ref(0);
  const meter = ref<HTMLElement | SVGElement | null>(null);
  let raf: number | null = null;

  const tick = () => {
    const end = deadline.value ? new Date(deadline.value).getTime() : NaN;
    const left = Number.isFinite(end)
      ? Math.max(0, (end - serverNow()) / 1000)
      : 0;

    seconds.value = Math.ceil(left);
    meter.value?.style.setProperty(
      "--countdown",
      String(
        Number.isFinite(end) && total.value > 0
          ? Math.min(1, left / total.value)
          : 1,
      ),
    );

    raf = left > 0 ? requestAnimationFrame(tick) : null;
  };

  watch(
    [deadline, total, () => clock.offsetMs, meter],
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

  const urgent = computed(() => seconds.value <= urgentAt && seconds.value > 0);

  return { seconds, urgent, meter };
}
