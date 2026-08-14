<script setup lang="ts">
import { ref } from "vue";

// Swaps mutually-exclusive states whose sizes differ: the leaving side fades
// where it stands (110ms), then the shell eases to the entering side's
// measured size while it fades in (240ms). Extracted from VoiceChannelCard's
// join/leave swap. The shell never leaves the layout, so surrounding flex
// gaps hold still for the whole trade; it is px-to-px, so there is no moment
// where both states occupy space; and it rests at auto, unclipped, so content
// is free to grow on its own between swaps. Slot branches must carry stable
// :key values.
//
// Not FadeSwap: that pulls the leaver out of flow and expects the two states
// to be the same height. This one exists precisely because the heights are
// not.
const props = withDefaults(
  defineProps<{
    // Which dimension the swap measures. "x" tweens width instead -- for
    // horizontal slots, like a nav bar trading a wide button for a row.
    axis?: "y" | "x";
  }>(),
  { axis: "y" },
);

// Fired when an entering side has fully landed (the moment the shell lets go
// of its height) -- for parents that stage further reveals on the swap.
const emit = defineEmits<{ settled: [] }>();

const shell = ref<HTMLElement | null>(null);

function freeze() {
  const el = shell.value;

  if (!el) {
    return;
  }

  const rect = el.getBoundingClientRect();

  if (props.axis === "x") {
    el.style.width = `${rect.width}px`;
  } else {
    el.style.height = `${rect.height}px`;
  }

  el.classList.add("height-swap-animating");
}

function tween(entering: Element) {
  const el = shell.value;

  if (!el) {
    return;
  }

  const target = entering as HTMLElement;

  if (props.axis === "x") {
    el.style.width = `${target.offsetWidth}px`;
  } else {
    el.style.height = `${target.offsetHeight}px`;
  }
}

function release() {
  const el = shell.value;

  if (!el) {
    return;
  }

  el.style.height = "";
  el.style.width = "";
  el.classList.remove("height-swap-animating");
}

function settle() {
  release();
  emit("settled");
}

// The slot is allowed to resolve to nothing (a v-if ladder between states).
// When a leave ends with no enter behind it, tween the shell to zero and stay
// frozen there -- the next branch's enter picks the tween up from zero and its
// after-enter releases. Checked a frame later because out-in inserts the
// entering element right after this hook when there is one.
function collapseIfEmpty() {
  requestAnimationFrame(() => {
    const el = shell.value;

    if (!el || el.childElementCount > 0) {
      return;
    }

    if (props.axis === "x") {
      el.style.width = "0px";
    } else {
      el.style.height = "0px";
    }
  });
}
</script>

<template>
  <div ref="shell">
    <Transition
      mode="out-in"
      enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
      leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
      enter-from-class="opacity-0 translate-y-1"
      leave-to-class="opacity-0"
      @before-leave="freeze"
      @leave-cancelled="release"
      @after-leave="collapseIfEmpty"
      @before-enter="freeze"
      @enter="tween"
      @after-enter="settle"
      @enter-cancelled="release"
    >
      <slot />
    </Transition>
  </div>
</template>

<style scoped>
/* Only while the two states trade places: the tween and the clipping both end
   at rest, so nothing has a ceiling to outgrow between swaps and nothing
   drawn outside the box (rings, shadows) is ever cut off. */
.height-swap-animating {
  overflow: hidden;
  transition:
    height 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    width 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
@media (prefers-reduced-motion: reduce) {
  .height-swap-animating {
    transition-duration: 1ms;
  }
}
</style>
