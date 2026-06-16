<script lang="ts" setup>
import { computed } from "vue";
import {
  ChevronsDown,
  ChevronDown,
  Minus,
  ChevronUp,
  ChevronsUp,
} from "lucide-vue-next";
import { STAT_SCALES, scoreToTier } from "~/utilities/statScales";

const props = withDefaults(
  defineProps<{
    stat: string;
    score?: number | null;
    showValues?: boolean;
  }>(),
  { score: null, showValues: true },
);

const TIERS = [
  { icon: ChevronsDown, cls: "text-destructive" },
  { icon: ChevronDown, cls: "text-destructive/70" },
  { icon: Minus, cls: "text-muted-foreground" },
  { icon: ChevronUp, cls: "text-success/80" },
  { icon: ChevronsUp, cls: "text-success" },
];

const scale = computed(() => STAT_SCALES[props.stat] ?? null);
const activeTier = computed(() => scoreToTier(props.score));
</script>

<template>
  <div
    v-if="scale"
    class="flex items-stretch gap-1"
    :title="$t('glossary.scale_hint')"
  >
    <div
      v-for="(tier, i) of TIERS"
      :key="i"
      class="flex flex-1 flex-col items-center gap-0.5 rounded px-1 py-0.5 transition-colors"
      :class="
        activeTier === i
          ? 'bg-foreground/10 ring-1 ring-foreground/30'
          : activeTier != null
            ? 'opacity-40'
            : ''
      "
    >
      <component
        :is="tier.icon"
        class="h-3.5 w-3.5 shrink-0"
        :class="tier.cls"
      />
      <span
        v-if="showValues"
        class="font-mono text-[0.62rem] tabular-nums leading-none"
        :class="activeTier === i ? 'text-foreground' : 'text-muted-foreground'"
        >{{ scale.steps[i] }}{{ scale.unit || "" }}</span
      >
    </div>
  </div>
</template>
