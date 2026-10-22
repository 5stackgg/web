import { onBeforeUnmount, reactive, watch, type Ref } from "vue";

// HorizontalScrollRow's scroll state and whole-card paging, for a row that
// can't be one (its own snap and scrollbar, or a layout that turns vertical).
export function useScrollArrows(row: Ref<HTMLElement | null | undefined>) {
  const state = reactive({
    canScrollLeft: false,
    canScrollRight: false,
  });

  function update() {
    const el = row.value;
    if (!el) return;
    state.canScrollLeft = el.scrollLeft > 4;
    state.canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
  }

  function scrollByDirection(direction: "left" | "right") {
    const el = row.value;
    if (!el) return;
    let amount = el.clientWidth * 0.85;
    const first = el.children[0] as HTMLElement | undefined;
    if (first) {
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const pitch = first.offsetWidth + gap;
      if (pitch > 0) {
        amount = Math.max(1, Math.floor(el.clientWidth / pitch)) * pitch;
      }
    }
    el.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    });
  }

  let resizeObserver: ResizeObserver | null = null;
  let mutationObserver: MutationObserver | null = null;

  function detach(el?: HTMLElement | null) {
    el?.removeEventListener("scroll", update);
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
  }

  watch(
    row,
    (el, previous) => {
      detach(previous);
      if (!el) return;
      el.addEventListener("scroll", update, { passive: true });
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(update);
        resizeObserver.observe(el);
      }
      if (typeof MutationObserver !== "undefined") {
        mutationObserver = new MutationObserver(update);
        mutationObserver.observe(el, { childList: true });
      }
      update();
    },
    { immediate: true, flush: "post" },
  );

  onBeforeUnmount(() => detach(row.value));

  return { state, scrollByDirection };
}
