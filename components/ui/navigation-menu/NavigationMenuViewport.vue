<script setup lang="ts">
import type { NavigationMenuViewportProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import {
  NavigationMenuViewport,
  useForwardProps,
} from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<NavigationMenuViewportProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <div class="absolute left-0 top-full flex justify-center">
    <NavigationMenuViewport
      v-bind="forwardedProps"
      :class="
        cn(
          'origin-top-center relative mt-1.5 h-[--reka-navigation-menu-viewport-height] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow [transition:width_200ms_ease-out,height_200ms_ease-out,left_200ms_ease-out] motion-reduce:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out motion-safe:data-[state=closed]:zoom-out-95 motion-safe:data-[state=open]:zoom-in-90 md:w-[--reka-navigation-menu-viewport-width] left-[var(--reka-navigation-menu-viewport-left)]',
          props.class,
        )
      "
    />
  </div>
</template>
