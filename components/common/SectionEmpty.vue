<script setup lang="ts">
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyContent from "~/components/ui/empty/EmptyContent.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import EmptyHeader from "~/components/ui/empty/EmptyHeader.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";

// A section page with nothing to list still says which page it is: a title
// naming it, one line, and an optional action. No icon, like HubEmptyState
// and UtilityEmpty.
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <Empty class="min-h-[240px] border border-border/60 bg-card/20">
    <EmptyHeader>
      <EmptyTitle>{{ title }}</EmptyTitle>
      <EmptyDescription v-if="description">{{ description }}</EmptyDescription>
    </EmptyHeader>
    <EmptyContent v-if="$slots.default" class="flex-row justify-center">
      <slot />
    </EmptyContent>
  </Empty>
</template>
