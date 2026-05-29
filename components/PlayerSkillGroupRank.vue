<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { csRankIcon } from "~/utilities/csRank";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    kind: "competitive" | "wingman";
    rank: number | null | undefined;
    updatedAt?: string | null;
    // Icon-only (no pill chrome / label) for dense rows.
    showLabel?: boolean;
  }>(),
  { showLabel: true },
);

const hasRank = computed(
  () => (props.rank ?? null) !== null && (props.rank as number) > 0,
);

const icon = computed(() =>
  csRankIcon(props.kind === "wingman" ? 6 : 7, props.rank ?? 0),
);

const label = computed(() => t(`pages.leaderboard.match_types.${props.kind}`));

const titleText = computed(() => {
  if (!hasRank.value) return "";
  const parts = [`${label.value}`];
  if (props.updatedAt) {
    parts.push(`as of ${new Date(props.updatedAt).toLocaleString()}`);
  }
  return parts.join(" • ");
});

// Same boxed pill chrome as ELO / RANK / FACEIT / PREMIER.
const wrapperClasses = [
  "inline-flex items-center gap-1.5 select-none leading-none font-sans",
  "h-[26px] px-[0.6rem] rounded border border-border bg-card/55",
  "[backdrop-filter:blur(6px)]",
].join(" ");

const sepClasses = "h-3 w-px bg-border/70 shrink-0";
</script>

<template>
  <img
    v-if="hasRank && icon && !showLabel"
    :src="icon"
    :alt="label"
    :title="titleText"
    class="h-6 w-auto shrink-0"
  />
  <span v-else-if="hasRank && icon" :class="wrapperClasses" :title="titleText">
    <img :src="icon" alt="" class="h-[18px] w-auto shrink-0" />
    <span :class="sepClasses" aria-hidden="true"></span>
    <span
      class="font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-muted-foreground"
      >{{ label }}</span
    >
  </span>
</template>
