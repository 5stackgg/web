<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

// Glides its height to follow its content, whatever resized it: a tab swap, a
// skeleton giving way to data, a list that grew. Whatever sits below moves
// with the tween instead of jumping.
//
// HeightMorph can't do this for reka tabs: it measures on the tick after its
// state key changes, but TabsContent hides the old panel and shows the new one
// a tick later (through Presence), so it measured the panel being left, held
// that height for the whole tween and then snapped. A ResizeObserver reports
// the real size whenever it lands, after layout and before paint, so the jump
// is replaced before it is ever drawn.
const DURATION_MS = 240;

const shell = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);

let height = 0;
let observer: ResizeObserver | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

function release() {
  releaseTimer = null;
  if (shell.value) {
    shell.value.style.height = "";
    shell.value.classList.remove("height-glide-animating");
  }
}

function glide(el: HTMLElement, to: number) {
  if (releaseTimer) {
    clearTimeout(releaseTimer);
  }
  // Mid-glide the shell is pinned, so its box is where the tween has got to.
  // At rest it is auto and has already taken the new size, so start from the
  // height the content had before this resize.
  const from = el.style.height ? el.getBoundingClientRect().height : height;
  el.classList.remove("height-glide-animating");
  el.style.height = `${from}px`;
  void el.offsetHeight;
  el.classList.add("height-glide-animating");
  el.style.height = `${to}px`;
  // A timer, not transitionend: a hidden tab never runs the transition.
  releaseTimer = setTimeout(release, DURATION_MS + 40);
}

onMounted(() => {
  if (!content.value) {
    return;
  }
  height = content.value.offsetHeight;
  observer = new ResizeObserver(() => {
    const el = shell.value;
    const next = content.value?.offsetHeight ?? 0;
    if (!el || next === height) {
      return;
    }
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      glide(el, next);
    }
    height = next;
  });
  observer.observe(content.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  if (releaseTimer) {
    clearTimeout(releaseTimer);
  }
});
</script>

<template>
  <div ref="shell">
    <div ref="content" class="flow-root">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.height-glide-animating {
  overflow: hidden;
  transition: height 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
