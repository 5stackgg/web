<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-vue-next";
import StreamCanvas from "~/components/match/StreamCanvas.vue";

// Shared video surface for clips — used by the inline highlights reel
// (featured clip) and the clip detail modal. Encapsulates: custom
// play/pause overlay, hover-armed center button, auto-hide controls
// during playback, audio toggle + volume slider, fullscreen, and the
// thin amber progress bar. Consumers contribute their own chrome via
// slots (top-left / top-right / bottom) so each surface keeps its
// unique controls (share, edit pencil, player display, etc.) without
// duplicating the player UX.
//
// Playback is driven externally: `play()` is exposed and the consumer
// calls it after switching `clipKey` if it wants autoplay. We attempt
// audible playback first and fall back to muted on autoplay-policy
// rejection — mirrors the reel's previous tryPlay behavior.

const props = withDefaults(
  defineProps<{
    src: string | null | undefined;
    poster?: string | null;
    // Identifier for the current clip — changing it remounts the video
    // (via :key), resets progress/playback state, and triggers a brief
    // intro overlay so viewers see what's loading.
    clipKey?: string | number | null;
    // Initial muted state. After mount the component owns mute/volume.
    initialMuted?: boolean;
  }>(),
  { initialMuted: false },
);

const emit = defineEmits<{
  play: [];
  pause: [];
  ended: [];
  // Fires roughly every animation frame while playing. Lets the parent
  // implement near-end behavior (auto-advance) without polling itself.
  progress: [info: { progress: number; currentTime: number; duration: number }];
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const stageRef = ref<InstanceType<typeof StreamCanvas> | null>(null);
const stageEl = computed<HTMLElement | null>(
  () => (stageRef.value as any)?.rootEl ?? null,
);

const playing = ref(false);
const muted = ref(props.initialMuted);
const volume = ref(1);
const progress = ref(0);
const isFullscreen = ref(false);

// Auto-hide overlay state — see MatchHighlightsReel history for the
// rationale: viewers want the clip visible, not a permanent pause
// button. After CONTROLS_HIDE_DELAY of inactivity while playing,
// everything fades out; any mousemove brings it back.
const controlsVisible = ref(true);
const showIntroOverlay = ref(false);
const CONTROLS_HIDE_DELAY = 1100;
let controlsHideTimer: ReturnType<typeof setTimeout> | null = null;
let introOverlayTimer: ReturnType<typeof setTimeout> | null = null;

function clearControlsTimer() {
  if (controlsHideTimer) {
    clearTimeout(controlsHideTimer);
    controlsHideTimer = null;
  }
}
// Always schedule a hide when playing, and re-check at fire time. If the
// intro grace is still up when the timer expires, reschedule rather than
// hide. This is self-correcting on mobile, where the @play / intro-watch
// ordering isn't deterministic enough to rely on the showIntroOverlay
// watcher chain to kick off the hide.
function bumpControls() {
  controlsVisible.value = true;
  clearControlsTimer();
  if (!playing.value) return;
  controlsHideTimer = setTimeout(() => {
    controlsHideTimer = null;
    if (!playing.value) return;
    if (showIntroOverlay.value) {
      bumpControls();
      return;
    }
    controlsVisible.value = false;
  }, CONTROLS_HIDE_DELAY);
}
function hideControls() {
  clearControlsTimer();
  if (playing.value && !showIntroOverlay.value) {
    controlsVisible.value = false;
  }
}

watch(playing, (p) => {
  if (p) bumpControls();
  else {
    clearControlsTimer();
    controlsVisible.value = true;
  }
});

watch(showIntroOverlay, (showing) => {
  if (showing) {
    clearControlsTimer();
    controlsVisible.value = true;
  } else if (playing.value) {
    bumpControls();
  }
});

watch(
  () => props.clipKey,
  () => {
    progress.value = 0;
    playing.value = false;
    if (introOverlayTimer) clearTimeout(introOverlayTimer);
    showIntroOverlay.value = true;
    introOverlayTimer = setTimeout(() => {
      showIntroOverlay.value = false;
    }, 1500);
  },
);

// Smooth progress polling at ~60fps — `timeupdate` events fire at
// ~4Hz, which makes the amber bar look jumpy.
let progressRafId: number | null = null;
function stopProgressLoop() {
  if (progressRafId !== null) {
    cancelAnimationFrame(progressRafId);
    progressRafId = null;
  }
}
function syncProgress() {
  const video = videoRef.value;
  if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
    progress.value = 0;
    return;
  }
  progress.value = Math.min(1, video.currentTime / video.duration);
  emit("progress", {
    progress: progress.value,
    currentTime: video.currentTime,
    duration: video.duration,
  });
}
function tickProgress() {
  syncProgress();
  if (playing.value) {
    progressRafId = requestAnimationFrame(tickProgress);
  } else {
    progressRafId = null;
  }
}
function startProgressLoop() {
  if (progressRafId !== null) return;
  progressRafId = requestAnimationFrame(tickProgress);
}

async function tryPlay(video: HTMLVideoElement) {
  video.muted = muted.value;
  try {
    await video.play();
    return;
  } catch {
    if (!video.muted) {
      video.muted = true;
      muted.value = true;
      try {
        await video.play();
        return;
      } catch {
        // browser refused even muted — give up silently
      }
    }
  }
}

async function play() {
  await nextTick();
  const v = videoRef.value;
  if (!v) return;
  await tryPlay(v);
}
function pause() {
  videoRef.value?.pause();
}
async function toggle() {
  const v = videoRef.value;
  if (!v) return;
  if (v.paused) {
    await tryPlay(v);
  } else {
    v.pause();
  }
}

function toggleMute() {
  const v = videoRef.value;
  muted.value = !muted.value;
  if (v) {
    v.muted = muted.value;
    // Slider was dragged to 0 before muting → restore on unmute so the
    // mute icon and slider position never lie to each other.
    if (!muted.value) {
      if (volume.value <= 0.01) volume.value = 1;
      v.volume = volume.value;
    }
  }
}
function setVolume(value: number) {
  volume.value = Math.max(0, Math.min(1, value));
  const v = videoRef.value;
  if (!v) return;
  v.volume = volume.value;
  if (volume.value <= 0.01) {
    v.muted = true;
    muted.value = true;
  } else if (v.muted) {
    v.muted = false;
    muted.value = false;
  }
}

type IosVideoEl = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

async function toggleFullscreen() {
  const stage = stageEl.value;
  if (!stage) return;
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void> | void;
    fullscreenEnabled?: boolean;
    webkitFullscreenEnabled?: boolean;
  };
  const el = stage as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };

  // iPhone Safari has no Element.requestFullscreen — the only path is
  // video.webkitEnterFullscreen().
  const docFsSupported = !!(
    doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled
  );
  if (!docFsSupported || !el.requestFullscreen) {
    const video = videoRef.value as IosVideoEl | null;
    if (!video) return;
    if (video.webkitDisplayingFullscreen) {
      video.webkitExitFullscreen?.();
    } else {
      video.webkitEnterFullscreen?.();
    }
    return;
  }

  const fsElement = doc.fullscreenElement ?? doc.webkitFullscreenElement;
  try {
    if (fsElement) {
      const exit =
        doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc);
      await Promise.resolve(exit?.());
    } else {
      const request =
        el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
      await Promise.resolve(request?.());
    }
  } catch {
    // ignore — user gesture missing, etc.
  }
}

function onFullscreenChange() {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
  };
  const fsElement = doc.fullscreenElement ?? doc.webkitFullscreenElement;
  isFullscreen.value = fsElement === stageEl.value;
}
function onVideoWebkitBeginFullscreen() {
  isFullscreen.value = true;
}
function onVideoWebkitEndFullscreen() {
  isFullscreen.value = false;
}

if (typeof document !== "undefined") {
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
}

onBeforeUnmount(() => {
  stopProgressLoop();
  clearControlsTimer();
  if (introOverlayTimer) clearTimeout(introOverlayTimer);
  if (typeof document !== "undefined") {
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
  }
});

defineExpose({ play, pause, toggle, videoEl: videoRef, isFullscreen });
</script>

<template>
  <StreamCanvas
    ref="stageRef"
    :is-live="true"
    class="group/player aspect-video w-full overflow-hidden rounded-md border border-border/60 text-left"
    :class="
      isFullscreen
        ? 'flex items-center justify-center !aspect-auto !rounded-none !border-0'
        : ''
    "
    @mousemove="bumpControls"
    @mouseleave="hideControls"
    @touchstart="bumpControls"
  >
    <template #video>
      <video
        v-if="src"
        :key="clipKey ?? src"
        ref="videoRef"
        :src="src"
        :poster="poster ?? undefined"
        class="absolute inset-0 h-full w-full cursor-pointer object-contain"
        :muted="muted"
        playsinline
        preload="auto"
        @ended="
          playing = false;
          stopProgressLoop();
          progress = 1;
          emit('ended');
        "
        @loadedmetadata="syncProgress"
        @pause="
          playing = false;
          stopProgressLoop();
          emit('pause');
        "
        @play="
          playing = true;
          startProgressLoop();
          emit('play');
        "
        @volumechange="
          muted = ($event.target as HTMLVideoElement).muted;
          volume = ($event.target as HTMLVideoElement).volume;
        "
        @webkitbeginfullscreen="onVideoWebkitBeginFullscreen"
        @webkitendfullscreen="onVideoWebkitEndFullscreen"
        @click="toggle"
      />
      <slot v-else name="empty" />
    </template>

    <!-- Top fade — gives top-tray chrome contrast against bright clips. -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-[linear-gradient(180deg,hsl(0_0%_0%/0.7)_0%,transparent_100%)] transition-opacity duration-300"
      :class="controlsVisible ? 'opacity-100' : 'opacity-0'"
    ></div>
    <!-- Bottom fade — same for the bottom-slot info. -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-[linear-gradient(180deg,transparent_0%,hsl(0_0%_0%/0.7)_100%)] transition-opacity duration-300"
      :class="controlsVisible ? 'opacity-100' : 'opacity-0'"
    ></div>

    <!-- Top tray — consumer fills left + right via slots. -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 transition-opacity duration-300"
      :class="controlsVisible ? 'opacity-100' : 'opacity-0'"
    >
      <div class="pointer-events-auto min-w-0 flex-1">
        <slot name="top-left" />
      </div>
      <div class="pointer-events-auto flex shrink-0 items-center gap-2">
        <slot name="top-right" />
      </div>
    </div>

    <!-- Center play/pause toggle — fades with the rest of the chrome
         while playing, always visible while paused. `group-hover/player`
         on the canvas wraps the whole surface so hovering ANYWHERE
         scales the button — signals "click anywhere to toggle". -->
    <button
      type="button"
      class="absolute left-1/2 top-1/2 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-white/16 text-white shadow-[0_0_30px_hsl(var(--tac-amber)/0.35)] backdrop-blur-sm transition duration-200 hover:scale-110 group-hover/player:scale-110 group-hover/player:border-[hsl(var(--tac-amber)/0.7)] group-hover/player:bg-white/25"
      :class="controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'"
      :title="playing ? 'Pause' : 'Play'"
      :aria-label="playing ? 'Pause' : 'Play'"
      @click.stop="toggle"
    >
      <Pause v-if="playing" class="h-7 w-7 fill-current" />
      <Play v-else class="h-7 w-7 translate-x-0.5 fill-current" />
    </button>

    <!-- Bottom slot — player display in the reel, title in the modal. -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 transition-opacity duration-300"
      :class="controlsVisible ? 'opacity-100' : 'opacity-0'"
    >
      <div class="p-4 sm:p-5">
        <slot name="bottom" />
      </div>
    </div>

    <!-- Audio + fullscreen tray — bottom-right, fixed. Volume slider
         expands on hover, mute hides the slider so muted-state isn't
         visually confusing. -->
    <div class="absolute bottom-3 right-3 z-[3] flex items-center gap-2">
      <div class="group/vol flex items-center">
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white/85 backdrop-blur-md transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:text-[hsl(var(--tac-amber))]"
          :title="muted ? 'Unmute' : 'Mute'"
          @click.stop="toggleMute"
        >
          <VolumeX v-if="muted" class="h-4 w-4" />
          <Volume2 v-else class="h-4 w-4" />
        </button>
        <input
          v-if="!muted"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="volume"
          aria-label="Volume"
          class="vol-slider ml-0 w-0 cursor-pointer transition-all duration-200 group-hover/vol:ml-2 group-hover/vol:w-20 focus-visible:ml-2 focus-visible:w-20"
          @click.stop
          @mousedown.stop
          @input="setVolume(Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white/85 backdrop-blur-md transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:text-[hsl(var(--tac-amber))]"
        :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
        @click.stop="toggleFullscreen"
      >
        <Minimize v-if="isFullscreen" class="h-4 w-4" />
        <Maximize v-else class="h-4 w-4" />
      </button>
    </div>

    <!-- Progress bar — thin amber strip glued to the bottom edge. -->
    <span
      class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-white/10"
    >
      <span
        class="absolute inset-y-0 left-0 bg-[hsl(var(--tac-amber))] shadow-[0_0_12px_hsl(var(--tac-amber)/0.45)]"
        :style="{ width: `${(progress * 100).toFixed(2)}%` }"
      ></span>
    </span>
  </StreamCanvas>
</template>

<style scoped>
.vol-slider {
  appearance: none;
  height: 0.25rem;
  background: transparent;
}
.vol-slider:focus {
  outline: none;
}
.vol-slider::-webkit-slider-runnable-track {
  height: 0.25rem;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 9999px;
}
.vol-slider::-moz-range-track {
  height: 0.25rem;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 9999px;
}
.vol-slider::-webkit-slider-thumb {
  appearance: none;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 9999px;
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.6);
  margin-top: -0.25rem;
}
.vol-slider::-moz-range-thumb {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 9999px;
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.6);
}
</style>
