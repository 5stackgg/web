<script setup lang="ts">
interface Props {
  /**
   * Which beat of the page's entrance this block lands on: 0 with the page,
   * then 1, 2 and 3 for what follows. Every page runs on this one clock, so
   * no page arrives in a rhythm of its own.
   */
  step?: number
  /**
   * Swapping one thing for another in the same slot -- a skeleton for the
   * content it stood in for. Without this the outgoing and incoming halves run
   * at the same time, so a 20px slide up crosses a 20px slide down for half a
   * second, which is the janky part. A swap is a short cross-fade with the old
   * half fully gone before the new one starts.
   */
  swap?: boolean
  /**
   * Off when the page arranges its own arrival -- one that grows out of the
   * page before it, say -- and a slide on top of that would be two entrances.
   */
  appear?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  step: 0,
  swap: false,
  appear: true,
})

const STEP_MS = 60
const LAST_STEP = 3

// No will-change: the browser composites an opacity/transform transition by
// itself while it runs. Promoting each block up front, then dropping it as each
// staggered entrance ends, reshuffled Chrome's layers several times a second,
// and blocks already on screen blinked out while they were redrawn.
const enterActive =
  "transition-[opacity,transform] [transition-duration:520ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms] motion-reduce:![transition-delay:0ms]"

// Opacity only, and quick: a skeleton is already the right shape and size, so
// moving it on the way out only advertises that it was a placeholder.
const swapActive =
  "transition-opacity [transition-duration:180ms] ease-out motion-reduce:![transition-duration:1ms] motion-reduce:![transition-delay:0ms]"

function setEnterDelay(el: Element) {
  const step = Math.min(Math.max(props.step, 0), LAST_STEP)
  if (!step) {
    return
  }

  ;(el as HTMLElement).style.transitionDelay = `${step * STEP_MS}ms`
}

function clearEnterDelay(el: Element) {
  ;(el as HTMLElement).style.transitionDelay = ""
}
</script>

<template>
  <Transition
    :appear="appear"
    :mode="swap ? 'out-in' : undefined"
    :enter-active-class="swap ? swapActive : enterActive"
    :leave-active-class="swap ? swapActive : enterActive"
    :enter-from-class="
      swap ? 'opacity-0' : 'opacity-0 translate-y-5 motion-reduce:translate-y-0'
    "
    :leave-to-class="
      swap ? 'opacity-0' : 'opacity-0 -translate-y-5 motion-reduce:translate-y-0'
    "
    @before-enter="setEnterDelay"
    @after-enter="clearEnterDelay"
    @enter-cancelled="clearEnterDelay"
  >
    <slot />
  </Transition>
</template>
