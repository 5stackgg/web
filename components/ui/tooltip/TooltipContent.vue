<script setup lang="ts">
import type { TooltipContentEmits, TooltipContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TooltipContent, useForwardPropsEmits } from "reka-ui"
import { cn } from "@/lib/utils"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<TooltipContentProps & { class?: HTMLAttributes["class"] }>(), {
  sideOffset: 4,
})

const emits = defineEmits<TooltipContentEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <TooltipContent v-bind="{ ...forwarded, ...$attrs }" :class="cn('relative z-50 max-w-xs overflow-hidden border border-border bg-[hsl(var(--card)/0.97)] backdrop-blur-md pl-3 pr-3 py-2 text-xs leading-snug text-foreground shadow-[0_8px_24px_-8px_hsl(var(--background)/0.8),0_0_0_1px_hsl(var(--tac-amber)/0.08)] before:content-[\'\'] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-[hsl(var(--tac-amber))] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1', props.class)">
    <slot />
  </TooltipContent>
</template>
