<script lang="ts" setup>
import { Info } from "lucide-vue-next";
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger type="button">
        <div class="flex items-center gap-2">
          <slot name="trigger">
            <Info :size="size" v-bind="$attrs"> </Info>
          </slot>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <slot></slot>
      </TooltipContent>
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
  },
};
</script>
