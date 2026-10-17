<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { RefreshCw } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import StatusDot from "~/components/admin/StatusDot.vue";
import { timeLabel } from "~/components/game-server-nodes/nodeFormat";
import type { Tone } from "~/components/admin/tone";

// How fresh a live page's data is, in one line:
//   Metrics   <LiveStamp :at="updatedAt" live clock :tip="hint" />    Live · 10:42
//   Fleet     <LiveStamp :at="updatedAt" live :every="60000" />       Updated 5s ago · refreshes every minute
//   Media     <LiveStamp :at="updatedAt" live status="Reachable" :every="10000" />
//   Database  <LiveStamp :at="lastUpdated" :paused="isPaused" @refresh="refreshNow"> interval + pause controls </LiveStamp>
// Bind @refresh for a refresh button; the default slot holds any other
// controls. A stale reading (`staleAfter`) turns the dot warn and stills it.
const props = withDefaults(
  defineProps<{
    /** When the data last arrived (ms). Null: nothing yet. */
    at: number | null | undefined;
    /** Data is streaming or polling right now: the dot pings. */
    live?: boolean;
    /** The dot's tone when fresh. */
    tone?: Tone;
    /** A leading word, e.g. "Reachable" or "Unreachable since 14:02". */
    status?: string;
    /** "Live · 10:42" instead of "Updated 5s ago". */
    clock?: boolean;
    /** Poll interval (ms), read out as "refreshes every …". */
    every?: number;
    paused?: boolean;
    /** Older than this (ms), the reading counts as stale. */
    staleAfter?: number;
    tip?: string;
    onRefresh?: () => unknown;
  }>(),
  { live: false, tone: "ok", clock: false, paused: false },
);

const { t } = useI18n();

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

const age = computed(() =>
  props.at ? Math.max(0, now.value - props.at) : null,
);
const stale = computed(
  () => !!props.staleAfter && age.value != null && age.value > props.staleAfter,
);

const dotTone = computed<Tone>(() =>
  props.paused ? "off" : stale.value ? "warn" : props.tone,
);

const agoText = computed(() => {
  if (age.value == null) {
    return "";
  }
  // Following the status or "Paused", the phrase continues the sentence.
  const after = !!props.status || props.paused ? "_after" : "";
  const seconds = Math.round(age.value / 1000);
  if (seconds < 2) {
    return t(`admin.live_stamp.updated_now${after}`);
  }
  if (seconds < 60) {
    return t(`admin.live_stamp.updated_seconds${after}`, { seconds });
  }
  return t(`admin.live_stamp.updated_minutes${after}`, {
    minutes: Math.round(seconds / 60),
  });
});

const everyText = computed(() => {
  if (!props.every || props.paused) {
    return "";
  }
  const seconds = Math.round(props.every / 1000);
  if (seconds === 60) {
    return t("admin.live_stamp.every_minute");
  }
  if (seconds > 60 && seconds % 60 === 0) {
    return t("admin.live_stamp.every_minutes", { minutes: seconds / 60 });
  }
  return t("admin.live_stamp.every_seconds", { seconds });
});

const text = computed(() => {
  if (props.clock && props.at && !props.paused) {
    return t("admin.live_stamp.live_at", { time: timeLabel(props.at) });
  }
  return [
    props.status,
    props.paused ? t("admin.live_stamp.paused") : "",
    agoText.value,
    everyText.value,
  ]
    .filter(Boolean)
    .join(" · ");
});

const spins = ref(0);
function refresh() {
  spins.value++;
  props.onRefresh?.();
}
</script>

<template>
  <span class="inline-flex min-w-0 items-center gap-1.5">
    <FiveStackToolTip
      v-if="text"
      as-child
      :disabled="!props.tip"
      :delay-duration="120"
    >
      <template #trigger>
        <span
          :tabindex="props.tip ? 0 : undefined"
          class="mr-1 inline-flex h-8 min-w-0 items-center gap-2 whitespace-nowrap text-xs tabular-nums text-muted-foreground"
        >
          <StatusDot
            :tone="dotTone"
            :live="props.live && !props.paused && !stale"
          />
          <span class="truncate">{{ text }}</span>
        </span>
      </template>
      <span class="block max-w-[16rem]">{{ props.tip }}</span>
    </FiveStackToolTip>

    <FiveStackToolTip v-if="props.onRefresh" as-child :delay-duration="120">
      <template #trigger>
        <button
          type="button"
          class="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-muted/30 text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :aria-label="$t('admin.live_stamp.refresh_now')"
          @click="refresh"
        >
          <RefreshCw
            :key="spins"
            class="size-3.5"
            :class="spins > 0 && 'live-stamp-spin'"
          />
        </button>
      </template>
      {{ $t("admin.live_stamp.refresh_now") }}
    </FiveStackToolTip>

    <slot />
  </span>
</template>

<style scoped>
.live-stamp-spin {
  animation: live-stamp-spin 600ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes live-stamp-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .live-stamp-spin {
    animation: none;
  }
}
</style>
