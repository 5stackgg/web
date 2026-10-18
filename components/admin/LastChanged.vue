<script setup lang="ts">
import TimeAgo from "~/components/TimeAgo.vue";
import type { LastChangedBy } from "~/composables/useLastChanged";

// "Updated 3 hours ago by <name>": one quiet line under an admin header.
withDefaults(
  defineProps<{
    at: string | null;
    by?: LastChangedBy | null;
    // Leads with a "·" so it can sit at the end of a meta line.
    dot?: boolean;
  }>(),
  { by: null, dot: false },
);
</script>

<template>
  <span
    v-if="at"
    class="inline-flex min-w-0 max-w-full items-center gap-x-2 text-xs text-muted-foreground"
    data-last-changed
  >
    <span v-if="dot" aria-hidden="true" class="text-muted-foreground/50"
      >·</span
    >
    <i18n-t
      :keypath="
        by ? 'admin.last_changed.updated_by' : 'admin.last_changed.updated'
      "
      tag="span"
      class="min-w-0 truncate"
    >
      <template #time>
        <TimeAgo :date="at" hide-icon />
      </template>
      <template v-if="by" #name>
        <NuxtLink
          :to="`/players/${by.steam_id}`"
          class="transition-colors duration-150 hover:text-[hsl(var(--tac-amber))]"
          >{{ by.name || by.steam_id }}</NuxtLink
        >
      </template>
    </i18n-t>
  </span>
</template>
