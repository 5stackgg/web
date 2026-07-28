<script setup lang="ts">
import PlayerDisplay from "~/components/PlayerDisplay.vue";

defineProps<{
  player: any;
  active?: boolean;
  // When set the row is rendered dimmed and non-selectable, and this sentence
  // is shown underneath explaining why.
  reason?: string;
}>();

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
    <PlayerDisplay :player="player" />
    <p v-if="reason" class="mt-1 text-[11px] text-muted-foreground">
      {{ reason }}
    </p>
  </div>
</template>
