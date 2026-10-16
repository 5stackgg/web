import { defineStore, acceptHMRUpdate } from "pinia";
import { computed, ref } from "vue";

export const useServerClockStore = defineStore("serverClock", () => {
  // How far the api's clock is from this device's, as a range. The api read
  // its clock after a ping left and before the pong came back, so a pong
  // bounds the offset on both sides; a pushed update only bounds it from
  // below. Readings narrow the range, and one that falls outside it means
  // this device's clock moved, so it replaces the range.
  const low = ref<number | null>(null);
  const high = ref(Infinity);
  const stale = ref(false);

  const offsetMs = computed(() => {
    if (low.value === null) {
      return null;
    }
    return high.value === Infinity ? low.value : (low.value + high.value) / 2;
  });

  function observe(serverNow: number, receivedAt: number, sentAt?: number) {
    if (!Number.isFinite(serverNow)) {
      return;
    }

    const floor = serverNow - receivedAt;
    const ceiling =
      Number.isFinite(sentAt) && sentAt! <= receivedAt
        ? serverNow - sentAt!
        : Infinity;

    if (
      low.value === null ||
      stale.value ||
      floor > high.value ||
      ceiling < low.value
    ) {
      low.value = floor;
      high.value = ceiling;
      stale.value = false;
      return;
    }

    low.value = Math.max(low.value, floor);
    high.value = Math.min(high.value, ceiling);
  }

  // A reconnect can follow a sleep that moved the device clock: the next
  // reading starts a new range, and until then the old one stands.
  function reconnected() {
    stale.value = true;
  }

  function now(): number {
    return Date.now() + (offsetMs.value ?? 0);
  }

  return { offsetMs, observe, reconnected, now };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useServerClockStore, import.meta.hot));
}
