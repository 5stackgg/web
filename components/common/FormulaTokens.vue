<script lang="ts" setup>
import { Boxes, TriangleRight } from "lucide-vue-next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  tokenizeFormula,
  tokenKey,
  MESH_TOKENS,
} from "~/utilities/statFormula";

defineProps<{ text: string }>();
</script>

<template>
  <TooltipProvider :delay-duration="100">
    <template v-for="(seg, i) in tokenizeFormula(text)" :key="i">
      <template v-if="seg.v">
        <Tooltip>
          <TooltipTrigger as-child>
            <abbr
              v-if="seg.v === 'θ'"
              class="cursor-help text-[hsl(var(--tac-amber))] no-underline"
            >
              <TriangleRight class="inline-block h-4 w-4 align-text-bottom" />
            </abbr>
            <abbr
              v-else
              class="cursor-help underline decoration-dotted decoration-muted-foreground/70 underline-offset-2 hover:decoration-foreground"
              >{{ seg.t }}</abbr
            >
          </TooltipTrigger>
          <TooltipContent>{{
            $t(`glossary.var_help.${tokenKey(seg.v)}`)
          }}</TooltipContent>
        </Tooltip>
        <Tooltip v-if="MESH_TOKENS.has(seg.v)">
          <TooltipTrigger as-child>
            <span
              class="ml-0.5 inline-flex cursor-help items-center align-middle text-[hsl(var(--tac-amber))]"
            >
              <Boxes class="h-3 w-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{{ $t("glossary.mesh_help") }}</TooltipContent>
        </Tooltip>
      </template>
      <span v-else>{{ seg.t }}</span>
    </template>
  </TooltipProvider>
</template>
