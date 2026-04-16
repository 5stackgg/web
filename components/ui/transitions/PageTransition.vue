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
    enter-active-class="page-transition-enter-active"
    enter-from-class="page-transition-enter-from"
    enter-to-class="page-transition-enter-to"
    leave-active-class="page-transition-leave-active"
    leave-from-class="page-transition-leave-from"
    leave-to-class="page-transition-leave-to"
    @before-enter="setEnterDelay"
    @after-enter="clearEnterDelay"
    @enter-cancelled="clearEnterDelay"
  >
    <slot />
  </Transition>
</template>

<style>
.page-transition-enter-active,
.page-transition-leave-active {
  transition-property: opacity, transform;
  transition-duration: 520ms;
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform;
}

.page-transition-enter-from {
  opacity: 0;
  transform: translate3d(0, 1.25rem, 0);
}

.page-transition-enter-to,
.page-transition-leave-from {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}

.page-transition-leave-to {
  opacity: 0;
  transform: translate3d(0, -1.25rem, 0);
}

@media (prefers-reduced-motion: reduce) {
  .page-transition-enter-active,
  .page-transition-leave-active {
    transition-duration: 1ms;
    transition-delay: 0ms !important;
  }

  .page-transition-enter-from,
  .page-transition-enter-to,
  .page-transition-leave-from,
  .page-transition-leave-to {
    transform: none;
  }
}
</style>
