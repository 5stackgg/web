<script setup lang="ts">
interface Props {
  delay?: number
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  delay: 0,
  duration: 600
})

const delayClass = computed(() => props.delay ? `delay-${props.delay}` : '')
</script>

<template>
  <Transition
    appear
    :enter-active-class="`transition-all duration-${duration} ease-out ${delayClass}`"
    enter-from-class="opacity-0 translate-y-5"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-600 ease-out"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-5"
  >
    <slot />
  </Transition>
</template>
