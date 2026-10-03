<script setup lang="ts">
import type { Component } from "vue";

// One of the first-row cards in "More ways to play": an icon, a title, a
// line or two of what's on offer, and its actions pinned to the bottom so
// cards of different heights line their buttons up.
defineProps<{
  icon: Component;
  title: string;
}>();
</script>

<template>
  <article
    class="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-muted/20 p-4"
  >
    <div class="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        class="grid size-8 shrink-0 place-items-center rounded-md bg-muted/60 text-foreground/85"
      >
        <component :is="icon" class="size-4" />
      </span>
      <h3 class="m-0 text-[15px] font-bold">{{ title }}</h3>
    </div>

    <slot />

    <div v-if="$slots.actions" class="mt-auto flex flex-wrap gap-2 pt-1">
      <slot name="actions" />
    </div>
  </article>
</template>
