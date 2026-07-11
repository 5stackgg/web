<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Play, Pause, Music } from "lucide-vue-next";
import { useMediaPlayback } from "~/composables/useMediaPlayback";

const props = defineProps<{
  src: string;
  title?: string | null;
  // Coordinator id so only one media element plays at a time.
  mediaId?: string;
}>();

const audioEl = ref<HTMLAudioElement | null>(null);
const playing = ref(false);
const playback = useMediaPlayback();

watch(playback.current, (activeId) => {
  if (props.mediaId && playing.value && activeId !== props.mediaId) {
    audioEl.value?.pause();
  }
});
const duration = ref(0);
const currentTime = ref(0);
const seekBar = ref<HTMLElement | null>(null);

function toggle() {
  const el = audioEl.value;
  if (!el) return;
  if (el.paused) {
    void el.play();
  } else {
    el.pause();
  }
}

function onLoaded() {
  duration.value = audioEl.value?.duration ?? 0;
}

function onTime() {
  currentTime.value = audioEl.value?.currentTime ?? 0;
}

function seek(pointer: MouseEvent) {
  const el = audioEl.value;
  const bar = seekBar.value;
  if (!el || !bar || !duration.value) return;
  const rect = bar.getBoundingClientRect();
  const fraction = Math.min(
    1,
    Math.max(0, (pointer.clientX - rect.left) / rect.width),
  );
  el.currentTime = fraction * duration.value;
}

function format(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const progressPercent = computed(() =>
  duration.value ? (currentTime.value / duration.value) * 100 : 0,
);

onBeforeUnmount(() => {
  audioEl.value?.pause();
});
</script>

<template>
  <div class="flex h-full w-full flex-col justify-center gap-3 px-4 py-3">
    <div class="flex items-center gap-2 text-muted-foreground">
      <Music class="h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]" />
      <span
        class="truncate font-mono text-[0.65rem] uppercase tracking-[0.16em]"
      >
        {{ title || $t("event.media.audio") }}
      </span>
    </div>

    <div class="flex items-center gap-3">
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] transition-colors hover:bg-[hsl(var(--tac-amber)/0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--tac-amber))]"
        :aria-label="playing ? 'pause' : 'play'"
        @click.stop="toggle"
      >
        <Pause v-if="playing" class="h-4 w-4" />
        <Play v-else class="ml-0.5 h-4 w-4" />
      </button>

      <div class="min-w-0 flex-1">
        <div
          ref="seekBar"
          class="group/seek relative h-5 cursor-pointer"
          @click.stop="seek"
        >
          <div
            class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border"
          ></div>
          <div
            class="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[hsl(var(--tac-amber))]"
            :style="{ width: `${progressPercent}%` }"
          ></div>
          <div
            class="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[hsl(var(--tac-amber))] opacity-0 transition-opacity group-hover/seek:opacity-100"
            :style="{ left: `${progressPercent}%` }"
          ></div>
        </div>
        <div
          class="flex justify-between font-mono text-[0.6rem] tabular-nums tracking-[0.12em] text-muted-foreground"
        >
          <span>{{ format(currentTime) }}</span>
          <span>{{ format(duration) }}</span>
        </div>
      </div>
    </div>

    <audio
      ref="audioEl"
      :src="src"
      preload="metadata"
      class="hidden"
      @play="
        playing = true;
        props.mediaId && playback.claim(props.mediaId);
      "
      @pause="playing = false"
      @ended="playing = false"
      @loadedmetadata="onLoaded"
      @timeupdate="onTime"
    />
  </div>
</template>
