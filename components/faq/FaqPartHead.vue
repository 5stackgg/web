<script setup lang="ts">
import { computed, inject } from "vue";
import { FAQ_CONTEXT } from "~/components/faq/faqContext";

const props = defineProps<{ id: string }>();

const faq = inject(FAQ_CONTEXT)!;

const index = computed(() =>
  faq.outline.value.findIndex((part) => part.id === props.id),
);
const part = computed(() => faq.outline.value[index.value]);
</script>

<template>
  <header
    v-if="!faq.only.value && part"
    :id="`part-${part.id}`"
    class="flex scroll-mt-6 flex-col gap-1.5 pt-6 first:pt-0"
  >
    <span
      class="inline-flex items-center gap-2 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
    >
      <span class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]" />
      {{ $t("faq.part_of", { n: index + 1, total: faq.outline.value.length }) }}
    </span>
    <h2 class="text-2xl font-bold tracking-tight sm:text-[1.7rem]">
      {{ part.title }}
    </h2>
    <p class="max-w-2xl text-sm text-muted-foreground">{{ part.lede }}</p>
  </header>
</template>
