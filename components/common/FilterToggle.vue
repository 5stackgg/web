<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    label: string;
    // Sanction flags carry their own meaning -- a banned filter reading amber
    // like every other filter loses that. The control stays identical; only
    // the lit colour changes.
    tone?: "amber" | "danger" | "warning";
  }>(),
  { tone: "amber" },
);

defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const TONES = {
  amber: {
    label: "text-[hsl(var(--tac-amber))]",
    track:
      "border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.18)]",
    knob: "bg-[hsl(var(--tac-amber))] shadow-[0_0_6px_hsl(var(--tac-amber)/0.55)]",
  },
  danger: {
    label: "text-destructive",
    track:
      "border-[hsl(var(--destructive)/0.55)] bg-[hsl(var(--destructive)/0.18)]",
    knob: "bg-destructive shadow-[0_0_6px_hsl(var(--destructive)/0.55)]",
  },
  warning: {
    label: "text-yellow-500",
    track: "border-yellow-500/55 bg-yellow-500/20",
    knob: "bg-yellow-500 shadow-[0_0_6px_theme(colors.yellow.500/0.55)]",
  },
} as const;

const tone = computed(() => TONES[props.tone]);
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    class="group flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber)/0.5)]"
    :class="modelValue ? tone.label : 'text-foreground/90'"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span class="flex min-w-0 items-center gap-2 text-left">
      <slot name="icon" />
      <span class="truncate">{{ label }}</span>
    </span>

    <!-- Squared off rather than the pill switch: these panels are dense, sharp
         cornered and mono set, and a rocker reads as instrumentation in a way a
         rounded pill does not. Both states are visible at rest, which the bare
         check mark this replaces could not do. -->
    <span
      class="flex h-4 w-7 shrink-0 items-center rounded-[3px] border px-[2px] transition-colors duration-150"
      :class="
        modelValue
          ? tone.track
          : 'border-border bg-muted/40 group-hover:border-muted-foreground/40'
      "
    >
      <span
        class="size-2.5 rounded-[2px] transition-all duration-150 ease-out"
        :class="
          modelValue
            ? `translate-x-3 ${tone.knob}`
            : 'translate-x-0 bg-muted-foreground/40 group-hover:bg-muted-foreground/60'
        "
      />
    </span>
  </button>
</template>
