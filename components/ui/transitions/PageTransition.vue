<script setup lang="ts">
interface Props {
  delay?: number
  /**
   * Swapping one thing for another in the same slot -- a skeleton for the
   * content it stood in for. Without this the outgoing and incoming halves run
   * at the same time, so a 20px slide up crosses a 20px slide down for half a
   * second, which is the janky part. A swap is a short cross-fade with the old
   * half fully gone before the new one starts.
   */
  swap?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  delay: 0,
  swap: false,
})

const enterActive =
  "transition-[opacity,transform] [transition-duration:520ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] will-change-[opacity,transform] motion-reduce:![transition-duration:1ms] motion-reduce:![transition-delay:0ms]"

// Opacity only, and quick: a skeleton is already the right shape and size, so
// moving it on the way out only advertises that it was a placeholder.
const swapActive =
  "transition-opacity [transition-duration:180ms] ease-out will-change-[opacity] motion-reduce:![transition-duration:1ms] motion-reduce:![transition-delay:0ms]"

function setEnterDelay(el: Element) {
  if (!props.delay) {
    return
  }

  ;(el as HTMLElement).style.transitionDelay = `${props.delay}ms`
}

function clearEnterDelay(el: Element) {
  ;(el as HTMLElement).style.transitionDelay = ""
}
</script>

<template>
  <Transition
    appear
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
