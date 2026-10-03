<script setup lang="ts">
import { computed, ref, watch } from "vue";
import WhepPlayer from "~/components/match/WhepPlayer.vue";
import BootSequence from "~/components/match/BootSequence.vue";
import type { BootMode } from "~/composables/useBootStages";
import type { WhepPhase } from "~/composables/useWhepStatusCopy";

const props = withDefaults(
  defineProps<{
    stream?: any | null;
    whepUrl?: string | null;
    fallbackUrl?: string | null;
    isLive?: boolean | null;
    mode?: BootMode;
    headerLabel?: string;
    status?: string | null;
    errorMessage?: string | null;
    lastStatusAt?: string | null;
    statusHistory?: any[];
    disableFullscreenShortcut?: boolean;
    showBoot?: boolean;
    enablePip?: boolean;
    muted?: boolean;
    audio?: boolean;
    disableShortcuts?: boolean;
    // Start the WebRTC handshake before `isLive` while the boot screen is
    // still up, so the picture is already flowing when it fades away.
    // For publishers that come up before they're worth showing (a demo
    // pod streams its loading screen before the demo plays).
    preconnect?: boolean;
    // Forwarded to WhepPlayer: playout buffer to trade latency for even
    // frame pacing.
    jitterBufferMs?: number;
  }>(),
  {
    isLive: null,
    mode: "live",
    showBoot: false,
    enablePip: false,
    audio: true,
    preconnect: false,
  },
);

const effectiveWhepUrl = computed<string | null>(() => {
  if (props.whepUrl) return props.whepUrl;
  if (props.stream?.link) {
    return String(props.stream.link).replace(/\/?$/, "/whep");
  }
  return null;
});

const effectiveFallback = computed<string | null>(
  () => props.fallbackUrl ?? props.stream?.link ?? null,
);

const lastWhepUrl = ref<string | null>(null);
const lastFallbackUrl = ref<string | null>(null);
watch(
  effectiveWhepUrl,
  (val) => {
    if (val) lastWhepUrl.value = val;
  },
  { immediate: true },
);
watch(
  effectiveFallback,
  (val) => {
    if (val) lastFallbackUrl.value = val;
  },
  { immediate: true },
);

const displayWhepUrl = computed(
  () => effectiveWhepUrl.value ?? lastWhepUrl.value,
);
const displayFallback = computed(
  () => effectiveFallback.value ?? lastFallbackUrl.value,
);

const canPlay = computed(() => {
  if (typeof props.isLive === "boolean") {
    return props.isLive && !!displayWhepUrl.value;
  }
  return !!displayWhepUrl.value;
});
const mountPlayer = computed(
  () => !!displayWhepUrl.value && (canPlay.value || props.preconnect),
);

const effectiveStatus = computed<string>(
  () => props.status ?? props.stream?.status ?? "booting",
);
const effectiveError = computed<string | null>(
  () => props.errorMessage ?? props.stream?.error_message ?? null,
);
const effectiveLastStatusAt = computed<string | null>(
  () => props.lastStatusAt ?? props.stream?.last_status_at ?? null,
);
const effectiveHistory = computed<any[]>(
  () => props.statusHistory ?? props.stream?.status_history ?? [],
);

// Relayed from WhepPlayer: non-null while there's no picture to show.
const emit = defineEmits<{ (e: "phase", phase: WhepPhase | null): void }>();

const rootEl = ref<HTMLDivElement | null>(null);
defineExpose({ rootEl });
</script>

<template>
  <div ref="rootEl" class="relative w-full bg-black">
    <div v-if="$slots.video" class="absolute inset-0">
      <slot name="video" />
    </div>
    <template v-else-if="!showBoot">
      <WhepPlayer
        v-if="displayWhepUrl"
        :whep-url="displayWhepUrl"
        :fallback-url="displayFallback"
        :disable-fullscreen-shortcut="disableFullscreenShortcut"
        :enable-pip="enablePip"
        :muted="muted"
        :audio="audio"
        :disable-shortcuts="disableShortcuts"
        trickle
        class="absolute inset-0"
        @phase="emit('phase', $event)"
      >
        <template v-if="$slots.status" #status="statusProps">
          <slot name="status" v-bind="statusProps" />
        </template>
      </WhepPlayer>
    </template>
    <!-- Boot → live is a crossfade, not out-in: the player mounts (and
         starts its WebRTC handshake) the moment the stream is live, and
         the boot screen fades away on top of it. out-in held the player
         back until the boot screen had finished leaving. -->
    <template v-else>
      <WhepPlayer
        v-if="mountPlayer"
        :whep-url="displayWhepUrl!"
        :fallback-url="displayFallback"
        :disable-fullscreen-shortcut="disableFullscreenShortcut"
        :enable-pip="enablePip"
        :muted="muted"
        :audio="audio"
        :disable-shortcuts="disableShortcuts"
        trickle
        :jitter-buffer-ms="jitterBufferMs"
        class="absolute inset-0"
        :class="{ isolate: !canPlay }"
        @phase="emit('phase', $event)"
      >
        <template v-if="$slots.status" #status="statusProps">
          <slot name="status" v-bind="statusProps" />
        </template>
      </WhepPlayer>
      <Transition name="boot-fade">
        <div
          v-if="!canPlay"
          class="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-auto bg-black px-6 py-6 text-center"
        >
          <slot
            name="boot"
            :status="effectiveStatus"
            :error-message="effectiveError"
            :last-status-at="effectiveLastStatusAt"
            :status-history="effectiveHistory"
          >
            <BootSequence
              :mode="mode"
              :status="effectiveStatus"
              :error-message="effectiveError"
              :last-status-at="effectiveLastStatusAt"
              :histories="[effectiveHistory]"
              :header-label="headerLabel"
            />
          </slot>
        </div>
      </Transition>
    </template>

    <slot />
  </div>
</template>

<style scoped>
/* Opacity only — no scale. Transforming a layer over (or holding) a video
   re-rasterises it every frame of the transition. */
.boot-fade-enter-active,
.boot-fade-leave-active {
  transition: opacity 200ms ease;
}
.boot-fade-enter-from,
.boot-fade-leave-to {
  opacity: 0;
}
</style>
