<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { Volume2, VolumeX, Maximize2, Minimize2 } from "lucide-vue-next";
import { useClipRenderActive } from "~/composables/useClipRenderActive";

const { active: clipRenderActive } = useClipRenderActive();

// Plays a mediamtx WebRTC (WHEP) stream in a <video> element.
// WHEP = "WebRTC-HTTP Egress Protocol" — single POST exchanges an SDP
// offer for an SDP answer; mediamtx serves it at $base/<path>/whep.
//
// We rely entirely on the browser's built-in RTCPeerConnection. No
// dependency on whep.js or webrtc-adapter — modern Chromium / Firefox
// / Safari all support the bare WHEP exchange.
//
// Latency: ~100–500ms end-to-end (vs ~2s on LL-HLS, ~6–30s on plain HLS).

const props = defineProps<{
  whepUrl: string;
  // Optional: extra ICE servers (TURN) for restrictive NATs. STUN is
  // hardcoded to a public Google server below as a sane default.
  iceServers?: RTCIceServer[];
  muted?: boolean;
  fallbackUrl?: string | null;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const status = ref<"idle" | "connecting" | "playing" | "error">("idle");
const useFallback = ref(false);
let failureCount = 0;
const MAX_WHEP_FAILURES = 3;
// True once WHEP has played a single frame. After that, never fall
// back to HLS — keep retrying WHEP forever. mediamtx briefly drops
// the path during clip-render's restart_capture; falling back to HLS
// at that moment locks us at ~2s latency for the rest of the session.
let hasEverPlayed = false;
const errorMessage = ref<string | null>(null);
// True while a retry is queued. Lets the UI render the amber
// "acquiring signal" state instead of the red destructive "signal
// lost" — important for the demo flow where the stream is expected
// to take a few seconds to come online after status='live'.
const isRetrying = ref(false);
// Tracks whether the element is currently muted so we can show / hide
// the click-to-unmute overlay. Element starts muted so autoplay works
// without prior user interaction; one click flips it.
const isMuted = ref(true);
const volume = ref(1);
const isFullscreen = ref(false);
const containerRef = ref<HTMLDivElement | null>(null);

function setVolume(v: number) {
  volume.value = Math.max(0, Math.min(1, v));
  const el = videoRef.value;
  if (!el) return;
  el.volume = volume.value;
  // Slider drag below 0.01 reads as "they want it off". Above 0
  // implicitly unmutes.
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
      // Force every property browsers check before allowing programmatic
      // playback. Doing this in JS (not just template attributes) is
      // load-bearing — Vue's `:muted` binding can land *after* the
      // element is mounted, and Chrome's autoplay policy reads the
      // current property at play() time, not the original attribute.
      el.muted = true;
      el.autoplay = true;
      el.playsInline = true;
      el.srcObject = event.streams[0];
      // The `autoplay` HTML attribute kicks playback off when the
      // element first gets a src, but assigning `srcObject` later
      // (after the element has been mounted with no source) does NOT
      // re-trigger autoplay in Chrome/Safari. Call play() ourselves
      // and retry once on failure with a fresh muted/srcObject.
      const tryPlay = () =>
        el.play().catch((err) => {
          console.debug("[whep] autoplay blocked:", err?.name ?? err);
          // One retry: re-assert muted, then play again. Some Safari
          // versions reject the first play() if any audio track is
          // attached even with muted=true on the element.
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
        // The peer dropped mid-stream (e.g. clip render killed the SRT
        // publisher). The catch-block retry only fires for connect-time
        // failures, so without this we'd sit in "error" forever.
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
    // Successful negotiation — reset the backoff so a future drop
    // (e.g. caster swap → momentary stream gap) starts retrying fast
    // again instead of inheriting an aged 5s delay.
    retryDelay = INITIAL_RETRY_DELAY_MS;
    failureCount = 0;
    hasEverPlayed = true;
    isRetrying.value = false;
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
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
    // mediamtx returns 404 with body "no stream is available on path
    // <id>" until the SRT publisher has registered; same shape on a
    // brief mid-stream gap. Always retry — the demo session's parent
    // page tears us down (via v-if on store.isLive) when the session
    // genuinely ends, so we don't have to be conservative here.
    scheduleRetry();
  }
}

function scheduleRetry() {
  if (cancelled || useFallback.value) return;
  if (retryHandle) clearTimeout(retryHandle);
  isRetrying.value = true;
  retryHandle = setTimeout(() => {
    retryHandle = null;
    if (cancelled || useFallback.value) return;
    void connect();
  }, retryDelay);
  // Exponential up to a 5s cap. Slow-publish recovery is usually
  // sub-second; the cap is there so an extended outage doesn't burn
  // the cpu / network re-attempting every 100ms forever.
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
    // Hard cap so a single dropped UDP packet doesn't hang the
    // connect — mediamtx will accept what we have.
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

// When mediamtx loses the SRT publisher (e.g. the pod stops the live
// capture during a clip render and restarts it), the browser's
// RTCPeerConnection stays "connected" but no media flows — the video
// element freezes. Poll currentTime and force a reconnect if it
// hasn't advanced for STALL_MS.
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
      // Reset the timer so it doesn't fire the moment the render ends.
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

// Initial connect runs after the DOM is mounted so videoRef is bound.
// (A watcher with `immediate: true` fires during setup, before the
// template renders, so the <video> element doesn't exist yet and
// connect() bails out — leaving status stuck at "idle".)
onMounted(() => {
  void connect();
  startStallWatch();
  document.addEventListener("fullscreenchange", onFullscreenChange);
  window.addEventListener("keydown", onKeyDown);
});

// When a clip render finishes, force a fresh connect — the publisher
// was killed and restarted on the pod, so the existing peer is dead
// regardless of what connectionState reports.
watch(clipRenderActive, (active, was) => {
  if (was && !active) {
    console.debug("[whep] clip render ended — forcing reconnect");
    retryDelay = INITIAL_RETRY_DELAY_MS;
    void teardown().then(() => connect());
  }
});

// Reconnect whenever the URL changes (e.g. user switches matches).
watch(
  () => props.whepUrl,
  () => {
    // URL change = a fresh connect attempt; reset the retry budget so
    // we don't inherit a 5s backoff from the previous URL's flakiness.
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

// Mute toggle for the overlay button. Reuses the `unmute()` helper
// declared above (which handles the play() re-kick browsers require
// after a programmatic mute change) so all unmute paths run the same
// gesture-bound recovery.
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
  <!-- `aspect-video` is the default sizing for inline embeds, but parents
       that render us inside `absolute inset-0` (the demo-player popup)
       want us to stretch — `aspect-[unset]` lets the parent's height
       win in that case. -->
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

    <!-- `muted` and `autoplay` written as static attributes (not Vue
         bindings) so they're present on the element from the very
         first render — Chrome's autoplay gate reads them eagerly and
         a late-arriving :muted binding can lose the race.
         Native controls are intentionally omitted — we surface only a
         minimal mute toggle on hover via the overlay below. -->
    <!-- object-contain so the 16:9 stream letterboxes inside whatever
         box the parent gives us instead of cropping to fill. The
         absolute inset-0 + h-full/w-full keeps the empty <video> from
         falling back to its 300px intrinsic size on first paint. -->
    <video
      v-show="!useFallback"
      ref="videoRef"
      class="absolute inset-0 h-full w-full object-contain"
      autoplay
      muted
      playsinline
    />

    <!-- Bottom-right control cluster: mute pill (with hover-revealed
         volume slider) + fullscreen toggle. The whole strip fades in
         on hover; the mute pill stays visible while muted so users
         have an affordance to enable audio without hunting for it. -->
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
    <!-- Status overlay (connecting / error). pointer-events-none so
         clicks pass through to the <video> below. Visually evokes a
         broadcast deck "signal acquisition" pattern: ambient amber
         pulse + horizontal scanline sweep + animated radar ring +
         mono uppercase status, swapping to a destructive-themed
         glitch frame on error. -->
    <div
      v-if="status !== 'playing' && !useFallback"
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
