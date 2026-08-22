<script setup lang="ts">
/**
 * One empty state for the whole utility surface.
 *
 * Every panel in the right-hand column can come up empty -- no lineups in this
 * scope, no executes on this map, nothing left to learn, no collections yet --
 * and each of them had grown its own answer: a dashed box here, a borderless
 * `Empty` floating in the middle of 600px of nothing there, a bare sentence in
 * a third. Switching tabs through them read as switching apps.
 *
 * It is anchored to the top of the column rather than centred in it, because
 * the column is as tall as the map beside it and a message centred in that is
 * a message nowhere near the control that caused it.
 *
 * No icon. A glyph above the sentence decorates a state nobody wants to be in,
 * and every tab picking its own made switching between them read as switching
 * apps -- which is the thing this component exists to stop.
 */
withDefaults(
  defineProps<{
    title: string;
    description?: string | null;
    /** A stub standing in for one row, not the panel's whole answer. */
    compact?: boolean;
  }>(),
  { description: null, compact: false },
);
</script>

<template>
  <div
    class="rounded-md border border-dashed border-border/70 text-center"
    :class="compact ? 'px-3 py-4' : 'px-4 py-6'"
  >
    <p :class="compact ? 'text-xs font-semibold' : 'text-sm font-semibold'">
      {{ title }}
    </p>

    <p
      v-if="description"
      class="mx-auto mt-1 max-w-[36ch] text-xs leading-relaxed text-muted-foreground"
    >
      {{ description }}
    </p>

    <!-- The action that resolves the emptiness, if there is one. -->
    <div
      v-if="$slots.default"
      class="mt-3 flex flex-wrap items-center justify-center gap-1.5"
    >
      <slot />
    </div>

    <!-- Somewhere else to go when this shelf is bare but the library is not. -->
    <div
      v-if="$slots.footer"
      class="mt-3 flex flex-wrap justify-center gap-1.5 border-t border-border/60 pt-3"
    >
      <slot name="footer" />
    </div>
  </div>
</template>
