import { ref, onMounted, onBeforeUnmount } from "vue";

// Prevents the jarring "shove to top" when content shrinks (e.g. a filter trims
// a long match list, or swaps a tall list for empty states). We pin a
// `min-height` on the page root equal to the height needed to keep the user's
// current scroll valid — applied SYNCHRONOUSLY before the shrink renders, so
// the browser can't clamp the scroll upward. As the user scrolls back up the
// floor ratchets down, collapsing the reserved space naturally.
export function useScrollFloor() {
  const minHeight = ref(0);
  const rootEl = ref<HTMLElement | null>(null);
  let scroller: HTMLElement | null = null;
  let listening = false;
  let floor = 0;
  let raf = 0;

  function findScroller(el: HTMLElement | null): HTMLElement | null {
    let cur = el?.parentElement ?? null;
    while (cur && cur !== document.body) {
      const oy = getComputedStyle(cur).overflowY;
      if (oy === "auto" || oy === "scroll") {
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  }

  // The root height required to keep the user's current view bottom valid.
  function neededHeight(): number {
    if (!rootEl.value || !scroller) {
      return 0;
    }
    const rootTopInScroller =
      scroller.scrollTop +
      (rootEl.value.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top);
    return scroller.scrollTop + scroller.clientHeight - rootTopInScroller;
  }

  function attachListener() {
    if (!scroller || listening) {
      return;
    }
    scroller.addEventListener("scroll", onScroll, { passive: true });
    listening = true;
  }

  // Call right before a change that may shrink content.
  function capture() {
    if (!rootEl.value) {
      return;
    }
    if (!scroller) {
      scroller = findScroller(rootEl.value);
      attachListener();
    }
    if (!scroller) {
      return;
    }
    floor = Math.max(floor, neededHeight());
    minHeight.value = floor > 0 ? floor : 0;
  }

  function onScroll() {
    if (!scroller || floor <= 0) {
      return;
    }
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const needed = neededHeight();
      if (needed < floor) {
        floor = Math.max(0, needed);
        minHeight.value = floor;
      }
    });
  }

  onMounted(() => {
    scroller = findScroller(rootEl.value);
    attachListener();
  });

  onBeforeUnmount(() => {
    scroller?.removeEventListener("scroll", onScroll);
    listening = false;
    if (raf) cancelAnimationFrame(raf);
  });

  return { minHeight, rootEl, capture };
}
