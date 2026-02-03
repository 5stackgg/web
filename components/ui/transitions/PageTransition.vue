<script setup lang="ts">
interface Props {
  delay?: number
}

const props = withDefaults(defineProps<Props>(), {
  delay: 0
})

// Map delay values to Tailwind delay classes
const delayClass = computed(() => {
  switch (props.delay) {
    case 100: return 'delay-100'
    case 200: return 'delay-200'
    case 300: return 'delay-300'
    case 500: return 'delay-500'
    default: return ''
  }
})
</script>

<template>
  <Transition
    appear
    :enter-active-class="`transition-all duration-600 ease-out ${delayClass}`"
    enter-from-class="opacity-0 translate-y-5"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-600 ease-out"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-5"
  >
    <slot />
  </Transition>
</template>
