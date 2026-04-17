<script setup lang="ts">
interface Props {
  delay?: number
}

const props = withDefaults(defineProps<Props>(), {
  delay: 0
})

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
    enter-active-class="transition-[opacity,transform] [transition-duration:520ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] will-change-[opacity,transform] motion-reduce:![transition-duration:1ms] motion-reduce:![transition-delay:0ms]"
    leave-active-class="transition-[opacity,transform] [transition-duration:520ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] will-change-[opacity,transform] motion-reduce:![transition-duration:1ms] motion-reduce:![transition-delay:0ms]"
    enter-from-class="opacity-0 translate-y-5 motion-reduce:translate-y-0"
    leave-to-class="opacity-0 -translate-y-5 motion-reduce:translate-y-0"
    @before-enter="setEnterDelay"
    @after-enter="clearEnterDelay"
    @enter-cancelled="clearEnterDelay"
  >
    <slot />
  </Transition>
</template>
