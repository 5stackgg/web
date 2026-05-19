<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useMatchSide, type MatchSide } from "~/composables/useMatchSide";

const props = defineProps<{
  matchSelect?: boolean;
}>();

const side = useMatchSide();
const { t } = useI18n();

const options = computed<{ value: MatchSide; label: string }[]>(() => [
  { value: "all", label: t("match.side_filter.all") },
  { value: "T", label: "T" },
  { value: "CT", label: "CT" },
]);

function setSide(value: MatchSide) {
  side.value = value;
}
</script>

<template>
  <div
    class="inline-flex items-stretch border border-border bg-[hsl(var(--card)/0.5)] rounded-sm overflow-hidden"
    :class="matchSelect ? 'h-9' : 'h-7'"
  >
    <button
      v-for="opt of options"
      :key="opt.value"
      type="button"
      class="font-mono text-[0.65rem] font-bold tracking-[0.2em] uppercase transition-colors"
      :class="[
        matchSelect ? 'px-3' : 'px-2.5',
        side === opt.value
          ? 'bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]'
          : 'text-muted-foreground hover:text-foreground',
      ]"
      @click="setSide(opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
