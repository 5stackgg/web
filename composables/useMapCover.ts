import { onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import { useResizeObserver } from "@vueuse/core";
import {
  NO_MAP_INSETS,
  mapCover,
  type MapBox,
  type MapInsets,
} from "~/utilities/mapGestures";

// The part of the window `element` could be seen in if nothing were drawn
// over it: the window, cut down by every ancestor that clips what scrolls
// out of it.
function clearBox(element: HTMLElement): MapBox {
  const box = {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  };
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent);
    const clips = [style.overflowX, style.overflowY].some(
      (overflow) => !!overflow && overflow !== "visible",
    );
    if (!clips) {
      continue;
    }
    const rect = parent.getBoundingClientRect();
    const left = rect.left + parent.clientLeft;
    const top = rect.top + parent.clientTop;
    box.left = Math.max(box.left, left);
    box.top = Math.max(box.top, top);
    box.right = Math.min(box.right, left + parent.clientWidth);
    box.bottom = Math.min(box.bottom, top + parent.clientHeight);
  }
  return box;
}

// Whatever is still carrying `element` to where it will sit: the page sliding
// in, or the board growing out of the tile it was picked from. Its box is
// wherever that has got to, which is not where it will be.
function arriving(element: HTMLElement): Animation[] {
  return (document.getAnimations?.() ?? []).filter((animation) => {
    const target = (animation.effect as KeyframeEffect | null)?.target;
    return (
      !!target &&
      target.contains(element) &&
      animation.playState !== "finished" &&
      animation.playState !== "idle"
    );
  });
}

/**
 * How much of a map's frame is hidden under something drawn over it from
 * below -- a sheet -- and by the edges of whatever the page scrolls in.
 *
 * `coveredFrom` is that thing's top edge down the window, or null for
 * nothing over the map at all, in which case nothing is measured either. It
 * is read where the frame really is, and again whenever that can have
 * changed: the edge moving, the window resizing, the page scrolling. Never
 * per move of a finger.
 */
export function useMapCover(options: {
  frame: () => HTMLElement | null | undefined;
  coveredFrom: () => number | null | undefined;
}) {
  const cover = shallowRef<MapInsets>(NO_MAP_INSETS);

  function set(next: MapInsets) {
    const now = cover.value;
    if (
      now.top !== next.top ||
      now.right !== next.right ||
      now.bottom !== next.bottom ||
      now.left !== next.left
    ) {
      cover.value = next;
    }
  }

  function measure() {
    const element = options.frame();
    const from = options.coveredFrom();
    if (!element || from === null || from === undefined) {
      set(NO_MAP_INSETS);
      return;
    }
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) {
      set(NO_MAP_INSETS);
      return;
    }
    const moving = arriving(element);
    if (moving.length) {
      void Promise.allSettled(
        moving.map((animation) => animation.finished),
      ).then(measureSoon);
    }
    const clear = clearBox(element);
    const insets = mapCover(box, {
      ...clear,
      bottom: Math.min(clear.bottom, from),
    });
    set({
      top: Math.round(insets.top),
      right: Math.round(insets.right),
      bottom: Math.round(insets.bottom),
      left: Math.round(insets.left),
    });
  }

  let pending = 0;

  function measureSoon() {
    if (!pending) {
      pending = requestAnimationFrame(() => {
        pending = 0;
        measure();
      });
    }
  }

  // Scroll events do not bubble, so every scroller is heard at the window on
  // the way down. Only one the frame is inside can have moved it.
  function onScroll(event: Event) {
    const element = options.frame();
    const scrolled = event.target;
    if (
      element &&
      (scrolled === document ||
        (scrolled instanceof Node && scrolled.contains(element)))
    ) {
      measureSoon();
    }
  }

  onMounted(() => {
    window.addEventListener("resize", measureSoon);
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
  });

  onBeforeUnmount(() => {
    window.removeEventListener("resize", measureSoon);
    window.removeEventListener("scroll", onScroll, { capture: true });
    cancelAnimationFrame(pending);
  });

  useResizeObserver(() => options.frame() ?? null, measureSoon);

  watch([options.frame, options.coveredFrom], measure, {
    flush: "post",
    immediate: true,
  });

  return { cover, measure };
}
