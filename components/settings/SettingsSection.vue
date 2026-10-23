<script setup lang="ts">
import {
  tacticalSectionLabelClasses,
  tacticalSectionSeparatorClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// Settings groups use the app-wide tick-and-label section rule (no card frame),
// so a settings page reads the same as the tournament manage tabs. `mb-0` drops
// the label util's own margin — the section grid owns the spacing.
defineProps<{
  id: string;
  title: string;
  description?: string;
  /** When true, clicking anywhere on the header emits `header-click` (use to toggle a header switch). */
  clickableHeader?: boolean;
  /** "danger" fences destructive actions off in a red frame, like the event and season danger zones. */
  tone?: "danger";
}>();

defineEmits<{
  (e: "header-click"): void;
}>();
</script>

<template>
  <section
    :id="id"
    :class="[
      'grid gap-4 scroll-mt-4',
      tone === 'danger'
        ? 'rounded-lg border border-destructive/40 bg-destructive/5 p-5'
        : tacticalSectionSeparatorClasses,
    ]"
  >
    <div
      class="flex items-end justify-between gap-4"
      :class="clickableHeader ? 'cursor-pointer select-none' : ''"
      @click="clickableHeader && $emit('header-click')"
    >
      <div class="grid min-w-0 gap-1">
        <div
          :class="[
            tacticalSectionLabelClasses,
            'mb-0',
            tone === 'danger' && '!text-destructive',
          ]"
        >
          <span
            :class="[
              tacticalSectionTickClasses,
              tone === 'danger' && '!bg-destructive',
            ]"
          ></span>
          {{ title }}
        </div>
        <p v-if="description" class="text-xs text-muted-foreground/70">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.action" class="shrink-0" @click.stop>
        <slot name="action" />
      </div>
    </div>

    <div v-if="$slots.default" class="grid gap-6">
      <slot />
    </div>
  </section>
</template>
