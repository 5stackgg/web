<script setup lang="ts">
import { inject } from "vue";
import { FAQ_CONTEXT } from "~/components/faq/faqContext";

const props = defineProps<{ to: string }>();

const faq = inject(FAQ_CONTEXT)!;
</script>

<template>
  <a
    :href="`#${to}`"
    class="font-medium text-[hsl(var(--tac-amber))] underline decoration-[hsl(var(--tac-amber)/0.4)] underline-offset-[3px] transition-colors hover:decoration-[hsl(var(--tac-amber))]"
    @click.prevent="faq.go(props.to)"
  >
    <slot />
  </a>
</template>
