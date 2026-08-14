<script setup lang="ts">
import { computed } from "vue";
import { LucideVideo, LucideVideoOff } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import {
  canWatchMatchCameras,
  useMatchCameraStatus,
} from "~/composables/useMatchCameraStatus";

const props = defineProps<{
  match: Record<string, any>;
  steamId: string;
}>();

const enabled = computed(() => canWatchMatchCameras(props.match));

const { statusFor, loaded } = useMatchCameraStatus(
  () => String(props.match?.id ?? ""),
  enabled,
);

const status = computed(() => statusFor(props.steamId));

const state = computed(() => {
  const current = status.value;

  if (!current || !current.ready || current.health === "down") {
    return "offline";
  }

  if (current.health === "stalled") {
    return "stalled";
  }

  return "live";
});
</script>

<template>
  <FiveStackToolTip v-if="enabled && loaded && status" side="top" as-child>
    <template #trigger>
      <span
        class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border"
        :class="
          state === 'live'
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
            : state === 'stalled'
              ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
              : 'border-destructive/50 bg-destructive/10 text-destructive'
        "
      >
        <component
          :is="state === 'offline' ? LucideVideoOff : LucideVideo"
          class="h-2.5 w-2.5"
        />
      </span>
    </template>
    {{ $t(`camera.tile.${state}`) }}
  </FiveStackToolTip>
</template>
