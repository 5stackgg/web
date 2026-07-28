<script lang="ts" setup>
import { computed } from "vue";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

const props = defineProps<{
  index: number | null;
  source?: string | null;
}>();

// Distinct hues rather than theme tokens: the badge's only job is to say
// "these players are the same group", so the colours must read as unrelated
// to each other and to the surrounding UI. Cycles if a match ever has more
// parties than colours.
const PARTY_HUES = [199, 152, 47, 280, 12];

const hue = computed(() => PARTY_HUES[(props.index ?? 0) % PARTY_HUES.length]);

const label = computed(() => {
  switch (props.source) {
    case "lobby":
      return "match.party.queued_lobby";
    case "valve":
      return "match.party.queued_valve";
    case "faceit":
      return "match.party.queued_faceit";
    default:
      return "match.party.queued";
  }
});
</script>

<template>
  <TooltipProvider v-if="index !== null">
    <Tooltip>
      <TooltipTrigger as-child>
        <span
          class="inline-flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-[3px] px-1 text-[9px] font-semibold leading-none tabular-nums"
          :style="{
            backgroundColor: `hsl(${hue} 70% 50% / 0.18)`,
            color: `hsl(${hue} 70% 62%)`,
            boxShadow: `inset 0 0 0 1px hsl(${hue} 70% 50% / 0.45)`,
          }"
        >
          {{ index + 1 }}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {{ $t(label) }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
