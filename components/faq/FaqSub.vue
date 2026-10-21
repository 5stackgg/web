<script setup lang="ts">
import { computed, inject } from "vue";
import { FAQ_CONTEXT } from "~/components/faq/faqContext";
import { faqSectionOf } from "~/composables/useFaq";

const props = defineProps<{ id: string; first?: boolean }>();

const faq = inject(FAQ_CONTEXT)!;

const title = computed(
  () =>
    faqSectionOf(faq.outline.value, props.id)?.section.subs?.find(
      (sub) => sub.id === props.id,
    )?.title ?? "",
);
</script>

<template>
  <h4
    :id="id"
    class="scroll-mt-6 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
    :class="!first && 'border-t border-border/50 pt-6'"
  >
    {{ title }}
  </h4>
</template>
