<script lang="ts" setup>
import type { RangeCalendarGridHeadProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { RangeCalendarGridHead } from "reka-ui"

const props = defineProps<RangeCalendarGridHeadProps & { class?: HTMLAttributes["class"] }>()
</script>

<template>
  <RangeCalendarGridHead v-bind="props">
    <slot />
  </RangeCalendarGridHead>
</template>
