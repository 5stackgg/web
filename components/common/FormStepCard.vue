<script setup lang="ts">
// A step of a single-page form. Its title sits in a header bar with the step
// number in a ring, so it never reads as one more tick-and-label field heading
// like the ones the forms inside it (MatchOptions) already use.
const props = defineProps<{
  id: string;
  title: string;
  step?: number | null;
}>();

const headingId = `${props.id}-title`;
</script>

<template>
  <section
    :id="id"
    class="scroll-mt-4 rounded-xl border border-border bg-card/40"
    :aria-labelledby="headingId"
  >
    <header
      class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 px-5 py-3.5"
    >
      <span
        v-if="step"
        class="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[hsl(var(--tac-amber)/0.6)] font-mono text-[0.68rem] font-bold text-[hsl(var(--tac-amber))]"
        aria-hidden="true"
      >
        {{ step }}
      </span>
      <h2
        :id="headingId"
        class="font-sans text-sm font-bold uppercase tracking-[0.18em]"
      >
        {{ title }}
      </h2>
      <div v-if="$slots.aside" class="ml-auto text-xs text-muted-foreground">
        <slot name="aside" />
      </div>
    </header>
    <div class="p-5">
      <slot />
    </div>
  </section>
</template>
