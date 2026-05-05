<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
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

async function toggleFullscreen() {
  const target = containerRef.value;
  if (!target) return;
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => undefined);
  } else {
    await target.requestFullscreen().catch(() => undefined);
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}

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
    e.preventDefault();
    void toggleFullscreen();
  } else if (e.key === "m" || e.key === "M") {
    e.preventDefault();
    toggleMute();
  }
}

let pc: RTCPeerConnection | null = null;
let retryHandle: ReturnType<typeof setTimeout> | null = null;
// Cancelled at teardown — any in-flight retry attempt checks this
// before re-issuing connect() so unmount doesn't leak a connect after
// the component is gone.
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

async function connect() {
  if (!props.whepUrl) {
    console.debug("[whep] connect skipped: no whepUrl");
    return;
  }
  if (!videoRef.value) {
    console.debug("[whep] connect skipped: <video> not mounted yet");
    return;
  }
  // SRT publisher is down during a render. The clipRenderActive
  // watcher kicks off a fresh connect when the render finishes.
  if (clipRenderActive.value) {
    console.debug("[whep] connect skipped: clip render in progress");
    return;
  }

  await teardown();
  status.value = "connecting";
  errorMessage.value = null;
  console.debug("[whep] connecting to", props.whepUrl);

  try {
    pc = new RTCPeerConnection({
      iceServers: props.iceServers ?? [
        { urls: "stun:stun.l.google.com:19302" },
      ],
    });

    // mediamtx WHEP egress is recv-only from the browser's perspective.
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    pc.ontrack = (event) => {
      const el = videoRef.value;
      if (!el || !event.streams[0]) return;
      // Set muted/autoplay in JS — Vue's :muted binding can land after
      // mount, and Chrome's autoplay policy reads the property at play().
      el.muted = true;
      el.autoplay = true;
      el.playsInline = true;
      el.srcObject = event.streams[0];
      // Assigning srcObject after mount doesn't re-trigger autoplay in
      // Chrome/Safari, so call play() explicitly with one retry.
      const tryPlay = () =>
        el.play().catch((err) => {
          console.debug("[whep] autoplay blocked:", err?.name ?? err);
          el.muted = true;
          return el.play().catch((retryErr) => {
            console.warn(
              "[whep] autoplay blocked after retry:",
              retryErr?.name ?? retryErr,
            );
          });
        });
      void tryPlay();
    };

    pc.onconnectionstatechange = () => {
      const state = pc?.connectionState;
      console.debug("[whep] connectionState=", state);
      if (state === "connected") {
        status.value = "playing";
      } else if (state === "failed" || state === "disconnected") {
        // Peer dropped mid-stream. During a render, keep the last
        // frame and show "rendering" — clipRenderActive watcher reconnects.
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

    // Wait for ICE gathering to complete so we send a non-trickle
    // offer — mediamtx's WHEP endpoint is single-shot (no PATCH for
    // trickle ICE candidates), so the SDP must include all candidates.
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
    // Reset backoff so a future drop starts retrying fast.
    retryDelay = INITIAL_RETRY_DELAY_MS;
    failureCount = 0;
    hasEverPlayed = true;
    isRetrying.value = false;
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    // Connect raced with a render starting. clipRenderActive watcher
    // will retry when the render finishes.
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
    // mediamtx 404s until the SRT publisher registers; always retry —
    // the parent page unmounts us when the session ends.
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

// When the SRT publisher drops, RTCPeerConnection stays "connected"
// but currentTime stops advancing. Poll and force a reconnect on stall.
const STALL_MS = 5_000;
let stallTimer: ReturnType<typeof setInterval> | null = null;
let lastTime = 0;
let lastTimeAt = 0;

function startStallWatch() {
  stopStallWatch();
  lastTime = videoRef.value?.currentTime ?? 0;
  lastTimeAt = Date.now();
  stallTimer = setInterval(() => {
    const el = videoRef.value;
    if (!el || status.value !== "playing" || cancelled || useFallback.value) {
      return;
    }
    if (clipRenderActive.value) {
      // Reset so the timer doesn't fire the moment the render ends.
      lastTime = el.currentTime;
      lastTimeAt = Date.now();
      return;
    }
    const now = el.currentTime;
    if (now !== lastTime) {
      lastTime = now;
      lastTimeAt = Date.now();
      return;
    }
    if (Date.now() - lastTimeAt < STALL_MS) return;
    console.debug("[whep] stalled — forcing reconnect");
    lastTimeAt = Date.now();
    retryDelay = INITIAL_RETRY_DELAY_MS;
    void teardown().then(() => connect());
  }, 1_000);
}

function stopStallWatch() {
  if (stallTimer) {
    clearInterval(stallTimer);
    stallTimer = null;
  }
}

// Wait for mount so videoRef is bound — `immediate: true` fires
// during setup before the template renders.
onMounted(() => {
  void connect();
  startStallWatch();
  document.addEventListener("fullscreenchange", onFullscreenChange);
  window.addEventListener("keydown", onKeyDown);
});

// Force a fresh connect when a render ends — the publisher was
// restarted, so the existing peer is dead regardless of state.
watch(clipRenderActive, (active, was) => {
  if (was && !active) {
    console.debug("[whep] clip render ended — forcing reconnect");
    retryDelay = INITIAL_RETRY_DELAY_MS;
    void teardown().then(() => connect());
  }
});

// Reconnect on URL change (user switches matches).
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
  window.removeEventListener("keydown", onKeyDown);
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
         reads them eagerly and a late :muted binding loses the race. -->
    <video
      v-show="!useFallback"
      ref="videoRef"
      class="absolute inset-0 h-full w-full object-contain"
      autoplay
      muted
      playsinline
    />

    <div
      v-if="status === 'playing' && !useFallback"
      :class="[
        'absolute bottom-2 right-2 z-10 flex items-center gap-2 transition-opacity duration-150',
        isMuted
          ? 'opacity-100'
          : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
      ]"
    >
      <div class="flex items-center group/vol">
        <button
          type="button"
          :aria-label="isMuted ? 'Unmute' : 'Mute'"
          class="inline-flex size-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/90 backdrop-blur-sm transition-colors duration-150 hover:bg-black/80 hover:text-white cursor-pointer"
          @click="toggleMute"
        >
          <VolumeX v-if="isMuted" class="size-3.5" />
          <Volume2 v-else class="size-3.5" />
        </button>
        <!-- Slider grows to its full width on volume-pill hover. The
             range input itself is styled minimal — track + thumb in
             the deck colors so it doesn't fight the broadcast feel. -->
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="isMuted ? 0 : volume"
          aria-label="Volume"
          class="vol-slider ml-0 w-0 group-hover/vol:w-20 group-hover/vol:ml-2 focus-visible:w-20 focus-visible:ml-2 transition-all duration-200 cursor-pointer"
          @input="setVolume(Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <button
        type="button"
        :aria-label="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
        title="Fullscreen (F)"
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
        Rendering clip<span class="whep-dots" />
      </span>
    </div>

    <!-- Status overlay (connecting / error). pointer-events-none so
         clicks pass through to the <video> below. Visually evokes a
         broadcast deck "signal acquisition" pattern: ambient amber
         pulse + horizontal scanline sweep + animated radar ring +
         mono uppercase status, swapping to a destructive-themed
         glitch frame on error. Suppressed during 'rendering' since
         the freeze-frame already conveys the state. -->
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

      <!-- Sweeping scanline — the signature loading motif. Hidden on
           error so the frame settles. -->
      <div
        v-if="status === 'connecting'"
        class="whep-scanline absolute inset-x-0 h-px bg-[linear-gradient(to_right,transparent_0%,hsl(var(--tac-amber))_50%,transparent_100%)] shadow-[0_0_10px_hsl(var(--tac-amber)/0.7)]"
      />

      <!-- Center stack: radar ring + status label -->
      <div
        class="absolute inset-0 flex flex-col items-center justify-center gap-3"
      >
        <!-- Connecting: layered radar — outer pulsing ring, inner
             spinning arc, dot core. -->
        <div v-if="status === 'connecting'" class="relative size-16">
          <span
            class="absolute inset-0 rounded-full border border-[hsl(var(--tac-amber)/0.35)] whep-radar-ping"
          />
          <span
            class="absolute inset-2 rounded-full border border-[hsl(var(--tac-amber)/0.2)]"
          />
          <span
            class="absolute inset-0 rounded-full border-2 border-transparent border-t-[hsl(var(--tac-amber))] animate-spin"
            style="animation-duration: 1.4s"
          />
          <span
            class="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--tac-amber))] shadow-[0_0_10px_hsl(var(--tac-amber))]"
          />
        </div>

        <!-- Error: filled red square w/ slow blink instead of motion -->
        <div
          v-else-if="status === 'error'"
          class="size-3 bg-destructive shadow-[0_0_12px_hsl(var(--destructive)/0.8)] animate-pulse"
        />

        <!-- Idle: simple dim dot -->
        <div v-else class="size-2 rounded-full bg-muted-foreground/40" />

        <!-- Status label. The trailing dots animate via CSS so the
             text reads "Acquiring signal..." with a live cadence. -->
        <p
          v-if="status === 'connecting'"
          class="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--tac-amber))]"
        >
          Acquiring signal<span class="whep-dots" />
        </p>
        <p
          v-else-if="status === 'error' && isRetrying"
          class="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--tac-amber))]"
        >
          Acquiring signal<span class="whep-dots" />
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

      <!-- Indeterminate progress bar at the bottom edge — caps the
           scanline motion so the eye has a second indicator that
           something is in flight. Connecting only. -->
      <div
        v-if="status === 'connecting'"
        class="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-[hsl(var(--tac-amber)/0.15)]"
      >
        <div
          class="whep-progress absolute inset-y-0 w-1/3 bg-[linear-gradient(to_right,transparent,hsl(var(--tac-amber)),transparent)]"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scanline that sweeps top → bottom of the player while we're
   connecting. Easing favors a slow body and quick fade at the edges
   so the eye locks onto the middle of the sweep. */
@keyframes whep-scanline-sweep {
  0% {
    top: 0;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    top: 100%;
    opacity: 0;
  }
}
.whep-scanline {
  animation: whep-scanline-sweep 2.4s linear infinite;
}

/* Outer radar ring that fades + scales like a sonar ping. */
@keyframes whep-radar-ping {
  0% {
    transform: scale(0.7);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
}
.whep-radar-ping {
  animation: whep-radar-ping 1.6s cubic-bezier(0.25, 0.65, 0.45, 1) infinite;
}

/* Cycling "..." after the status label. Width animates so the dots
   appear one by one, then reset. steps() keeps it discrete instead of
   sliding. */
.whep-dots {
  display: inline-block;
  overflow: hidden;
  vertical-align: bottom;
  width: 0;
  animation: whep-dots 1.5s steps(4, end) infinite;
}
.whep-dots::before {
  content: "...";
}
@keyframes whep-dots {
  0% {
    width: 0;
  }
  100% {
    width: 1.4em;
  }
}

/* Indeterminate bar at the bottom — slides a soft amber gradient
   from off-left to off-right to suggest "in progress, no known
   total". */
@keyframes whep-progress-slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(400%);
  }
}
.whep-progress {
  animation: whep-progress-slide 1.8s cubic-bezier(0.45, 0, 0.55, 1) infinite;
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

/* Respect reduced-motion preferences — drop the live motion but
   keep the static frame so the loader is still legible. */
@media (prefers-reduced-motion: reduce) {
  .whep-scanline,
  .whep-radar-ping,
  .whep-dots,
  .whep-progress {
    animation: none;
  }
  .whep-dots {
    width: 1.4em;
  }
}
</style>
