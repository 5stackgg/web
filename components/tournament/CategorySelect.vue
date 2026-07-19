<script setup lang="ts"></script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="category in e_tournament_categories"
      :key="category.value"
      type="button"
      class="rounded-sm border px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] transition-colors duration-150"
      :class="
        selected.includes(category.value)
          ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)_/_0.12)] text-[hsl(var(--tac-amber))]'
          : 'border-border bg-background/40 text-muted-foreground hover:text-foreground'
      "
      @click="toggle(category.value)"
    >
      {{ category.description }}
    </button>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";

export default {
  props: {
    modelValue: {
      type: Array as () => string[],
      required: false,
      default: () => [],
    },
  },
  emits: ["update:modelValue"],
  apollo: {
    e_tournament_categories: {
      fetchPolicy: "cache-first",
      query: generateQuery({
        e_tournament_categories: [
          {},
          {
            value: true,
            description: true,
          },
        ],
      }),
    },
  },
  computed: {
    selected(): string[] {
      return this.modelValue ?? [];
    },
  },
  methods: {
    toggle(category: string) {
      const next = [...this.selected];
      const index = next.indexOf(category);
      if (index === -1) {
        next.push(category);
      } else {
        next.splice(index, 1);
      }
      this.$emit("update:modelValue", next);
    },
  },
};
</script>
