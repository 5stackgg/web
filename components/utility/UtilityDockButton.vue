<script setup lang="ts">
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

// The buttons in a view's action row are the app's own: square-cornered,
// outlined, the height of every other control row, amber when on. Each state is a whole string rather
// than a base plus overrides, because two background or border utilities on
// one element resolve by stylesheet order, not by which was written last.
defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    on?: boolean;
    /** Carries a label, so it sizes to it instead of being a square. */
    wide?: boolean;
    danger?: boolean;
    /** Said in a tooltip, and read out as the button's name. */
    tip?: string | null;
  }>(),
  { on: false, wide: false, danger: false, tip: null },
);

const BASE =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md border text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-50";
const OFF =
  "border-white/10 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground";
const ON =
  "border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)]";
const DANGER =
  "border-destructive/45 bg-destructive/10 text-destructive hover:bg-destructive/20";
</script>

<template>
  <FiveStackToolTip
    v-if="tip"
    as-child
    side="bottom"
    :delay-duration="120"
    :tap-toggle="false"
  >
    <template #trigger>
      <button
        type="button"
        v-bind="$attrs"
        :class="[BASE, danger ? DANGER : on ? ON : OFF, wide ? 'px-2.5' : 'w-8']"
        :aria-label="tip"
      >
        <slot />
      </button>
    </template>
    {{ tip }}
  </FiveStackToolTip>
  <button
    v-else
    type="button"
    v-bind="$attrs"
    :class="[BASE, danger ? DANGER : on ? ON : OFF, wide ? 'px-2.5' : 'w-8']"
  >
    <slot />
  </button>
</template>
