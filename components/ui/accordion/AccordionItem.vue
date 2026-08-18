<script setup lang="ts">
import type { AccordionItemProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { AccordionItem, useForwardProps } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<AccordionItemProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <!-- Rule on the TOP edge, not the bottom: in a multi-column grid the last
       row is ragged, so trailing bottom borders leave stray rules hanging under
       whichever column ran out first -- and the final one collides with the
       section separator underneath. The consumer suppresses the first row's. -->
  <AccordionItem v-bind="forwardedProps" :class="cn('border-t border-border/60', props.class)">
    <slot />
  </AccordionItem>
</template>
