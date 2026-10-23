<script setup lang="ts">
import PlayerDisplay from "~/components/PlayerDisplay.vue";

withDefaults(
  defineProps<{
    player: any;
    active?: boolean;
    // When set the row is rendered dimmed and non-selectable, and this
    // sentence is shown underneath explaining why.
    reason?: string;
    tag?: string;
    online?: boolean;
  }>(),
  { online: undefined },
);

const emit = defineEmits<{ select: []; hover: [] }>();
</script>

<template>
  <div
    class="px-3 py-2"
    :class="
      reason
        ? 'opacity-60 cursor-not-allowed'
        : active
          ? 'bg-accent cursor-pointer'
          : 'hover:bg-accent cursor-pointer'
    "
    :aria-disabled="reason ? 'true' : undefined"
    @click="reason ? undefined : emit('select')"
    @mouseenter="emit('hover')"
  >
    <div class="flex items-center justify-between gap-2">
      <PlayerDisplay :player="player" :online="online" />
      <span
        v-if="tag"
        class="shrink-0 rounded-full border border-[hsl(var(--tac-amber)_/_0.4)] px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
      >
        {{ tag }}
      </span>
    </div>
    <p v-if="reason" class="mt-1 text-[11px] text-muted-foreground">
      {{ reason }}
    </p>
  </div>
</template>
