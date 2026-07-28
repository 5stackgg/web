<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

const { t } = useI18n();

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

// The tooltip is pointer/focus only, so the party members go in the accessible
// name too — otherwise a screen reader gets a colour and nothing else.
const accessibleLabel = computed(() =>
  props.members?.length
    ? `${t(sourceLabel.value)}: ${props.members.join(", ")}`
    : t(sourceLabel.value),
);
</script>

<template>
  <TooltipProvider v-if="index !== null" :delay-duration="150">
    <Tooltip>
      <TooltipTrigger as-child>
        <!-- The visible mark is 3px, which is far too small to hover or tap, so
             the trigger is a wider transparent strip with the bar drawn inside
             it. Focusable so the tooltip is reachable without a pointer; the
             strip sits inside the cell's left padding so it does not swallow
             clicks meant for the row menu. -->
        <button
          type="button"
          class="group/party absolute left-0 top-0 bottom-0 z-10 flex w-[9px] cursor-help items-stretch outline-none"
          :aria-label="accessibleLabel"
        >
          <!-- Square ends, full row height: two party members on adjacent rows
               merge into one unbroken bar, which is the whole point. Rounding
               or insetting the ends would chop it into ticks. -->
          <span
            aria-hidden="true"
            class="ml-[3px] w-[3px] transition-[box-shadow] group-focus-visible/party:ring-2 group-focus-visible/party:ring-white/70"
            :style="{
              backgroundColor: `hsl(${hue} 68% 52%)`,
              boxShadow: `0 0 6px hsl(${hue} 68% 52% / 0.55)`,
            }"
          />
        </button>
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
