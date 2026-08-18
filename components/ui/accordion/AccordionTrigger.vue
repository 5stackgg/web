<script setup lang="ts">
import type { AccordionTriggerProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { AccordionHeader, AccordionTrigger, useForwardProps } from "reka-ui"
import { ChevronDown } from "lucide-vue-next"
import { cn } from "@/lib/utils"

const props = defineProps<AccordionTriggerProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <AccordionHeader class="flex">
    <AccordionTrigger
      v-bind="forwardedProps"
      :class="cn(
        'flex flex-1 items-center justify-between gap-4 py-4 text-left text-sm font-medium transition-colors hover:text-[hsl(var(--tac-amber))] [&[data-state=open]>svg]:rotate-180',
        props.class,
      )"
    >
      <slot />
      <ChevronDown
        class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
      />
    </AccordionTrigger>
  </AccordionHeader>
</template>
