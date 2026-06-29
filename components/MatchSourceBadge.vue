<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

const { t } = useI18n();

const props = defineProps<{
  source?: string | null;
}>();

const visible = computed(() => !!props.source && props.source !== "5stack");

const labelMap: Record<string, string> = {
  valve: "VALVE",
  faceit: "FACEIT",
};

const label = computed(
  () => labelMap[props.source ?? ""] ?? (props.source ?? "").toUpperCase(),
);

const classes =
  "inline-flex items-center px-[0.45rem] py-[0.15rem] rounded font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] " +
  "border border-[hsl(200_95%_55%/0.45)] bg-[hsl(200_95%_55%/0.08)] text-[hsl(200_95%_60%)] " +
  "[text-shadow:0_0_10px_hsl(200_95%_55%/0.35)]";
</script>

<template>
  <FiveStackToolTip v-if="visible" as-child :delay-duration="120">
    <template #trigger>
      <span :class="classes">
        {{ label }}
      </span>
    </template>
    {{ t("match.source_badge.imported_external") }}
  </FiveStackToolTip>
</template>
