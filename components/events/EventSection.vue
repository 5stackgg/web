<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// An overview block: tick + label, an optional "see all" jump to the tab that
// holds the rest. No frame; the content brings its own.
defineProps<{ label: string; more?: string }>();
const emit = defineEmits<{ (e: "more"): void }>();
</script>

<template>
  <section class="grid min-w-0 gap-3">
    <div class="flex min-h-5 items-center justify-between gap-3">
      <h2 :class="[tacticalSectionLabelClasses, 'mb-0']">
        <span :class="tacticalSectionTickClasses"></span>
        {{ label }}
      </h2>
      <button
        v-if="more"
        type="button"
        class="relative inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-150 after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        @click="emit('more')"
      >
        {{ more }}
        <ArrowRight class="h-3 w-3" />
      </button>
    </div>
    <slot />
  </section>
</template>
