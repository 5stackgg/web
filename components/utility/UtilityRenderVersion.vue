<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { utilityRenderIsOutdated } from "~/utilities/utilityRenderQueue";

const props = defineProps<{
  // What filmed it. 0 and null both mean it never said.
  version: number | null | undefined;
  // What the api expects; null while that is not known yet.
  expected: number | null | undefined;
}>();

const { t } = useI18n();

const outdated = computed(() =>
  utilityRenderIsOutdated(props.version, props.expected),
);

const hint = computed(() => {
  if (!outdated.value) {
    return null;
  }
  return props.version
    ? t("pages.utility.render_queue.version_outdated", {
        version: props.version,
        expected: props.expected,
      })
    : t("pages.utility.render_queue.version_unreported");
});
</script>

<template>
  <span
    data-render-version
    :data-outdated="outdated ? '' : undefined"
    class="font-mono normal-case tabular-nums tracking-normal"
    :class="
      outdated ? 'text-[hsl(var(--tac-amber))]' : 'text-muted-foreground/70'
    "
    :title="hint ?? undefined"
  >
    v{{ version ?? 0 }}
    <span v-if="hint" class="sr-only">{{ hint }}</span>
  </span>
</template>
