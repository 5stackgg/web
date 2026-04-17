<template>
  <div>
    <h4 class="text-base font-medium mb-3">
      {{ title }}
    </h4>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div
        v-for="status in statuses"
        :key="status"
        :class="[
          'flex items-center justify-between rounded-lg border p-3 cursor-pointer select-none',
          isOverridden(status) ? 'border-primary bg-primary/10' : '',
        ]"
        role="button"
        tabindex="0"
        @click="emitToggle(status)"
        @keydown.enter.prevent="emitToggle(status)"
        @keydown.space.prevent="emitToggle(status)"
      >
        <span class="text-sm font-medium">
          {{ statusLabels[status] || status }}
        </span>
        <Switch
          @click.stop
          :model-value="values[status] === true"
          @update:model-value="emitUpdate(status, $event)"
        />
      </div>
    </div>
  </div>

  <div>
    <h4 class="text-base font-medium mb-3">
      {{ eventsTitle }}
    </h4>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div
        :class="[
          'flex items-center justify-between rounded-lg border p-3 cursor-pointer select-none',
          isOverridden(mapPausedKey) ? 'border-primary bg-primary/10' : '',
        ]"
        role="button"
        tabindex="0"
        @click="emitToggle(mapPausedKey)"
        @keydown.enter.prevent="emitToggle(mapPausedKey)"
        @keydown.space.prevent="emitToggle(mapPausedKey)"
      >
        <span class="text-sm font-medium">
          {{ statusLabels[mapPausedKey] || mapPausedKey }}
        </span>
        <Switch
          @click.stop
          :model-value="values[mapPausedKey] === true"
          @update:model-value="emitUpdate(mapPausedKey, $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Switch } from "~/components/ui/switch";

const props = defineProps<{
  statuses: string[];
  values: Record<string, boolean>;
  statusLabels: Record<string, string>;
  title: string;
  eventsTitle: string;
  mapPausedKey?: string;
  defaultValues?: Record<string, boolean>;
}>();

const emit = defineEmits<{
  toggle: [status: string];
  update: [status: string, value: boolean];
}>();

const mapPausedKey = props.mapPausedKey || "MapPaused";

function emitToggle(status: string) {
  emit("toggle", status);
}

function emitUpdate(status: string, value: boolean) {
  emit("update", status, value);
}

function isOverridden(status: string): boolean {
  if (!props.defaultValues) {
    return false;
  }
  return (
    (props.defaultValues[status] === true) !== (props.values[status] === true)
  );
}
</script>
