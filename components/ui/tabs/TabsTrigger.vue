<script setup lang="ts">
import type { TabsTriggerProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TabsTrigger, useForwardProps } from "reka-ui"
import { inject, ref } from "vue"
import { cn } from "@/lib/utils"
import { type TabsListVariant, tabsListVariantKey } from "."

const props = defineProps<TabsTriggerProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")

const forwardedProps = useForwardProps(delegatedProps)

const variant = inject(tabsListVariantKey, ref<TabsListVariant>("default"))

// Phones: a 40px cell in the list's 4-wide grid, its label up to two lines.
// Wider: segments sharing the row, wrapping when they run out of room.
const trackClasses = "h-10 min-w-0 px-1 text-xs [@media(hover:hover)]:hover:text-foreground md:h-[38px] md:flex-[1_0_auto] md:px-3.5 md:text-sm"
const trackLabelClasses = "max-md:line-clamp-2 max-md:whitespace-normal max-md:text-center max-md:leading-tight"
</script>

<template>
  <TabsTrigger
    v-bind="forwardedProps"
    :class="cn(
      'relative z-[1] inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground',
      variant === 'track' && trackClasses,
      props.class,
    )"
  >
    <span
      class="truncate"
      :class="variant === 'track' && trackLabelClasses"
    >
      <slot />
    </span>
  </TabsTrigger>
</template>
