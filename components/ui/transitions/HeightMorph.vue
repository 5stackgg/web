<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from "vue";

// Tweens this wrapper's height across a DOM change it does not control.
//
// Step stacks that swap v-show panels (which must stay mounted so their form
// state survives) can never use HeightSwap -- its enter/leave hooks need the
// branches to mount and unmount. This watches a state key instead: freeze at
// the old height just before the update, measure the new layout just after,
// ease between, release to auto. It is also position:relative on purpose, so
// a panel leaving with `position: absolute` stays inside it while the height
// glides underneath.
//
// Height is measured as the sum of in-flow children -- an absolutely
// positioned leaver still bulges scrollHeight, which would make a shrinking
// swap chase the wrong number.
const props = defineProps<{ state: string | number }>();

const shell = ref<HTMLElement | null>(null);
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

function contentHeight(el: HTMLElement) {
  return Array.from(el.children)
    .filter((child) => getComputedStyle(child).position !== "absolute")
    .reduce((total, child) => total + (child as HTMLElement).offsetHeight, 0);
}

watch(
  () => props.state,
  async () => {
    const el = shell.value;

    if (!el) {
      return;
    }

    if (releaseTimer) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
    }

    el.style.height = `${el.getBoundingClientRect().height}px`;
    el.classList.add("height-morph-animating");

    await nextTick();

    el.style.height = `${contentHeight(el)}px`;

    releaseTimer = setTimeout(() => {
      el.style.height = "";
      el.classList.remove("height-morph-animating");
      releaseTimer = null;
    }, 280);
  },
);

onBeforeUnmount(() => {
  if (releaseTimer) {
    clearTimeout(releaseTimer);
  }
});
</script>

<template>
  <div ref="shell" class="relative">
    <slot />
  </div>
</template>

<style scoped>
.height-morph-animating {
  overflow: hidden;
  transition: height 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
@media (prefers-reduced-motion: reduce) {
  .height-morph-animating {
    transition-duration: 1ms;
  }
}
</style>
