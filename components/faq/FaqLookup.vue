<script setup lang="ts">
import FaqLink from "~/components/faq/FaqLink.vue";

defineProps<{
  headings: string[];
  rows: { cells: string[]; link?: { to: string; label: string } }[];
}>();
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border/60">
    <div
      class="faq-lookup hidden gap-4 border-b border-border/60 bg-muted/20 px-4 py-2 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:grid"
      :class="headings.length === 2 ? 'faq-lookup--two' : 'faq-lookup--three'"
    >
      <span v-for="heading in headings" :key="heading">{{ heading }}</span>
    </div>
    <div
      v-for="(row, index) in rows"
      :key="index"
      class="faq-lookup grid gap-x-4 gap-y-1 px-4 py-3 text-sm transition-colors duration-150 hover:bg-muted/20"
      :class="[
        index > 0 && 'border-t border-border/40',
        headings.length === 2 ? 'faq-lookup--two' : 'faq-lookup--three',
      ]"
    >
      <span
        v-for="(cell, cellIndex) in row.cells"
        :key="cellIndex"
        :class="
          cellIndex === 0
            ? 'font-medium text-foreground'
            : 'text-muted-foreground'
        "
      >
        {{ cell }}
      </span>
      <span v-if="row.link">
        <FaqLink :to="row.link.to">{{ row.link.label }}</FaqLink>
      </span>
    </div>
  </div>
</template>

<style scoped>
@media (min-width: 640px) {
  .faq-lookup--three {
    grid-template-columns: minmax(0, 4fr) minmax(0, 3fr) minmax(0, 3fr);
  }

  .faq-lookup--two {
    grid-template-columns: minmax(0, 2fr) minmax(0, 5fr);
  }
}
</style>
