<script setup lang="ts">
import { X } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import EventPlayerPicker from "~/components/events/EventPlayerPicker.vue";

defineProps<{
  eventId: string;
  label: string;
}>();

type FilterPlayer = { steam_id: string | number; name?: string };

const player = defineModel<FilterPlayer | null>({ default: null });
</script>

<template>
  <span
    v-if="player"
    class="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-card/50 py-1 pl-1.5 pr-1"
  >
    <PlayerDisplay
      :player="player"
      size="xs"
      compact
      :show-flag="false"
      :show-role="false"
      :show-elo="false"
      :show-online="false"
      :tooltip="false"
      :linkable="false"
    />
    <button
      type="button"
      class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
      :aria-label="$t('common.remove')"
      @click="player = null"
    >
      <X class="h-3 w-3" />
    </button>
  </span>
  <EventPlayerPicker
    v-else
    :event-id="eventId"
    :label="label"
    @selected="player = $event"
  />
</template>
