import { ref, onMounted, onBeforeUnmount, watch } from "vue";

// Prevents the jarring "shove to top" when page content shrinks — a filter trims
// a long match list, a tab swaps a tall panel for a short one. We pin a
// `min-height` on the page content wrapper equal to the height needed to keep
// the user's current scroll valid, applied SYNCHRONOUSLY before the shrink
// renders so the browser can't clamp the scroll upward. As the user scrolls
// back up the floor ratchets down, collapsing the reserved space naturally.
//
// One shared floor for the whole page, anchored by the layout: many tab strips
// only wrap the triggers and render their content as a sibling, so a per-widget
// floor would sit on an element that never shrinks. The page wrapper always
// contains whatever changed.
const minHeight = ref(0);
const rootEl = ref<HTMLElement | null>(null);
let scroller: HTMLElement | null = null;
let listenTarget: HTMLElement | Window | null = null;
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
  // Outside the default layout the document itself scrolls.
  return (document.scrollingElement as HTMLElement | null) ?? null;
}

// The root height required to keep the user's current view bottom valid: its
// current height, less whatever slack is still below the fold. At the very
// bottom of the scroll that's exactly "don't get any shorter".
function neededHeight(): number {
  if (!rootEl.value || !scroller) {
    return 0;
  }
  return (
    rootEl.value.offsetHeight +
    (scroller.scrollTop + scroller.clientHeight - scroller.scrollHeight)
  );
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

function attach() {
  if (!rootEl.value || listenTarget) {
    return;
  }
  scroller = findScroller(rootEl.value);
  if (!scroller) {
    return;
  }
  // Scroll events on the scrolling element are dispatched at the document.
  listenTarget = scroller === document.scrollingElement ? window : scroller;
  listenTarget.addEventListener("scroll", onScroll, { passive: true });
}

function detach() {
  listenTarget?.removeEventListener("scroll", onScroll);
  listenTarget = null;
  scroller = null;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function reset() {
  floor = 0;
  minHeight.value = 0;
}

// Call right before a change that may shrink page content.
function capture() {
  if (!rootEl.value) {
    return;
  }
  if (!listenTarget) {
    attach();
  }
  // At the top of the scroll there is nothing to clamp, so no floor is needed.
  if (!scroller || scroller.scrollTop <= 0) {
    return;
  }
  floor = Math.max(floor, neededHeight());
  minHeight.value = floor > 0 ? floor : 0;
}

export function useScrollFloor() {
  return { capture, reset };
}

// Used once, by the layout that owns the page content wrapper. Bind `rootEl` as
// a template ref on that wrapper and `minHeight` as its inline min-height.
export function useScrollFloorAnchor(routeKey?: () => unknown) {
  onMounted(attach);
  onBeforeUnmount(() => {
    detach();
    reset();
  });
  // A new page starts with a clean slate — the old page's reserved height is
  // meaningless and would leave dead space at the bottom.
  if (routeKey) {
    watch(routeKey, reset);
  }
  return { minHeight, rootEl };
}
