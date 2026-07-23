<script setup lang="ts">
import {
  tacticalSectionLabelClasses,
  tacticalSectionSeparatorClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// Standard section shell: the app-wide tick-and-label rule, no card frame and
// no repeated page title (the tab strip or page header already names it).
// `mb-0` drops the label util's own margin — this grid owns the spacing.
defineProps<{
  id?: string;
  label?: string;
  hint?: string;
}>();

defineEmits<{
  (e: "header-click"): void;
}>();
</script>

<template>
  <section
    :id="id"
    :class="['grid gap-4 scroll-mt-4', tacticalSectionSeparatorClasses]"
  >
    <div
      v-if="label || hint || $slots.action"
      class="flex items-end justify-between gap-4"
    >
      <div class="grid gap-1">
        <div v-if="label" :class="[tacticalSectionLabelClasses, 'mb-0']">
          <span :class="tacticalSectionTickClasses"></span>
          {{ label }}
        </div>
        <p v-if="hint" class="text-xs text-muted-foreground/70">{{ hint }}</p>
      </div>
      <div v-if="$slots.action" class="shrink-0" @click.stop>
        <slot name="action" />
      </div>
    </div>
    <slot />
  </section>
</template>
