<script setup lang="ts">
import { tacticalSectionTickClasses } from "~/utilities/tacticalClasses";

/**
 * Options-bar shell for the list/filter pages — a single row: search +
 * widely-used filter triggers on the left, then the grouped `FilterMenu`
 * (Filters + reset) and any view-mode toggle pinned right via `ml-auto`.
 *
 * No second row: what's filtered is shown by each trigger's value/count badge
 * and the highlighted options inside the menus; the total result count lives in
 * the pagination at the bottom of the page.
 */
</script>

<template>
  <div
    class="relative flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-2.5 [backdrop-filter:blur(6px)]"
  >
    <span
      :class="tacticalSectionTickClasses"
      class="mr-1 hidden shrink-0 sm:inline-block"
    />
    <slot />
  </div>
</template>
