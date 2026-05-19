<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div :class="cn('p-1 pt-0 sm:p-6 sm:pt-0', props.class)">
    <slot />
  </div>
</template>
