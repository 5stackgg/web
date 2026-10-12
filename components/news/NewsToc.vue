<script setup lang="ts">
import type { NewsSection } from "~/utilities/newsMarkdown";

/** A post's `###` sections; the one being read is marked. */
defineProps<{
  sections: NewsSection[];
  active: number;
}>();

const emit = defineEmits<{ select: [index: number] }>();
</script>

<template>
  <ol class="m-0 grid list-none gap-0.5 border-l border-border p-0">
    <li v-for="(section, index) in sections" :key="section.id">
      <a
        :href="`#${section.id}`"
        :aria-current="index === active ? 'location' : undefined"
        class="-ml-px block border-l-2 py-1.5 pl-3.5 text-[0.8125rem] leading-snug transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        :class="
          index === active
            ? 'border-[hsl(var(--tac-amber))] text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        "
        @click.prevent="emit('select', index)"
      >
        {{ section.text }}
      </a>
    </li>
  </ol>
</template>
