<script setup lang="ts">
import { computed } from "vue";
import FaqTerm from "~/components/faq/FaqTerm.vue";

const props = defineProps<{ text: string }>();

// Translations mark button and label names with **double asterisks**, so a
// translator moves the bold with the words instead of splitting the sentence.
const parts = computed(() =>
  props.text
    .split("**")
    .map((value, index) => ({ value, strong: index % 2 === 1 })),
);
</script>

<template>
  <span>
    <template v-for="(part, index) in parts" :key="index">
      <FaqTerm v-if="part.strong">{{ part.value }}</FaqTerm>
      <template v-else>{{ part.value }}</template>
    </template>
  </span>
</template>
