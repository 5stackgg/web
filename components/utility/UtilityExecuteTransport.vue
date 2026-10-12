<script setup lang="ts">
import { computed, ref } from "vue";
import { Pause, Play, RotateCcw } from "lucide-vue-next";
import type { PlaybackClock } from "~/composables/usePlaybackClock";

/**
 * The execute's play bar, under the scene like a video's: play and pause, the
 * time, and a track to scrub with a tick where each step is thrown. The run is
 * its owner's; this reads it every frame, so it glides, and only asks it to
 * move.
 */
const props = defineProps<{
  /** The run, the last grenade down and its cloud up. */
  run: PlaybackClock;
  /** Playing, as the owner counts it: a run waiting on its camera is. */
  running: boolean;
  beats: { key: string; seconds: number; color: string }[];
  /** What the track is called; an execute's timeline unless said. */
  label?: string;
}>();

const emit = defineEmits<{
  (e: "toggle"): void;
  (e: "seek", seconds: number): void;
}>();

const length = computed(() => props.run.length.value);

// Under the pointer while it drags, so the thumb stays in the hand rather
// than running on ahead of it.
const dragAt = ref<number | null>(null);

const at = computed(() =>
  Math.min(
    length.value,
    Math.max(0, dragAt.value ?? props.run.position.value ?? 0),
  ),
);
const ended = computed(
  () =>
    !props.running &&
    props.run.position.value !== null &&
    at.value >= length.value,
);

function share(seconds: number) {
  return length.value > 0
    ? (Math.min(Math.max(0, seconds), length.value) / length.value) * 100
    : 0;
}

const track = ref<HTMLElement | null>(null);

function seekAt(event: PointerEvent) {
  const box = track.value?.getBoundingClientRect();
  if (!box?.width) {
    return;
  }
  const k = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
  dragAt.value = k * length.value;
  emit("seek", dragAt.value);
}

function onUp(event: PointerEvent) {
  track.value?.releasePointerCapture(event.pointerId);
  dragAt.value = null;
}

function onDown(event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }
  track.value?.setPointerCapture(event.pointerId);
  seekAt(event);
}

function onMove(event: PointerEvent) {
  if (track.value?.hasPointerCapture(event.pointerId)) {
    seekAt(event);
  }
}

function onKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 5 : 1;
  const to =
    event.key === "ArrowLeft"
      ? at.value - step
      : event.key === "ArrowRight"
        ? at.value + step
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? length.value
            : null;
  if (to === null) {
    return;
  }
  // The stage's camera listens on the window: these keys are the bar's.
  event.preventDefault();
  event.stopPropagation();
  emit("seek", Math.min(length.value, Math.max(0, to)));
}
</script>

<template>
  <div
    class="flex h-10 items-center gap-2.5 rounded-md border border-border/60 bg-black/60 pl-1 pr-3 backdrop-blur"
    data-no-sheet-drag
  >
    <button
      type="button"
      class="grid size-8 shrink-0 place-items-center rounded-md text-foreground transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      :aria-label="
        running
          ? $t('pages.utility.playbooks.pause')
          : $t('pages.utility.playbooks.play')
      "
      @click="emit('toggle')"
    >
      <Pause v-if="running" class="h-4 w-4 fill-current" />
      <RotateCcw v-else-if="ended" class="h-4 w-4" />
      <Play v-else class="h-4 w-4 fill-current" />
    </button>

    <span
      class="w-[5.5rem] shrink-0 text-xs tabular-nums text-muted-foreground"
    >
      {{
        $t("pages.utility.playbooks.clock_of", {
          now: at.toFixed(1),
          total: length.toFixed(1),
        })
      }}
    </span>

    <div
      ref="track"
      role="slider"
      tabindex="0"
      :aria-label="label ?? $t('pages.utility.playbooks.seek')"
      :aria-valuemin="0"
      :aria-valuemax="Number(length.toFixed(1))"
      :aria-valuenow="Number(at.toFixed(1))"
      :aria-valuetext="`${at.toFixed(1)}s`"
      class="group relative h-8 min-w-0 flex-1 cursor-pointer touch-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @keydown="onKey"
    >
      <span
        class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/15"
      />
      <span
        class="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[hsl(var(--tac-amber))]"
        :style="{ width: `${share(at)}%` }"
      />
      <!-- Where each step is thrown, in its own colour. -->
      <span
        v-for="beat of beats"
        :key="beat.key"
        class="absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        :style="{
          left: `${share(beat.seconds)}%`,
          backgroundColor: beat.color,
        }"
      />
      <span
        class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-transform group-hover:scale-125"
        :style="{ left: `${share(at)}%` }"
      />
    </div>
  </div>
</template>
