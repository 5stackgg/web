import { ref, watch } from "vue";

const MAX_COUNT = 40;

/**
 * How many rows a list had the last time it loaded for this key, so its
 * first-load skeleton can stand in for that many rows instead of a fixed guess
 * that the real list then outgrows. Best-effort: storage can be missing or
 * blocked, and then the fallback is used.
 */
export function useRememberedCount(key: () => string, fallback: number) {
  const storageKey = () => `5stack:row-count:${key()}`;

  function read() {
    try {
      const n = Number(localStorage.getItem(storageKey()));
      return Number.isInteger(n) && n > 0 ? Math.min(n, MAX_COUNT) : fallback;
    } catch {
      return fallback;
    }
  }

  const count = ref(read());
  watch(key, () => (count.value = read()));

  function remember(n: number) {
    if (n <= 0) {
      return;
    }
    try {
      localStorage.setItem(storageKey(), String(n));
    } catch {}
  }

  return { count, remember };
}
