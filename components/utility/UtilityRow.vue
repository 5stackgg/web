<script setup lang="ts">
// The row every list in the card is made of when the thing listed is not a
// lineup: a meta spot, a collection, an execute. Same frame, same three
// columns as a lineup's row -- a picture, a name over one quiet line, a number
// on the right -- so switching tabs is switching lists, not layouts.
withDefaults(
  defineProps<{
    /** The left edge: a utility's colour. Without one the edge is neutral. */
    color?: string | null;
    /** Something that is not there yet -- a spot nobody has written up. */
    dashed?: boolean;
    selected?: boolean;
    hovered?: boolean;
    /** Present but with nothing to show here, so it steps back. */
    muted?: boolean;
  }>(),
  {
    color: null,
    dashed: false,
    selected: false,
    hovered: false,
    muted: false,
  },
);

const emit = defineEmits<{
  (e: "select"): void;
  (e: "hover", value: boolean): void;
}>();
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="group relative flex cursor-pointer flex-col rounded-md border border-l-2 py-2 pl-3 pr-2.5 text-left [backdrop-filter:blur(6px)] transition-[background-color,border-color,opacity] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    :class="[
      selected
        ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.045)]'
        : hovered
          ? 'border-[hsl(var(--tac-amber)/0.3)] bg-card/60'
          : 'border-border bg-card/40 hover:border-[hsl(var(--tac-amber)/0.3)] hover:bg-card/55',
      dashed ? 'border-dashed' : '',
      muted ? 'opacity-60 hover:opacity-100' : '',
    ]"
    :style="color ? { borderLeftColor: color } : undefined"
    @click="emit('select')"
    @keydown.enter="emit('select')"
    @keydown.space.prevent="emit('select')"
    @mouseenter="emit('hover', true)"
    @mouseleave="emit('hover', false)"
  >
    <div class="flex items-center gap-2.5">
      <slot name="thumb" />

      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-center gap-1.5">
          <span class="truncate text-sm font-semibold leading-tight">
            <slot />
          </span>
          <slot name="badges" />
        </div>
        <div
          class="flex min-w-0 items-center gap-1.5 font-mono text-[0.62rem] uppercase leading-relaxed tracking-[0.1em] tabular-nums text-muted-foreground"
        >
          <slot name="line2" />
        </div>
      </div>

      <slot name="right" />
    </div>

    <slot name="under" />
  </div>
</template>
