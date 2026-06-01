<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { Volume2, VolumeX, Maximize2, Minimize2 } from "lucide-vue-next";
import { useClipRenderActive } from "~/composables/useClipRenderActive";

const { active: clipRenderActive } = useClipRenderActive();

// Bare WHEP playback over RTCPeerConnection (no whep.js / adapter).
// Latency: ~100–500ms vs ~2s LL-HLS, ~6–30s plain HLS.

const props = defineProps<{
  whepUrl: string;
  iceServers?: RTCIceServer[];
  muted?: boolean;
  fallbackUrl?: string | null;
  // When the parent owns page-level fullscreen (eg. the broadcast
  // deck focus page), suppress the in-player "F" key so a single
  // press doesn't fire both handlers and race two requestFullscreen
  // calls against each other.
  disableFullscreenShortcut?: boolean;
  // Opt-in to native Picture-in-Picture. Only enabled for live game
  // streams on mobile — demo playback and highlights stay PIP-locked.
  enablePip?: boolean;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const status = ref<"idle" | "connecting" | "playing" | "error" | "rendering">(
  "idle",
);
const useFallback = ref(false);
let failureCount = 0;
const MAX_WHEP_FAILURES = 3;
// Once WHEP has played a frame, never fall back to HLS — mediamtx
// briefly drops the path during clip-render's restart_capture, and
// falling back at that moment locks us at HLS latency.
let hasEverPlayed = false;
const errorMessage = ref<string | null>(null);
const isRetrying = ref(false);
const isMuted = ref(true);
const volume = ref(1);
const isFullscreen = ref(false);
const containerRef = ref<HTMLDivElement | null>(null);

function setVolume(v: number) {
  volume.value = Math.max(0, Math.min(1, v));
  const el = videoRef.value;
  if (!el) return;
  el.volume = volume.value;
  if (volume.value <= 0.01) {
    el.muted = true;
    isMuted.value = true;
  } else if (el.muted) {
    el.muted = false;
    isMuted.value = false;
  }
}

type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type IosVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
};

const coarsePointer = ref(false);

const docFullscreenSupported = computed(() => {
  if (typeof document === "undefined") return false;
  const doc = document as FullscreenDoc & {
    fullscreenEnabled?: boolean;
    webkitFullscreenEnabled?: boolean;
  };
  return !!(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
});

async function toggleFullscreen() {
  // Prefer the parent surface (eg. LiveStreamPlayer's aspect-video
  // wrapper) so siblings like the scoreboard pulldown, corner markers,
  // and any HUD overlays remain visible in fullscreen. Falls back to
  // our own container when we're mounted at the top level.
  const target = (containerRef.value?.parentElement ??
    containerRef.value) as FullscreenEl | null;
  const doc = document as FullscreenDoc;
  const fsElement = doc.fullscreenElement ?? doc.webkitFullscreenElement;

  // iOS Safari (iPhone) doesn't expose element.requestFullscreen — the
  // only fullscreen path is video.webkitEnterFullscreen(). Detect by
  // missing document fullscreen support and fall through to the video.
  if (!docFullscreenSupported.value || !target?.requestFullscreen) {
    const video = videoRef.value as IosVideo | null;
    if (!video) return;
    if (video.webkitDisplayingFullscreen) {
      video.webkitExitFullscreen?.();
    } else {
      video.webkitEnterFullscreen?.();
    }
    return;
  }

  if (fsElement) {
    const exit =
      doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc);
    await Promise.resolve(exit?.()).catch(() => undefined);
  } else {
    const request =
      target.requestFullscreen?.bind(target) ??
      target.webkitRequestFullscreen?.bind(target);
    await Promise.resolve(request?.()).catch(() => undefined);
  }
}

function onFullscreenChange() {
  const doc = document as FullscreenDoc;
  isFullscreen.value = !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

function onWebkitBeginFullscreen() {
  isFullscreen.value = true;
}
function onWebkitEndFullscreen() {
  isFullscreen.value = false;
}

// Picture-in-Picture — only surfaced on mobile for live game streams.
function onKeyDown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    return;
  }
  if (e.key === "f" || e.key === "F") {
    if (props.disableFullscreenShortcut) return;
    e.preventDefault();
    void toggleFullscreen();
  } else if (e.key === "m" || e.key === "M") {
    e.preventDefault();
    toggleMute();
  }
}

let pc: RTCPeerConnection | null = null;
let retryHandle: ReturnType<typeof setTimeout> | null = null;
let cancelled = false;
const MAX_RETRY_DELAY_MS = 5_000;
const INITIAL_RETRY_DELAY_MS = 500;
let retryDelay = INITIAL_RETRY_DELAY_MS;

function unmute() {
  const el = videoRef.value;
  if (!el) return;
  el.muted = false;
  isMuted.value = false;
  // play() is required after toggling muted because some browsers
  // pause when you change mute state programmatically while srcObject
  // is set. The click itself is the user gesture that authorizes
  // audible playback.
  void el.play().catch((err) => {
    console.debug("[whep] unmute play failed:", err);
  });
}

function tryPlay() {
  const el = videoRef.value;
  if (!el) return;
  return el.play().catch((err) => {
    console.debug("[whep] autoplay blocked:", err?.name ?? err);
    el.muted = true;
    return el.play().catch((retryErr) => {
      console.warn(
        "[whep] autoplay blocked after retry:",
        retryErr?.name ?? retryErr,
      );
    });
  });
}

// The WHEP <video> has no user pause control (browser chrome is
// suppressed, our overlay has no pause button), so any `pause` event
// is involuntary — most commonly the browser pausing during heavy
// layout churn (eg. floating PIP resize) or a backgrounded tab. Kick
// it back to playing as long as we still have a live srcObject.
function onInvoluntaryPause() {
  const el = videoRef.value;
  if (!el || !el.srcObject) return;
  if (cancelled || useFallback.value) return;
  if (clipRenderActive.value) return;
  void tryPlay();
}

async function connect() {
  if (!props.whepUrl) return;
  if (!videoRef.value) return;
  if (clipRenderActive.value) return;

  await teardown();
  status.value = "connecting";
  errorMessage.value = null;

  try {
    pc = new RTCPeerConnection({
      iceServers: props.iceServers ?? [
        { urls: "stun:stun.l.google.com:19302" },
      ],
    });

    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    pc.ontrack = (event) => {
      const el = videoRef.value;
      if (!el || !event.streams[0]) return;
      el.muted = true;
      el.autoplay = true;
      el.playsInline = true;
      el.srcObject = event.streams[0];
      void tryPlay();
    };

    pc.onconnectionstatechange = () => {
      const state = pc?.connectionState;
      if (state === "connected") {
        status.value = "playing";
      } else if (state === "failed" || state === "disconnected") {
        if (clipRenderActive.value) {
          status.value = "rendering";
          errorMessage.value = null;
          isRetrying.value = false;
          return;
        }
        status.value = "error";
        errorMessage.value = `peer connection ${state}`;
        retryDelay = INITIAL_RETRY_DELAY_MS;
        scheduleRetry();
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceComplete(pc);

    const res = await fetch(props.whepUrl, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: pc.localDescription?.sdp ?? "",
    });
    if (!res.ok) {
      throw new Error(
        `WHEP ${res.status}: ${await res.text().catch(() => "")}`,
      );
    }
    const answerSdp = await res.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    retryDelay = INITIAL_RETRY_DELAY_MS;
    failureCount = 0;
    hasEverPlayed = true;
    isRetrying.value = false;
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    if (clipRenderActive.value) {
      status.value = "rendering";
      errorMessage.value = null;
      isRetrying.value = false;
      return;
    }
    status.value = "error";
    errorMessage.value = message;
    await teardown();
    failureCount += 1;
    if (
      failureCount >= MAX_WHEP_FAILURES &&
      props.fallbackUrl &&
      !hasEverPlayed
    ) {
      cancelRetries();
      useFallback.value = true;
      return;
    }
    scheduleRetry();
  }
}

function scheduleRetry() {
  if (cancelled || useFallback.value) return;
  // Don't burn retries during a render — clipRenderActive watcher reconnects.
  if (clipRenderActive.value) {
    isRetrying.value = false;
    return;
  }
  if (retryHandle) clearTimeout(retryHandle);
  isRetrying.value = true;
  retryHandle = setTimeout(() => {
    retryHandle = null;
    if (cancelled || useFallback.value) return;
    void connect();
  }, retryDelay);
  retryDelay = Math.min(MAX_RETRY_DELAY_MS, retryDelay * 2);
}

function waitForIceComplete(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = () => {
      if (peer.iceGatheringState === "complete") {
        peer.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      }
    };
    peer.addEventListener("icegatheringstatechange", onChange);
    setTimeout(() => {
      peer.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }, 2000);
  });
}

async function teardown() {
  if (pc) {
    try {
      pc.getSenders().forEach((s) => s.track?.stop());
      pc.close();
    } catch {
      /* ignore */
    }
    pc = null;
  }
  if (videoRef.value) {
    videoRef.value.srcObject = null;
  }
}

function cancelRetries() {
  cancelled = true;
  if (retryHandle) {
    clearTimeout(retryHandle);
    retryHandle = null;
  }
}

// Detect a genuinely-frozen VIDEO and reconnect. Keyed off the inbound video
// track's framesDecoded — NOT currentTime or total bytes, because the AUDIO
// track keeps both of those advancing even when the picture is frozen (so the
// old check thought a stuck stream was healthy and never recovered). framesDecoded
// also rises through a cs2 seek (the held-frame keeps decoding dup frames), so it
// won't false-fire on seeks. We never act while the tab is hidden — the browser
// legitimately stops decoding video for an occluded/background tab; we recover on
// visibilitychange instead.
const STALL_MS = 4_000;
let stallTimer: ReturnType<typeof setInterval> | null = null;
let lastFrames = -1;
let lastFramesAt = 0;
let stallWatchActive = false;

// Inbound video framesDecoded, or null if unavailable.
async function videoFramesDecoded(): Promise<number | null> {
  if (!pc) return null;
  try {
    const stats = await pc.getStats();
    let frames = -1;
    stats.forEach((r: any) => {
      if (
        r.type === "inbound-rtp" &&
        (r.kind === "video" || r.mediaType === "video")
      ) {
        frames =
          (frames < 0 ? 0 : frames) + (r.framesDecoded ?? r.framesReceived ?? 0);
      }
    });
    return frames < 0 ? null : frames;
  } catch {
    return null;
  }
}

function startStallWatch() {
  stallWatchActive = true;
  if (typeof document !== "undefined" && document.hidden) {
    // Background tabs throttle setInterval to ~1Hz already, but every
    // active player still wakes; defer the wakeup entirely until the
    // tab is visible. visibilitychange handler will arm us.
    return;
  }
  armStallTimer();
}

function armStallTimer() {
  stopStallTimer();
  lastFrames = -1;
  lastFramesAt = Date.now();
  stallTimer = setInterval(async () => {
    const el = videoRef.value;
    if (!el || status.value !== "playing" || cancelled || useFallback.value) {
      return;
    }
    if (clipRenderActive.value) {
      lastFrames = -1; // re-baseline so we don't fire when the render ends
      lastFramesAt = Date.now();
      return;
    }
    // Don't fight a hidden/occluded tab: the browser legitimately stops decoding
    // video then (audio keeps playing), and reconnecting wouldn't render anyway.
    // onVisibilityChange handles recovery when the tab comes back.
    if (typeof document !== "undefined" && document.hidden) {
      lastFrames = -1;
      return;
    }
    const frames = await videoFramesDecoded();
    if (frames === null) return; // can't measure — leave it alone
    if (lastFrames < 0 || frames > lastFrames) {
      lastFrames = frames;
      lastFramesAt = Date.now();
      return;
    }
    if (Date.now() - lastFramesAt < STALL_MS) return;
    // Video frames flat for STALL_MS while visible+playing => genuinely frozen
    // (decoder stuck, or publisher dead). Audio may still be flowing; reconnect.
    console.debug("[whep] video frozen — forcing reconnect");
    lastFrames = -1;
    lastFramesAt = Date.now();
    retryDelay = INITIAL_RETRY_DELAY_MS;
    void teardown().then(() => connect());
  }, 1_000);
}

function stopStallTimer() {
  if (stallTimer) {
    clearInterval(stallTimer);
    stallTimer = null;
  }
}

function stopStallWatch() {
  stallWatchActive = false;
  stopStallTimer();
}

function onVisibilityChange() {
  if (!stallWatchActive) return;
  if (document.hidden) {
    stopStallTimer();
    return;
  }
  // Became visible again. Backgrounded tabs are throttled — a pending reconnect
  // timer can be stuck ~a minute out, and the muted video element is often paused
  // — so the stream looks dead until a manual refresh. Recover proactively:
  // resume the video, and if we're not cleanly connected+playing, drop the
  // (throttled) pending retry and reconnect now. NOT cancelRetries() — that sets
  // `cancelled` and would kill reconnection for good.
  void tryPlay();
  const connected = !!pc && pc.connectionState === "connected";
  if (!cancelled && (!connected || status.value !== "playing")) {
    if (retryHandle) {
      clearTimeout(retryHandle);
      retryHandle = null;
    }
    retryDelay = INITIAL_RETRY_DELAY_MS;
    void connect();
  } else {
    // Connected + playing, but the video may have frozen while occluded (audio
    // kept flowing). Chrome usually resumes decoding on visible; if it doesn't,
    // catch it fast instead of waiting out the 4s watchdog: snapshot frames now
    // and reconnect if they haven't advanced ~1.2s later.
    void (async () => {
      const before = await videoFramesDecoded();
      if (before === null) return;
      setTimeout(async () => {
        if (cancelled || document.hidden) return;
        if (!pc || pc.connectionState !== "connected") return;
        const after = await videoFramesDecoded();
        if (after !== null && after <= before) {
          console.debug("[whep] video still frozen after refocus — reconnecting");
          retryDelay = INITIAL_RETRY_DELAY_MS;
          void teardown().then(() => connect());
        }
      }, 1_200);
    })();
  }
  if (!stallTimer) armStallTimer();
}

// Wait for mount so videoRef is bound — `immediate: true` fires
// during setup before the template renders.
onMounted(() => {
  void connect();
  startStallWatch();
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("keydown", onKeyDown);

  if (typeof window !== "undefined" && window.matchMedia) {
    coarsePointer.value = window.matchMedia("(pointer: coarse)").matches;
  }

  const video = videoRef.value as IosVideo | null;
  if (video) {
    // iPhone Safari fires webkitbegin/endfullscreen on the video
    // instead of the document fullscreenchange path.
    video.addEventListener("webkitbeginfullscreen", onWebkitBeginFullscreen);
    video.addEventListener("webkitendfullscreen", onWebkitEndFullscreen);
    video.addEventListener("pause", onInvoluntaryPause);
  }
});

watch(clipRenderActive, (active, was) => {
  if (was && !active) {
    retryDelay = INITIAL_RETRY_DELAY_MS;
    void teardown().then(() => connect());
  }
});

watch(
  () => props.whepUrl,
  () => {
    retryDelay = INITIAL_RETRY_DELAY_MS;
    failureCount = 0;
    hasEverPlayed = false;
    useFallback.value = false;
    if (retryHandle) {
      clearTimeout(retryHandle);
      retryHandle = null;
    }
    cancelled = false;
    void connect();
  },
);

onBeforeUnmount(() => {
  cancelRetries();
  stopStallWatch();
  void teardown();
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("keydown", onKeyDown);

  const video = videoRef.value as IosVideo | null;
  if (video) {
    video.removeEventListener("webkitbeginfullscreen", onWebkitBeginFullscreen);
    video.removeEventListener("webkitendfullscreen", onWebkitEndFullscreen);
    video.removeEventListener("pause", onInvoluntaryPause);
  }
});

function toggleMute() {
  const el = videoRef.value;
  if (!el) return;
  if (el.muted) {
    unmute();
  } else {
    el.muted = true;
    isMuted.value = true;
  }
}

defineExpose({ connect, teardown });
</script>

<template>
  <div
    ref="containerRef"
    class="group relative aspect-video w-full h-full bg-black rounded overflow-hidden"
  >
    <iframe
      v-if="useFallback && fallbackUrl"
      :src="fallbackUrl"
      class="absolute inset-0 h-full w-full border-0"
      allow="autoplay; fullscreen; picture-in-picture"
      allowfullscreen
    />

    <!-- muted/autoplay as static attributes — Chrome's autoplay gate
         reads them eagerly and a late :muted binding loses the race.
         disablepictureinpicture + disableremoteplayback suppress
         Chrome's auto-injected hover overlay (scrubber, PiP button,
         3-dot menu). We do all our own chrome and don't want the
         browser racing it. controlslist is a belt-and-suspenders for
         the case where some future code path flips `controls` on.
         When `enablePip` is set (mobile live streams) we drop
         `disablepictureinpicture` and the controlslist's
         `nofullscreen` so Chrome/Safari will honor the PIP request
         and iOS will enter native fullscreen via the video element. -->
    <video
      v-show="!useFallback"
      ref="videoRef"
      class="absolute inset-0 h-full w-full object-contain"
      autoplay
      muted
      playsinline
      :disablepictureinpicture="!enablePip"
      disableremoteplayback
      :controlslist="
        enablePip
          ? 'nodownload noremoteplayback noplaybackrate'
          : 'nodownload nofullscreen noremoteplayback noplaybackrate'
      "
    />

    <!-- Prominent "click to unmute" affordance. Browsers force WHEP
         playback to start muted (autoplay policy), so this pill stays
         loud + visible until the viewer clicks it. Once unmuted the
         control collapses to the slim icon-only treatment that hides
         on mouse-out, matching twitch/youtube convention. -->
    <button
      v-if="status === 'playing' && !useFallback && isMuted"
      type="button"
      :aria-label="$t('ui.unmute')"
      class="whep-unmute group/unmute absolute bottom-3 right-3 z-10 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--tac-amber)/0.65)] bg-black/75 pl-2 pr-3 py-1.5 backdrop-blur-md cursor-pointer transition-[transform,box-shadow,border-color] duration-150 hover:scale-[1.03] hover:border-[hsl(var(--tac-amber))] [box-shadow:0_0_0_1px_hsl(var(--tac-amber)/0.15),0_0_22px_-4px_hsl(var(--tac-amber)/0.55)]"
      @click="toggleMute"
    >
      <!-- Speaker glyph behind a ping halo so the pill reads as
           "live audio waiting for you" rather than a static button. -->
      <span class="relative inline-flex size-5 items-center justify-center">
        <span
          class="absolute inset-0 rounded-full bg-[hsl(var(--tac-amber)/0.35)] animate-ping"
          aria-hidden="true"
        />
        <span
          class="relative inline-flex size-5 items-center justify-center rounded-full bg-[hsl(var(--tac-amber))] text-black"
        >
          <VolumeX class="size-3" />
        </span>
      </span>
      <span
        class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.22em] leading-none text-[hsl(var(--tac-amber))]"
      >
        {{ $t("match.tap_to_unmute") }}
      </span>
    </button>

    <!-- Audio tray (right) — visible only when audio is on. -->
    <div
      v-if="status === 'playing' && !useFallback && !isMuted"
      class="absolute bottom-2 right-2 z-10 flex items-center gap-2 transition-opacity duration-150"
      :class="
        coarsePointer
          ? ''
          : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
      "
    >
      <div class="flex items-center group/vol">
        <button
          type="button"
          :aria-label="$t('ui.mute')"
          class="inline-flex size-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/90 backdrop-blur-sm transition-colors duration-150 hover:bg-black/80 hover:text-white cursor-pointer"
          @click="toggleMute"
        >
          <Volume2 class="size-3.5" />
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="volume"
          :aria-label="$t('ui.volume')"
          class="vol-slider ml-0 w-0 group-hover/vol:w-20 group-hover/vol:ml-2 focus-visible:w-20 focus-visible:ml-2 transition-all duration-200 cursor-pointer"
          @input="setVolume(Number(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <!-- Fullscreen — single left-side button. Hover-gated on desktop;
         always visible on touch devices. -->
    <div
      v-if="status === 'playing' && !useFallback"
      class="absolute bottom-3 left-3 z-10 flex items-center gap-2 transition-opacity duration-150"
      :class="
        coarsePointer
          ? ''
          : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
      "
    >
      <button
        type="button"
        :aria-label="
          isFullscreen
            ? $t('ui_extras.exit_fullscreen')
            : $t('ui_extras.fullscreen')
        "
        :title="$t('replay_extras.fullscreen_key')"
        class="inline-flex size-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/90 backdrop-blur-sm transition-all duration-150 hover:bg-black/80 hover:text-white hover:scale-110 cursor-pointer"
        @click="toggleFullscreen"
      >
        <Minimize2 v-if="isFullscreen" class="size-3.5" />
        <Maximize2 v-else class="size-3.5" />
      </button>
    </div>
    <!-- "Rendering clip" chip. Shown over the last-good frame while
         the pod has stopped its publisher to free the GPU for a
         render. We keep the <video> intact (no teardown) so users
         see the freeze frame instead of a black panel. -->
    <div
      v-if="status === 'rendering'"
      class="absolute top-3 left-3 z-20 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--tac-amber)/0.6)] bg-black/70 px-3 py-1.5 backdrop-blur-sm pointer-events-none"
    >
      <span
        class="inline-flex size-2 rounded-full bg-[hsl(var(--tac-amber))] animate-pulse"
      />
      <span
        class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
      >
        Rendering clip
      </span>
    </div>

    <div
      v-if="status !== 'playing' && status !== 'rendering' && !useFallback"
      class="absolute inset-0 overflow-hidden pointer-events-none"
    >
      <!-- Ambient color wash — amber while connecting, red on error -->
      <div
        :class="[
          'absolute inset-0 transition-colors duration-300',
          status === 'error'
            ? 'bg-[radial-gradient(circle_at_center,hsl(var(--destructive)/0.18),transparent_70%)]'
            : 'bg-[radial-gradient(circle_at_center,hsl(var(--tac-amber)/0.12),transparent_70%)]',
        ]"
      />

      <!-- CRT-style horizontal grid lines for atmosphere. Subtle
           enough to read as texture, not noise. -->
      <div
        class="absolute inset-0 opacity-[0.06]"
        style="
          background-image: repeating-linear-gradient(
            0deg,
            currentColor 0,
            currentColor 1px,
            transparent 1px,
            transparent 4px
          );
        "
      />

      <!-- Center stack: spinner + status label -->
      <div
        class="absolute inset-0 flex flex-col items-center justify-center gap-3"
      >
        <!-- Connecting: a single clean spinner (no rings/dots). -->
        <div
          v-if="status === 'connecting'"
          class="size-12 rounded-full border-2 border-transparent border-t-[hsl(var(--tac-amber))] animate-spin"
          style="animation-duration: 1.4s"
        />

        <!-- Error: blinking marker. -->
        <div
          v-else-if="status === 'error'"
          class="size-3 bg-destructive shadow-[0_0_12px_hsl(var(--destructive)/0.8)] animate-pulse"
        />

        <p
          v-if="status === 'connecting'"
          class="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--tac-amber))]"
        >
          Acquiring signal
        </p>
        <p
          v-else-if="status === 'error' && isRetrying"
          class="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--tac-amber))]"
        >
          Acquiring signal
        </p>
        <p
          v-else-if="status === 'error'"
          class="max-w-[80%] text-center font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-destructive"
        >
          Signal lost<span
            class="block normal-case font-sans tracking-normal text-[0.65rem] mt-1 text-destructive/80"
          >
            {{ errorMessage }}
          </span>
        </p>
        <p
          v-else
          class="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground/70"
        >
          Idle
        </p>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Belt-and-suspenders: even with `disablepictureinpicture` and no
   `controls` attribute, Chrome can briefly flash its built-in media
   controls overlay (the small PiP/3-dot tray on hover) — particularly
   on small or floating videos. Nuke the WebKit pseudo-elements so we
   can guarantee only our own chrome is ever visible. */
video::-webkit-media-controls,
video::-webkit-media-controls-enclosure,
video::-webkit-media-controls-panel,
video::-webkit-media-controls-overlay-play-button,
video::-webkit-media-controls-pip-button,
video::-webkit-media-controls-toggle-pip-button,
video::-internal-media-controls-overlay-cast-button {
  display: none !important;
  appearance: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

/* Volume slider — minimal styling, sized small so it tucks beside
   the mute pill. h-1 track, 12px round thumb. Track gets a thin
   white tint; thumb is full white so it pops against dark video. */
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
