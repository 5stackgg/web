<script setup lang="ts" generic="T extends string">
// The /watch filter strip: sentence-case options on one 32px row, so the
// ticker's and the highlights' filters read as the same control.
defineProps<{
  options: Array<{ key: T; label: string; count?: number | string | null }>;
  label: string;
}>();

const model = defineModel<T>({ required: true });

// 44px on touch: the pseudo-element pads the hit area without changing
// what's drawn.
const touchTarget =
  "relative after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] [@media(pointer:fine)]:after:hidden";
</script>

<template>
  <div
    role="group"
    :aria-label="label"
    class="inline-flex h-8 items-center gap-0.5 rounded-md border border-border bg-muted/30 p-[3px]"
  >
    <button
      v-for="option in options"
      :key="option.key"
      type="button"
      :aria-pressed="model === option.key"
      class="inline-flex h-full items-center gap-1.5 rounded-sm px-2.5 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
      :class="[
        touchTarget,
        model === option.key
          ? 'bg-[hsl(var(--tac-amber)/0.15)] font-semibold text-foreground'
          : 'font-medium text-muted-foreground hover:text-foreground',
      ]"
      @click="model = option.key"
    >
      {{ option.label }}
      <span
        v-if="option.count != null"
        class="tabular-nums"
        :class="
          model === option.key ? 'text-[hsl(var(--tac-amber))]' : 'opacity-70'
        "
        >{{ option.count }}</span
      >
    </button>
  </div>
</template>
