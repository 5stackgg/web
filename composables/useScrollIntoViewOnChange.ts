import { nextTick, watch, type Ref } from "vue";

// A settings nav taller than the viewport means switching sections from a
// scrolled position renders the new content above the fold -- the tab responds,
// but the user is left staring at nav with the content off-screen above them.
//
// Pulls the content back into view on each change. Deliberately one-directional:
// if the target is already fully in view, or the user is above it (page header
// still showing), nothing moves. Scrolling *down* to pin content to the top
// would yank the header away on a first click, which is worse than doing nothing.

const MARGIN = 12;

// MainContent owns an overflow-auto wrapper, but outside that layout the
// document scrolls instead, so resolve it by walking up from the target.
function findScroller(el: HTMLElement): HTMLElement | null {
  let cur = el.parentElement;

  while (cur && cur !== document.body) {
    const overflowY = getComputedStyle(cur).overflowY;

    if (overflowY === "auto" || overflowY === "scroll") {
      return cur;
    }

    cur = cur.parentElement;
  }

  return (document.scrollingElement as HTMLElement | null) ?? null;
}

export function useScrollIntoViewOnChange(
  target: Ref<HTMLElement | null>,
  key: () => unknown,
) {
  watch(key, async () => {
    await nextTick();

    const el = target.value;

    if (!el) {
      return;
    }

    const scroller = findScroller(el);

    if (!scroller) {
      return;
    }

    // Offset within the scroller's content, not the viewport -- the scroller is
    // itself positioned below the app header.
    const top =
      el.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop;

    if (scroller.scrollTop <= top - MARGIN) {
      return;
    }

    scroller.scrollTo({
      top: Math.max(0, top - MARGIN),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  });
}
