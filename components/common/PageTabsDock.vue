<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { injectTabsRootContext } from "reka-ui";

// A page's tab strip that docks under the top bar once it's scrolled past (md
// and up), with a band behind it only while docked. Keep it the first child of
// the element holding the sections: that element is how long it stays docked,
// and its top is where a tab switch lands while docked.
const tabs = injectTabsRootContext();
const dock = ref<HTMLElement | null>(null);
const band = ref<HTMLElement | null>(null);
const docked = ref(false);
let scroller: HTMLElement | null = null;
let frame = 0;
let scrollPadding = "";

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

// Distance between the scroller's top edge and where the dock sticks.
function stickTop(el: HTMLElement) {
  return parseFloat(getComputedStyle(el).top) || 0;
}

function scrollerTop(el: HTMLElement) {
  return el === document.scrollingElement ? 0 : el.getBoundingClientRect().top;
}

// Where the scroller sits with the sections' top at the docking line.
function sectionsTop(el: HTMLElement, from: HTMLElement) {
  return (
    from.scrollTop +
    el.parentElement!.getBoundingClientRect().top -
    scrollerTop(from) -
    stickTop(el)
  );
}

// Anything the scroller brings into view (an opened match row, the roster)
// lands below the docked strip instead of under it.
function setScrollPadding(value: string) {
  if (scroller && value !== scrollPadding) {
    scrollPadding = value;
    scroller.style.scrollPaddingTop = value;
  }
}

// Looked up when needed: a page can mount before it's attached under the
// app's scroller (page transitions), which would find the document instead.
function resolveScroller() {
  const el = dock.value;
  if (el?.isConnected && !scroller?.contains(el)) {
    setScrollPadding("");
    scroller = findScroller(el);
  }
  return scroller;
}

function measure() {
  frame = 0;
  const el = dock.value;
  resolveScroller();
  if (!el || !scroller || getComputedStyle(el).position !== "sticky") {
    docked.value = false;
    setScrollPadding("");
    return;
  }
  const top = stickTop(el);
  const rect = el.getBoundingClientRect();
  docked.value = rect.top - scrollerTop(scroller) <= top + 0.5;
  const bottom = band.value?.getBoundingClientRect().bottom ?? rect.bottom;
  setScrollPadding(`${top + bottom - rect.top}px`);
}

function schedule() {
  if (!frame) {
    frame = requestAnimationFrame(measure);
  }
}

// Switching sections while docked starts the new one at its top and the strip
// stays put. Tabs has already reserved the page's height (useScrollFloor), so a
// shorter section can't pull the strip loose.
watch(
  () => tabs.modelValue.value,
  () => {
    const el = dock.value;
    resolveScroller();
    if (docked.value && el?.parentElement && scroller) {
      scroller.scrollTop = sectionsTop(el, scroller);
    }
  },
);

// Glides the strip up to where it docks, the sections starting under it.
function reveal() {
  const el = dock.value;
  resolveScroller();
  if (el?.parentElement && scroller) {
    scroller.scrollTo({ top: sectionsTop(el, scroller), behavior: "smooth" });
  }
}
defineExpose({ reveal });

// Scroll doesn't bubble, so listen in the capture phase for whichever
// scroller ends up holding the strip.
const scrollOptions = { capture: true, passive: true } as const;

onMounted(() => {
  document.addEventListener("scroll", schedule, scrollOptions);
  window.addEventListener("resize", schedule);
  schedule();
});

onBeforeUnmount(() => {
  document.removeEventListener("scroll", schedule, scrollOptions);
  window.removeEventListener("resize", schedule);
  if (frame) {
    cancelAnimationFrame(frame);
  }
  setScrollPadding("");
});
</script>

<template>
  <div
    ref="dock"
    class="relative md:sticky md:top-2 md:z-20"
    :data-docked="docked || undefined"
  >
    <div
      ref="band"
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 -inset-y-2 -z-10 border-b border-border bg-background/90 backdrop-blur transition-opacity duration-150 ease-out"
      :class="docked ? 'opacity-100' : 'opacity-0'"
    />
    <slot />
  </div>
</template>
