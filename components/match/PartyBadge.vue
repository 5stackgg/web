<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Users } from "lucide-vue-next";
import { partyColor } from "~/utilities/matchParties";
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

const color = computed(() => partyColor(props.index ?? 0));

const chipStyle = computed(() => ({
  backgroundColor: color.value.ring,
  color: "hsl(240 20% 8%)",
}));

const sourceLabel = computed(() => {
  switch (props.source) {
    case "lobby":
      return "match.party.queued_lobby";
    case "valve":
      return "match.party.queued_valve";
    default:
      return "match.party.queued";
  }
});

// The tooltip is pointer/focus only, so a screen reader needs the names here.
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
        <span
          class="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-sm shadow ring-1 ring-background"
          :style="chipStyle"
          :aria-label="accessibleLabel"
          tabindex="0"
        >
          <Users class="h-2.5 w-2.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" class="max-w-[220px]">
        <div
          class="font-mono text-[0.6rem] uppercase tracking-[0.18em]"
          :style="{ color: color.text }"
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
