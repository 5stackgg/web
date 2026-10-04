<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { TeamResult } from "~/utilities/teamResults";

const props = withDefaults(
  defineProps<{
    // Oldest -> newest.
    form: TeamResult[];
    slots?: number;
  }>(),
  { slots: 5 },
);

const { t } = useI18n();

const cells = computed(() => {
  const recent = props.form.slice(-props.slots);
  return [
    ...Array<TeamResult | null>(props.slots - recent.length).fill(null),
    ...recent,
  ];
});

const label = computed(() =>
  props.form.length
    ? t("pages.teams.form.label", {
        results: props.form
          .slice(-props.slots)
          .map((r) => t(`pages.teams.form.result_${r}`))
          .join(", "),
      })
    : t("pages.teams.form.none"),
);

const TONES: Record<TeamResult, string> = {
  W: "bg-success/15 text-success shadow-[inset_0_0_0_1px_hsl(var(--success)/0.35)]",
  L: "bg-destructive/10 text-destructive shadow-[inset_0_0_0_1px_hsl(var(--destructive)/0.3)]",
  T: "bg-muted text-muted-foreground",
};
</script>

<template>
  <span
    role="img"
    :aria-label="label"
    class="inline-flex items-center gap-[3px]"
  >
    <span
      v-for="(result, i) in cells"
      :key="i"
      aria-hidden="true"
      class="inline-grid size-4 place-items-center rounded-[3px] text-[0.6rem] font-extrabold leading-none"
      :class="result ? TONES[result] : 'bg-muted/40'"
      >{{ result ?? "" }}</span
    >
  </span>
</template>
