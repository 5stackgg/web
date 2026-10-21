<script setup lang="ts">
defineProps<{ n?: number; title?: string; stacked?: boolean }>();
</script>

<template>
  <div class="faq-way" :class="stacked && 'faq-way--stacked'">
    <div class="faq-way__grid grid gap-4">
      <div class="flex min-w-0 flex-col gap-2.5">
        <p
          v-if="title"
          class="flex items-center gap-2.5 text-[0.95rem] font-semibold leading-snug"
        >
          <span
            v-if="n !== undefined"
            class="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--tac-amber)/0.55)] font-mono text-xs text-[hsl(var(--tac-amber))]"
          >
            {{ n }}
          </span>
          {{ title }}
        </p>
        <ul
          class="flex flex-col gap-2 text-sm leading-relaxed text-foreground/85 [&>li]:relative [&>li]:pl-4 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.6em] [&>li]:before:h-px [&>li]:before:w-2 [&>li]:before:bg-[hsl(var(--tac-amber)/0.7)]"
        >
          <slot />
        </ul>
      </div>
      <div v-if="$slots.figure" class="flex min-w-0 flex-col gap-3">
        <slot name="figure" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.faq-way {
  container-type: inline-size;
}

@container (min-width: 46rem) {
  .faq-way:not(.faq-way--stacked) .faq-way__grid {
    grid-template-columns: minmax(0, 5fr) minmax(0, 8fr);
    gap: 1.75rem;
  }
}
</style>
