import { computed, onScopeDispose, ref, watch } from "vue";

/**
 * What a panel shows while it is waiting, without the strobe.
 *
 * Two different waits were being drawn the same way. A panel opening for the
 * first time has nothing on screen, so it needs a placeholder -- but it was
 * getting one that could come and go inside 80ms, which reads as a flash
 * rather than as loading. A panel refetching after a filter change already has
 * the previous answer up, and throwing that away for a wall of boxes is
 * strictly worse than leaving it there.
 *
 * So: the first load always gets the placeholder, and once shown it stays long
 * enough to be a state rather than a blink. Every load after that keeps the
 * content and only dims it, and only if the wait is long enough to notice.
 */
export function useDeferredLoading(
  source: () => boolean,
  options: { delay?: number; minVisible?: number } = {},
) {
  const delay = options.delay ?? 220;
  const minVisible = options.minVisible ?? 320;

  // The first-load placeholder is up and owes the eye its minimum.
  const holding = ref(false);
  // A refetch has run long enough to be worth admitting to.
  const slow = ref(false);
  // A load has completed, so an empty list now means empty rather than pending.
  const loaded = ref(false);

  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let shownAt = 0;

  function clearTimers() {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  watch(
    source,
    (loading) => {
      clearTimers();

      if (loading) {
        if (loaded.value) {
          showTimer = setTimeout(() => (slow.value = true), delay);
        } else {
          shownAt = Date.now();
          holding.value = true;
        }
        return;
      }

      slow.value = false;

      if (!holding.value) {
        loaded.value = true;
        return;
      }

      // Landed while the placeholder is up: hold it out so the swap into
      // content is the only thing the eye has to track.
      hideTimer = setTimeout(
        () => {
          holding.value = false;
          loaded.value = true;
        },
        Math.max(0, minVisible - (Date.now() - shownAt)),
      );
    },
    { immediate: true },
  );

  onScopeDispose(clearTimers);

  /**
   * Treat the next load as a first load again -- for when what is on screen
   * belongs to something the panel is no longer showing, like the previous
   * map's lineups.
   */
  function reset() {
    clearTimers();
    slow.value = false;
    loaded.value = false;
    shownAt = Date.now();
    holding.value = true;
  }

  return {
    /** Nothing to show yet. Draw the shapes. */
    skeleton: computed(() => holding.value),
    /** A slow refetch under content that is already up. Dim it, keep it. */
    refreshing: computed(() => slow.value),
    /** A load has completed at least once. */
    loaded: computed(() => loaded.value),
    reset,
  };
}
