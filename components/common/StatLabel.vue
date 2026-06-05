<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

const props = withDefaults(
  defineProps<{
    stat: string;
    label?: string;
    side?: string;
  }>(),
  { side: "top" },
);

const { t, te } = useI18n();

const hasEntry = computed(() => te(`stat_glossary.${props.stat}.description`));
const title = computed(() =>
  hasEntry.value ? t(`stat_glossary.${props.stat}.label`) : (props.label ?? ""),
);
const description = computed(() =>
  hasEntry.value ? t(`stat_glossary.${props.stat}.description`) : "",
);
const text = computed(() => props.label ?? title.value ?? props.stat);
</script>

<template>
  <FiveStackToolTip v-if="hasEntry" as-child :side="side" :delay-duration="120">
    <template #trigger>
      <span
        class="cursor-help underline decoration-dotted decoration-muted-foreground/70 underline-offset-[3px] transition-colors hover:decoration-foreground"
      >
        <slot>{{ text }}</slot>
      </span>
    </template>
    <div class="max-w-[220px] space-y-0.5">
      <div
        class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-foreground"
      >
        {{ title }}
      </div>
      <div class="text-xs leading-snug text-muted-foreground">
        {{ description }}
      </div>
    </div>
  </FiveStackToolTip>
  <span v-else><slot>{{ text }}</slot></span>
</template>
