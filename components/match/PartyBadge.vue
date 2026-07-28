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
  members?: string[];
}>();

// Deliberately off the tac-amber axis: amber is spoken for by "this is you"
// and the CTA treatment, so a party rail in amber would read as the wrong
// signal. These sit far enough apart in hue to be told apart at 3px wide.
const PARTY_HUES = [190, 152, 275, 350, 96];

const hue = computed(() => PARTY_HUES[(props.index ?? 0) % PARTY_HUES.length]);

const sourceLabel = computed(() => {
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
  <TooltipProvider v-if="index !== null" :delay-duration="150">
    <Tooltip>
      <TooltipTrigger as-child>
        <!-- Square ends, full row height: two party members on adjacent rows
             merge into one unbroken bar, which is the whole point. Rounding or
             insetting the ends would chop it into ticks. -->
        <span
          class="absolute left-[3px] top-0 bottom-0 z-10 w-[3px] cursor-help"
          :style="{
            backgroundColor: `hsl(${hue} 68% 52%)`,
            boxShadow: `0 0 6px hsl(${hue} 68% 52% / 0.55)`,
          }"
          :aria-label="$t(sourceLabel)"
        />
      </TooltipTrigger>
      <TooltipContent side="right" class="max-w-[220px]">
        <div
          class="font-mono text-[0.6rem] uppercase tracking-[0.18em]"
          :style="{ color: `hsl(${hue} 68% 62%)` }"
        >
          {{ $t(sourceLabel) }}
        </div>
        <div v-if="members?.length" class="mt-1 text-xs leading-relaxed">
          {{ members.join(", ") }}
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
