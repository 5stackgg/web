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

  if (!loaded.value || !current) {
    return "unknown";
  }

  if (!current.ready || current.health === "down") {
    return "offline";
  }

  if (current.health === "stalled") {
    return "stalled";
  }

  return "live";
});
</script>

<template>
  <!-- Rendered as soon as the match requires cameras, not when the first poll
       lands, so the name row is never re-laid out under the reader. -->
  <FiveStackToolTip v-if="enabled" side="top" as-child>
    <template #trigger>
      <span
        class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border"
        :class="
          state === 'live'
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
            : state === 'stalled'
              ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
              : state === 'offline'
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-border bg-muted/30 text-muted-foreground/60'
        "
      >
        <component
          :is="state === 'live' || state === 'stalled' ? LucideVideo : LucideVideoOff"
          class="h-2.5 w-2.5"
        />
      </span>
    </template>
    {{ $t(`camera.tile.${state}`) }}
  </FiveStackToolTip>
</template>
