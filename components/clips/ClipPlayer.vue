<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import StreamCanvas from "~/components/match/StreamCanvas.vue";
import {
  browserSupportsHevc,
  notifyMissingHevcOnce,
} from "~/utilities/hevcSupport";

const { t } = useI18n();

// Shared video surface for clips — used by the inline highlights reel
// (featured clip) and the clip detail modal. Encapsulates: custom
// play/pause overlay, hover-armed center button, auto-hide controls
// during playback, audio toggle + volume slider, fullscreen, and the
// draggable amber scrub bar. Consumers contribute their own chrome via
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
  // Arrow-key clip navigation. Emitted from the player because a
  // fullscreen stage swallows the consumer's window-level key handlers.
  prev: [];
  next: [];
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
const duration = ref(0);
const isFullscreen = ref(false);
// Once playback has actually started we treat subsequent clipKey changes
// as auto-advances and suppress the big center play/pause button so the
// transition just shows the bottom-left clip chip. Resets only if the
// player gets paused/ended.
const hasPlayedOnce = ref(false);

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
  // Never fade the chrome out from under a finger/cursor that's dragging
  // the seek bar.
  if (!playing.value || scrubbing.value) return;
  controlsHideTimer = setTimeout(() => {
    controlsHideTimer = null;
    if (!playing.value || scrubbing.value) return;
    if (showIntroOverlay.value) {
      bumpControls();
      return;
    }
    controlsVisible.value = false;
  }, CONTROLS_HIDE_DELAY);
}
function hideControls() {
  if (scrubbing.value) return;
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
    // Intro just ended while still playing — DON'T bumpControls here
    // (that would briefly re-show the center pause button for a beat
    // before fading out). Hide the chrome straight away; mouse activity
    // will bring it back if the user actually wants it.
    clearControlsTimer();
    controlsVisible.value = false;
  }
});

watch(
  () => props.clipKey,
  () => {
    progress.value = 0;
    duration.value = 0;
    scrubFrac.value = null;
    hoverFrac.value = null;
    // Don't reset `playing` here — the new <video> element is paused
    // naturally on mount and its @play event will flip the ref to true
    // as soon as playback actually starts. Resetting synchronously caused
    // a race where the watcher fired after the new video's @play and
    // left the play icon stuck on screen during auto-advance.
    if (introOverlayTimer) clearTimeout(introOverlayTimer);
    showIntroOverlay.value = true;
    introOverlayTimer = setTimeout(() => {
      showIntroOverlay.value = false;
    }, 1500);
  },
);

// Smooth progress polling at ~60fps — `timeupdate` events fire at
// ~4Hz, which makes the amber bar look jumpy. Parent `@progress`
// handlers only need ~4Hz (auto-advance threshold checks), so we
// throttle emits while keeping local bar updates at rAF rate.
const PROGRESS_EMIT_INTERVAL_MS = 250;
let progressRafId: number | null = null;
let lastProgressEmitMs = 0;

function emitProgressSnapshot() {
  const video = videoRef.value;
  if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
    return;
  }
  // Suppress while dragging — the parent's near-end auto-advance would
  // otherwise fire the moment someone scrubs to the right edge.
  if (scrubbing.value) return;
  emit("progress", {
    progress: progress.value,
    currentTime: video.currentTime,
    duration: video.duration,
  });
  lastProgressEmitMs = Date.now();
}
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
    duration.value = 0;
    return;
  }
  duration.value = video.duration;
  progress.value = Math.min(1, video.currentTime / video.duration);
  const now = Date.now();
  if (now - lastProgressEmitMs >= PROGRESS_EMIT_INTERVAL_MS) {
    emitProgressSnapshot();
  }
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

// Browsers surface a missing HEVC decoder as either MEDIA_ERR_SRC_NOT_SUPPORTED
// or MEDIA_ERR_DECODE on the <video> element. We can't tell a clip's codec
// before it loads, so we only warn after a failure — and only when the browser
// itself can't decode H.265 — to avoid noise on H.264 clips that fail for
// unrelated reasons (network, expired URL, etc).
function onVideoError(event: Event) {
  const video = event.target as HTMLVideoElement | null;
  const code = video?.error?.code;
  if (
    code !== MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED &&
    code !== MediaError.MEDIA_ERR_DECODE
  ) {
    return;
  }
  if (browserSupportsHevc()) return;
  notifyMissingHevcOnce({
    title: t("toasts.hevc_missing_title"),
    body: t("toasts.hevc_missing_body"),
    linkLabel: t("toasts.hevc_missing_link"),
  });
}

// During a clip crossfade the outgoing <video> lingers a beat while it
// fades out. Its media events (pause/volumechange) would otherwise stomp
// the incoming clip's state, so every handler ignores events from any
// element that isn't the current `videoRef`.
function isCurrentVideo(e: Event) {
  return e.target === videoRef.value;
}
function onVideoEnded(e: Event) {
  if (!isCurrentVideo(e)) return;
  playing.value = false;
  stopProgressLoop();
  progress.value = 1;
  emitProgressSnapshot();
  emit("ended");
}
function onVideoPause(e: Event) {
  if (!isCurrentVideo(e)) return;
  playing.value = false;
  stopProgressLoop();
  emit("pause");
}
function onVideoPlay(e: Event) {
  if (!isCurrentVideo(e)) return;
  playing.value = true;
  hasPlayedOnce.value = true;
  startProgressLoop();
  emit("play");
}
function onVideoVolumeChange(e: Event) {
  if (!isCurrentVideo(e)) return;
  const v = e.target as HTMLVideoElement;
  muted.value = v.muted;
  volume.value = v.volume;
}
// Pause + mute the outgoing clip the instant its crossfade starts so two
// clips never play audio over each other mid-swap. The guards above drop
// the events this fires, since `videoRef` already points at the incoming
// element by now.
function onClipLeave(el: Element) {
  const v = el as HTMLVideoElement;
  try {
    v.pause();
    v.muted = true;
  } catch {
    // element is detaching — nothing to do
  }
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
  // Belt-and-suspenders: if @play didn't reach us (browser sometimes
  // swallows it across :key remounts on auto-advance) but the video is
  // actually playing, force the state so the play icon doesn't stick.
  if (!v.paused) {
    playing.value = true;
    hasPlayedOnce.value = true;
    startProgressLoop();
  }
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

// --- Seeking -------------------------------------------------------------
// Viewers kept trying to drag the thin amber progress strip to rewind, so
// it's a real scrubber now: click or drag it, mouse or touch.
// `scrubFrac` holds the drag position so the bar tracks the pointer 1:1
// instead of waiting on the video's own timeupdate; it clears on release.
const seekEl = ref<HTMLElement | null>(null);
const scrubbing = ref(false);
const scrubFrac = ref<number | null>(null);
const hoverFrac = ref<number | null>(null);

const hasDuration = computed(() => duration.value > 0);
const displayFrac = computed(() => scrubFrac.value ?? progress.value);

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function fracFromEvent(e: PointerEvent) {
  const rect = seekEl.value?.getBoundingClientRect();
  if (!rect || rect.width === 0) return null;
  return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
}
function seekToFrac(frac: number) {
  const v = videoRef.value;
  if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
  // Stop just shy of the end so dragging fully right doesn't fire `ended`
  // (and the consumer's auto-advance) mid-drag.
  v.currentTime = Math.min(frac * v.duration, Math.max(0, v.duration - 0.05));
}

function onSeekMove(e: PointerEvent) {
  if (!scrubbing.value) return;
  const frac = fracFromEvent(e);
  if (frac === null) return;
  scrubFrac.value = frac;
  hoverFrac.value = frac;
  seekToFrac(frac);
}
function onSeekUp(e?: PointerEvent) {
  if (!scrubbing.value) return;
  scrubbing.value = false;
  scrubFrac.value = null;
  // Touch has no hover state to fall back on, so drop the readout on
  // release; a mouse keeps it until the cursor leaves the track.
  if (!e || e.pointerType !== "mouse") hoverFrac.value = null;
  window.removeEventListener("pointermove", onSeekMove);
  window.removeEventListener("pointerup", onSeekUp);
  window.removeEventListener("pointercancel", onSeekUp);
  syncProgress();
  bumpControls();
}
function onSeekDown(e: PointerEvent) {
  if (e.button > 0 || !hasDuration.value) return;
  const frac = fracFromEvent(e);
  if (frac === null) return;
  e.preventDefault();
  scrubbing.value = true;
  scrubFrac.value = frac;
  hoverFrac.value = frac;
  seekToFrac(frac);
  bumpControls();
  window.addEventListener("pointermove", onSeekMove);
  window.addEventListener("pointerup", onSeekUp);
  window.addEventListener("pointercancel", onSeekUp);
}
function onSeekHover(e: PointerEvent) {
  if (scrubbing.value || !hasDuration.value) return;
  hoverFrac.value = fracFromEvent(e);
}
// --- Keyboard ------------------------------------------------------------
// Consumers bind prev/next arrows on window, but a fullscreen player owns
// keyboard focus inside its own subtree, so those window handlers never
// see the keypress. Handling it here on the stage element covers both:
// we stop propagation so the window handler can't also fire and skip two
// clips at once.
function onStageKeydown(e: KeyboardEvent) {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const target = e.target as HTMLElement | null;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable
  ) {
    return;
  }
  // Space activates a focused button on its own — don't also toggle
  // playback out from under it.
  const onButton = !!target?.closest?.("button, a, [role='button']");
  if (e.key === "ArrowLeft") emit("prev");
  else if (e.key === "ArrowRight") emit("next");
  else if ((e.key === " " && !onButton) || e.key === "k") void toggle();
  else if (e.key === "f") void toggleFullscreen();
  else if (e.key === "m") toggleMute();
  else return;
  e.preventDefault();
  e.stopPropagation();
}

type IosVideoEl = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

const isIphone =
  typeof navigator !== "undefined" && /iPhone|iPod/.test(navigator.userAgent);

// Native player fullscreen. On iPhone this is the ONLY mode that rotates to
// landscape (element fullscreen exists since iOS 16.4 but stays locked to
// the page orientation) — it's what Discord embeds use.
function toggleNativeVideoFullscreen() {
  const video = videoRef.value as IosVideoEl | null;
  if (!video) return;
  if (video.webkitDisplayingFullscreen) {
    video.webkitExitFullscreen?.();
    return;
  }
  if (!video.webkitEnterFullscreen) return;
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    try {
      video.webkitEnterFullscreen();
    } catch {
      // InvalidStateError mid-load — the retry below covers it
    }
    return;
  }
  // preload="none": webkitEnterFullscreen throws before metadata exists.
  // Start playback and enter once it lands (still inside Safari's
  // transient-activation window).
  video.addEventListener(
    "loadedmetadata",
    () => {
      try {
        (video as IosVideoEl).webkitEnterFullscreen?.();
      } catch {
        // gesture window expired — user is at least playing now
      }
    },
    { once: true },
  );
  void video.play().catch(() => {});
}

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

  const docFsSupported = !!(
    doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled
  );
  if (isIphone || !docFsSupported || !el.requestFullscreen) {
    toggleNativeVideoFullscreen();
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
      // Clips are always landscape; Android supports locking, elsewhere
      // this rejects harmlessly.
      try {
        await (
          screen.orientation as ScreenOrientation & {
            lock?: (o: string) => Promise<void>;
          }
        ).lock?.("landscape");
      } catch {}
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
  if (isFullscreen.value) {
    // Park focus on the stage so arrow keys reach onStageKeydown — in
    // fullscreen the rest of the page is inert and focus otherwise sits
    // on whatever button opened it (or nothing at all).
    stageEl.value?.focus?.({ preventScroll: true });
  }
  if (!isFullscreen.value) {
    try {
      screen.orientation.unlock();
    } catch {}
  }
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

// Pause whenever the surface scrolls fully out of view. Keyboard media
// keys would otherwise resume a hidden video (modal closed mid-playback,
// scrolled-away inline reel) with no visible feedback — Media Session
// holds the most-recently-played element until something else takes the
// slot. Pausing on exit-viewport also ensures the @pause handler fires
// and our UI state stays in sync.
let visibilityObserver: IntersectionObserver | null = null;
function onVisibilityChange(entries: IntersectionObserverEntry[]) {
  for (const entry of entries) {
    if (entry.isIntersecting) continue;
    const v = videoRef.value;
    if (v && !v.paused) v.pause();
  }
}
function setupVisibilityObserver() {
  if (typeof IntersectionObserver === "undefined") return;
  const v = videoRef.value;
  if (!v) return;
  visibilityObserver?.disconnect();
  visibilityObserver = new IntersectionObserver(onVisibilityChange, {
    threshold: 0,
  });
  visibilityObserver.observe(v);
}
function teardownVisibilityObserver() {
  visibilityObserver?.disconnect();
  visibilityObserver = null;
}

onMounted(() => {
  setupVisibilityObserver();
});

// Re-attach when the underlying <video> element is replaced (clipKey
// remount).
watch(
  () => props.clipKey,
  () => {
    void nextTick().then(() => setupVisibilityObserver());
  },
);

onBeforeUnmount(() => {
  stopProgressLoop();
  clearControlsTimer();
  onSeekUp();
  if (introOverlayTimer) clearTimeout(introOverlayTimer);
  teardownVisibilityObserver();
  // Explicitly tear down playback before the element detaches. A
  // detached <video> retains its src and remains the Media Session
  // target, so keyboard play/next-track keys resume an off-DOM clip
  // (modal close, route change) with no way for the user to see or
  // stop it.
  const v = videoRef.value;
  if (v) {
    try {
      v.pause();
      v.removeAttribute("src");
      v.load();
    } catch {
      // best effort — element is going away anyway
    }
  }
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
    tabindex="-1"
    class="group/player aspect-video w-full overflow-hidden rounded-md border border-border/60 text-left focus:outline-none"
    :class="
      isFullscreen
        ? 'flex items-center justify-center !aspect-auto !rounded-none !border-0'
        : ''
    "
    @mousemove="bumpControls"
    @mouseleave="hideControls"
    @touchstart="bumpControls"
    @keydown="onStageKeydown"
  >
    <template #video>
      <!-- Crossfade clip swaps so next/prev and auto-advance don't hard-cut.
           Keyed on clipKey, so it only fires on clip changes — fullscreen
           toggles don't remount the video and stay instant. -->
      <Transition name="clip-swap" @leave="onClipLeave">
        <video
          v-if="src"
          :key="clipKey ?? src"
          ref="videoRef"
          :src="src"
          :poster="poster ?? undefined"
          class="absolute inset-0 h-full w-full cursor-pointer object-contain"
          :muted="muted"
          playsinline
          preload="metadata"
          @ended="onVideoEnded"
          @loadedmetadata="syncProgress"
          @seeked="syncProgress"
          @pause="onVideoPause"
          @play="onVideoPlay"
          @volumechange="onVideoVolumeChange"
          @webkitbeginfullscreen="onVideoWebkitBeginFullscreen"
          @webkitendfullscreen="onVideoWebkitEndFullscreen"
          @error="onVideoError"
          @click="toggle"
        />
      </Transition>
      <slot v-if="!src" name="empty" />
    </template>

    <!-- Top fade — gives top-tray chrome contrast against bright clips. -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-[linear-gradient(180deg,hsl(0_0%_0%/0.7)_0%,transparent_100%)] transition-opacity duration-300"
      :class="controlsVisible ? 'opacity-100' : 'opacity-0'"
    ></div>
    <!-- Bottom fade — kept visible at all times so the persistent
         player-info HUD in the bottom slot stays legible against bright
         clips, even when the rest of the chrome auto-hides. -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-[linear-gradient(180deg,transparent_0%,hsl(0_0%_0%/0.7)_100%)]"
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
         scales the button — signals "click anywhere to toggle".
         Hidden during the intro overlay AFTER first playback so an
         auto-advance just slides the bottom-left chip in without
         briefly flashing a giant play/pause button on top.
         v-show (not opacity) so the backdrop-blur + translucent fill
         doesn't keep blurring the area behind the hidden button.
         An opacity-0 element still applies its backdrop-filter,
         which produced a visible hazy circle right where the in-game
         crosshair lands during clip playback. -->
    <button
      v-if="!(showIntroOverlay && hasPlayedOnce)"
      v-show="controlsVisible"
      type="button"
      class="absolute left-1/2 top-1/2 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-white/16 text-white shadow-[0_0_30px_hsl(var(--tac-amber)/0.35)] backdrop-blur-sm transition duration-200 hover:scale-110 group-hover/player:scale-110 group-hover/player:border-[hsl(var(--tac-amber)/0.7)] group-hover/player:bg-white/25"
      :title="playing ? $t('ui_extras.pause') : $t('ui_extras.play')"
      :aria-label="playing ? $t('ui_extras.pause') : $t('ui_extras.play')"
      @click.stop="toggle"
    >
      <Pause v-if="playing" class="h-7 w-7 fill-current" />
      <Play v-else class="h-7 w-7 translate-x-0.5 fill-current" />
    </button>

    <!-- Bottom slot — player display in the reel, title in the modal.
         Stays visible during playback so viewers always see who they're
         watching, on which map, and when the clip was created. -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0">
      <div class="p-4 sm:p-5">
        <slot name="bottom" />
      </div>
    </div>

    <!-- Audio + fullscreen tray — bottom-right, fixed. Volume slider
         expands on hover, mute hides the slider so muted-state isn't
         visually confusing. -->
    <div class="absolute bottom-3 right-3 z-[4] flex items-center gap-2">
      <div class="group/vol flex items-center">
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white/85 backdrop-blur-md transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:text-[hsl(var(--tac-amber))]"
          :title="muted ? $t('ui_extras.unmute') : $t('ui_extras.mute')"
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
          :aria-label="$t('ui.volume')"
          class="vol-slider ml-0 w-0 cursor-pointer transition-all duration-200 group-hover/vol:ml-2 group-hover/vol:w-20 focus-visible:ml-2 focus-visible:w-20"
          @click.stop
          @mousedown.stop
          @input="setVolume(Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white/85 backdrop-blur-md transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:text-[hsl(var(--tac-amber))]"
        :title="
          isFullscreen
            ? $t('ui_extras.exit_fullscreen')
            : $t('ui_extras.fullscreen')
        "
        @click.stop="toggleFullscreen"
      >
        <Minimize v-if="isFullscreen" class="h-4 w-4" />
        <Maximize v-else class="h-4 w-4" />
      </button>
    </div>

    <!-- Scrubber — the amber strip glued to the bottom edge, now
         draggable. The wrapper is taller than the bar itself so it's easy
         to grab with a thumb or a hurried cursor; the bar thickens and
         grows a knob on hover/drag. Playback stays on the video click /
         center button — this is seeking only. -->
    <div
      ref="seekEl"
      class="group/seek absolute inset-x-0 bottom-0 z-[3] flex h-5 touch-none select-none items-end px-[2px] pb-1"
      :class="
        hasDuration
          ? 'pointer-events-auto cursor-pointer'
          : 'pointer-events-none'
      "
      :aria-label="$t('ui_extras.seek')"
      @pointerdown="onSeekDown"
      @pointermove="onSeekHover"
      @pointerleave="hoverFrac = null"
      @click.stop
    >
      <div
        class="relative h-0.5 w-full rounded-full bg-white/15 transition-[height] duration-150 group-hover/seek:h-[5px]"
        :class="scrubbing ? '!h-[5px]' : ''"
      >
        <!-- Hover preview fill — lights the track ahead of the playhead so
             the drop target is obvious before committing. -->
        <span
          v-if="hoverFrac !== null && !scrubbing"
          class="absolute inset-y-0 left-0 rounded-full bg-white/35"
          :style="{ width: `${(hoverFrac * 100).toFixed(2)}%` }"
        ></span>
        <span
          class="absolute inset-y-0 left-0 rounded-full bg-[hsl(var(--tac-amber))] shadow-[0_0_12px_hsl(var(--tac-amber)/0.45)]"
          :style="{ width: `${(displayFrac * 100).toFixed(2)}%` }"
        ></span>
        <span
          class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/40 bg-[hsl(var(--tac-amber))] opacity-0 shadow-[0_0_10px_hsl(var(--tac-amber)/0.6)] transition-opacity duration-150 group-hover/seek:opacity-100"
          :class="scrubbing ? '!opacity-100' : ''"
          :style="{ left: `${(displayFrac * 100).toFixed(2)}%` }"
        ></span>
        <!-- Time readout above the cursor while hovering/dragging. -->
        <span
          v-if="hoverFrac !== null && hasDuration"
          class="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded border border-white/15 bg-black/85 px-1.5 py-0.5 font-mono text-[0.65rem] leading-none tabular-nums text-white/90 backdrop-blur-sm"
          :style="{ left: `${(hoverFrac * 100).toFixed(2)}%` }"
        >
          {{ formatTime(hoverFrac * duration) }}
        </span>
      </div>
    </div>
  </StreamCanvas>
</template>

<style scoped>
/* Clip-swap crossfade. Both <video>s are absolutely positioned (inset-0),
   so the outgoing and incoming frames overlap and dissolve instead of
   hard-cutting. Scoped to clip changes only — never runs on fullscreen. */
.clip-swap-enter-active,
.clip-swap-leave-active {
  transition: opacity 220ms ease;
}
.clip-swap-enter-from,
.clip-swap-leave-to {
  opacity: 0;
}

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
