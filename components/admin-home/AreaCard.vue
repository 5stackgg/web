<script setup lang="ts">
import StatTile from "~/components/admin/StatTile.vue";
import StatusDot from "~/components/admin/StatusDot.vue";
import type { AreaCard } from "~/components/admin-home/useAdminHome";

// One admin area at a glance: its state as a dot, a stat or two, and the
// whole tile opens the page.
defineProps<{ card: AreaCard }>();
</script>

<template>
  <NuxtLink
    :to="card.to"
    class="group block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
  >
    <StatTile
      :value="card.value"
      :sub="card.sub"
      class="h-full transition-colors duration-150 group-hover:bg-card/70"
    >
      <template #label>
        <span class="inline-flex min-w-0 items-center gap-1.5">
          <StatusDot :tone="card.tone" :label="card.toneLabel" size="sm" />
          <span class="truncate">{{ card.label }}</span>
        </span>
      </template>
      <template v-if="card.aside" #aside>{{ card.aside }}</template>
    </StatTile>
  </NuxtLink>
</template>
