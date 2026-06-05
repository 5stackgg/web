<script setup lang="ts">
import { reactive, ref, onMounted, onBeforeUnmount, nextTick } from "vue";

const props = withDefaults(
  defineProps<{
    // Minimum prefetch distance (px) from the right edge. The effective
    // threshold is the larger of this and `prefetchItems` worth of card
    // width — so on rows with bigger cards, the zone scales accordingly.
    prefetchThreshold?: number;
    // Trigger a prefetch when this many items are left to scroll past.
    // Measured against the first child's offsetWidth + gap.
    prefetchItems?: number;
  }>(),
  {
    prefetchThreshold: 320,
    prefetchItems: 5,
  },
);

const emit = defineEmits<{
  (e: "approaching-end"): void;
}>();

const scrollRef = ref<HTMLDivElement | null>(null);

const state = reactive({
  canScrollLeft: false,
  canScrollRight: false,
});

let approachingFired = false;

function effectivePrefetchThreshold(): number {
  const el = scrollRef.value;
  if (!el || el.children.length === 0) return props.prefetchThreshold;
  const firstChild = el.children[0] as HTMLElement;
  const itemWidth = firstChild.offsetWidth || 0;
  const gap = 12; // gap-3
  const dynamic = (itemWidth + gap) * props.prefetchItems;
  return Math.max(props.prefetchThreshold, dynamic);
}

function updateScrollState() {
  const el = scrollRef.value;
  if (!el) return;
  state.canScrollLeft = el.scrollLeft > 4;
  state.canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;

  const distanceToEnd = el.scrollWidth - (el.scrollLeft + el.clientWidth);
  const canActuallyScroll = el.scrollWidth > el.clientWidth + 4;
  const inPrefetchZone =
    canActuallyScroll && distanceToEnd <= effectivePrefetchThreshold();

  if (inPrefetchZone && !approachingFired) {
    approachingFired = true;
    emit("approaching-end");
  } else if (!inPrefetchZone) {
    approachingFired = false;
  }
}

function scrollByDirection(direction: "left" | "right") {
  const el = scrollRef.value;
  if (!el) return;
  // Scroll by a whole number of cards so the row always lands on a snap
  // point instead of leaving a sliver of the next card visible (which
  // looks broken on mobile where only ~1 card fits at a time).
  let amount = el.clientWidth * 0.85;
  const firstChild = el.children[0] as HTMLElement | undefined;
  if (firstChild) {
    const gap = 12; // gap-3
    const pitch = firstChild.offsetWidth + gap;
    if (pitch > 0) {
      const perPage = Math.max(1, Math.floor(el.clientWidth / pitch));
      amount = perPage * pitch;
    }
  }
  el.scrollBy({
    left: direction === "right" ? amount : -amount,
    behavior: "smooth",
  });
}

let resizeObserver: ResizeObserver | null = null;
let mutationObserver: MutationObserver | null = null;

onMounted(() => {
  nextTick(updateScrollState);
  const el = scrollRef.value;
  if (!el) return;
  el.addEventListener("scroll", updateScrollState, { passive: true });
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);
  }
  if (typeof MutationObserver !== "undefined") {
    mutationObserver = new MutationObserver(() => updateScrollState());
    mutationObserver.observe(el, { childList: true, subtree: true });
  }
});

onBeforeUnmount(() => {
  scrollRef.value?.removeEventListener("scroll", updateScrollState);
  resizeObserver?.disconnect();
  mutationObserver?.disconnect();
});

defineExpose({
  state,
  scrollByDirection,
});
</script>

<template>
  <!-- overscroll-x-contain stops a two-finger trackpad swipe (or pull-
       to-navigate on touch devices) from triggering history back/
       forward when the user reaches either scroll edge. -->
  <div
    ref="scrollRef"
    class="flex snap-x gap-3 overflow-x-auto overscroll-x-contain px-px pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
  >
    <slot />
  </div>
</template>
