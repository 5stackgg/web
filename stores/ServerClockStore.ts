import { defineStore, acceptHMRUpdate } from "pinia";
import { computed, ref } from "vue";

export const useServerClockStore = defineStore("serverClock", () => {
  // How far the api's clock is from this device's, as a range. The api read
  // its clock after a ping left and before the pong came back, so a pong
  // bounds the offset on both sides. Readings narrow the range, and one that
  // falls outside it means this device's clock moved, so it replaces the range.
  //
  // A pushed update only bounds it from below, and only counts until a pong
  // has timed the clock: it can come from another api pod, whose clock sits a
  // little apart and would knock out the pong's range on every update.
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

    if (ceiling === Infinity && high.value !== Infinity && !stale.value) {
      return;
    }

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

  return { offsetMs, observe, reconnected };
});

// Not a store action: countdowns read it every frame.
export function serverNow(): number {
  return Date.now() + (useServerClockStore().offsetMs ?? 0);
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useServerClockStore, import.meta.hot));
}
