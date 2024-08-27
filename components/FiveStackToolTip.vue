<script lang="ts" setup>
import { Info } from "lucide-vue-next";
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger as-child>
        <Info :size="12"></Info>
      </TooltipTrigger>
      <TooltipContent>
         <slot></slot>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>