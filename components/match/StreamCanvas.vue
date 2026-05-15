<script setup lang="ts">
import { computed, ref, watch } from "vue";
import WhepPlayer from "~/components/match/WhepPlayer.vue";
import StreamSessionProgress from "~/components/match/StreamSessionProgress.vue";

type Stage = { key: string; label: string; meta?: string };

const props = withDefaults(
  defineProps<{
    stream?: any | null;
    whepUrl?: string | null;
    fallbackUrl?: string | null;
    isLive?: boolean | null;
    stages?: Stage[];
    headerLabel?: string;
    status?: string | null;
    errorMessage?: string | null;
    lastStatusAt?: string | null;
    statusHistory?: any[];
    disableFullscreenShortcut?: boolean;
    showBoot?: boolean;
    enablePip?: boolean;
  }>(),
  {
    isLive: null,
    stages: () => [],
    showBoot: false,
    enablePip: false,
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
        class="absolute inset-0"
      />
    </template>
    <Transition v-else name="boot-live" mode="out-in">
      <WhepPlayer
        v-if="canPlay && displayWhepUrl"
        key="live"
        :whep-url="displayWhepUrl"
        :fallback-url="displayFallback"
        :disable-fullscreen-shortcut="disableFullscreenShortcut"
        :enable-pip="enablePip"
        class="absolute inset-0"
      />
      <div
        v-else
        key="boot"
        class="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-auto px-6 py-6 text-center"
      >
        <slot
          name="boot"
          :status="effectiveStatus"
          :error-message="effectiveError"
          :last-status-at="effectiveLastStatusAt"
          :status-history="effectiveHistory"
        >
          <StreamSessionProgress
            :status="effectiveStatus"
            :error-message="effectiveError"
            :last-status-at="effectiveLastStatusAt"
            :status-history="effectiveHistory"
            :stages="stages"
            :header-label="headerLabel"
          />
        </slot>
      </div>
    </Transition>

    <slot />
  </div>
</template>

<style scoped>
.boot-live-enter-active,
.boot-live-leave-active {
  transition:
    opacity 350ms ease,
    transform 350ms ease;
}
.boot-live-enter-from {
  opacity: 0;
  transform: scale(1.02);
}
.boot-live-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
