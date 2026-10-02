<script setup lang="ts">
import type { TooltipContentEmits, TooltipContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TooltipArrow, TooltipContent, TooltipPortal, useForwardPropsEmits } from "reka-ui"
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
  <TooltipPortal>
    <TooltipContent v-bind="{ ...forwarded, ...$attrs }" :class="cn('relative z-50 max-w-xs whitespace-normal break-words rounded-md border border-white/[0.09] bg-[#0c0c0f] px-2.5 py-1.5 text-xs leading-[1.4] text-foreground shadow-[0_12px_28px_-10px_rgba(0,0,0,0.9)] animate-in fade-in-0 [animation-duration:120ms] [animation-timing-function:cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:[animation-duration:80ms] data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1', props.class)">
      <slot />
      <TooltipArrow :width="12" :height="6">
        <path d="M0 0L6 6L12 0" class="fill-[#0c0c0f] stroke-white/[0.09]" />
      </TooltipArrow>
    </TooltipContent>
  </TooltipPortal>
</template>
