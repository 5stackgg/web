<script lang="ts" setup>
import { Info } from "lucide-vue-next";
import { TooltipPortal } from "reka-ui";
</script>

<template>
  <TooltipProvider
    :ignoreNonKeyboardFocus="true"
    :delay-duration="delayDuration"
  >
    <Tooltip>
      <TooltipTrigger v-if="asChild" as-child>
        <slot name="trigger">
          <Info :size="size" v-bind="$attrs"> </Info>
        </slot>
      </TooltipTrigger>
      <TooltipTrigger v-else type="button">
        <slot name="trigger">
          <Info :size="size" v-bind="$attrs"> </Info>
        </slot>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent :side="side" :align="align" :collision-padding="8">
          <slot></slot>
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  </TooltipProvider>
</template>

<script lang="ts">
export default {
  inheritAttrs: false,
  props: {
    size: {
      type: Number,
      default: 12,
    },
    side: {
      type: String,
      required: false,
    },
    align: {
      type: String,
      required: false,
    },
    asChild: {
      type: Boolean,
      default: false,
    },
    delayDuration: {
      type: Number,
      default: 0,
    },
  },
};
</script>
