<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from "vue";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import {
  LucideCrop,
  LucideEye,
  LucideEyeOff,
  LucideLoader2,
  LucideRefreshCw,
  LucideRotateCcw,
  LucideShieldCheck,
  LucideSwitchCamera,
  LucideTriangleAlert,
  LucideVideo,
  LucideVolume2,
  LucideVolumeX,
} from "lucide-vue-next";
import DeviceSelect from "~/components/media/DeviceSelect.vue";
import {
  cameraPlayerPublishUrl,
  cameraPlayerTalkUrl,
  fetchCameraTalkStatus,
  hangupPlayerTalk,
  negotiateWebRtc,
} from "~/composables/useCameraApi";

definePageMeta({
  layout: false,
});

const route = useRoute();
const token = computed(() => String(route.params.token));

const phase = ref<"idle" | "connecting" | "connected" | "error">("idle");
const errorMessage = ref<string | null>(null);
const previewEl = ref<HTMLVideoElement | null>(null);
const sourceEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const talkEl = ref<HTMLVideoElement | null>(null);
const talking = ref(false);
const talkMuted = ref(false);

let stream: MediaStream | null = null;
let cropStream: MediaStream | null = null;
let publishPc: RTCPeerConnection | null = null;
let talkPc: RTCPeerConnection | null = null;
let facingMode: "user" | "environment" = "user";

const CAMERA_DEVICE_KEY = "5stack:camera:device";
const CAMERA_REFRAME_KEY = "5stack:camera:reframe";
const CAMERA_PREVIEW_KEY = "5stack:camera:preview";
const MAX_ZOOM = 3;

function readStored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Private browsing — the choice just won't persist.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const cameras = ref<Array<MediaDeviceInfo>>([]);
const cameraDeviceId = ref(readStored(CAMERA_DEVICE_KEY) ?? "");
const canFlip = ref(false);

// Browsers repeat the active camera as a synthetic "default" entry, so the raw
// count says "two cameras" on a laptop that only has one.
const realCameras = computed(() =>
  cameras.value.filter((device) => device.deviceId !== "default"),
);

async function refreshCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    cameras.value = devices.filter((device) => device.kind === "videoinput");
  } catch {
    // Labels only exist once permission has been granted; not fatal.
  }

  detectFlip();
}

// Flipping only means anything where the platform models cameras by which way
// they face. A desktop webcam reports no facingMode at all, so a second USB
// camera there is another angle, not another side — the picker handles those.
function detectFlip() {
  if (!navigator.mediaDevices?.getSupportedConstraints) {
    canFlip.value = false;
    return;
  }

  if (!navigator.mediaDevices.getSupportedConstraints().facingMode) {
    canFlip.value = false;
    return;
  }

  const [track] = stream?.getVideoTracks() ?? [];
  const facings = track?.getCapabilities?.().facingMode ?? [];

  if (facings.length > 1) {
    canFlip.value = true;
    return;
  }

  const exposesFacing = facings.length > 0 || !!track?.getSettings().facingMode;
  canFlip.value = exposesFacing && realCameras.value.length > 1;
}

function iceServers(): Array<RTCIceServer> {
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

// Asking for a resolution that matches the device's current orientation is
// what keeps a phone from publishing a sideways, letterboxed frame.
function videoConstraints(mode: "user" | "environment"): MediaTrackConstraints {
  const portrait =
    typeof window !== "undefined" &&
    window.matchMedia("(orientation: portrait)").matches;

  if (cameraDeviceId.value) {
    // An explicit device wins over facingMode -- asking for both lets the
    // browser satisfy the wrong one.
    return {
      deviceId: { exact: cameraDeviceId.value },
      width: { ideal: portrait ? 720 : 1280 },
      height: { ideal: portrait ? 1280 : 720 },
    };
  }

  return {
    facingMode: { ideal: mode },
    width: { ideal: portrait ? 720 : 1280 },
    height: { ideal: portrait ? 1280 : 720 },
  };
}

type Reframe = { zoom: number; x: number; y: number };

const reframe = reactive<Reframe>({ zoom: 1, x: 0.5, y: 0.5 });
const dragging = ref(false);
const previewVisible = ref(readStored(CAMERA_PREVIEW_KEY) !== "hidden");
const cropping = computed(() => reframe.zoom > 1.001);
const zoomPercent = computed(() => Math.round(reframe.zoom * 100));

// Detaching the stream is what actually frees the decode; hiding the element
// alone would keep the player's machine rendering a video it cannot see. The
// publish is a separate pipeline and is untouched either way.
function syncPreview() {
  const el = previewEl.value;

  if (!el) {
    return;
  }

  const next = previewVisible.value ? (cropStream ?? stream) : null;

  if (el.srcObject !== next) {
    el.srcObject = next;
  }
}

function togglePreview() {
  previewVisible.value = !previewVisible.value;
  writeStored(CAMERA_PREVIEW_KEY, previewVisible.value ? null : "hidden");
  syncPreview();
}

function reframeKey() {
  const [track] = stream?.getVideoTracks() ?? [];
  return track?.getSettings().deviceId || cameraDeviceId.value || "default";
}

function storedReframes(): Record<string, Partial<Reframe>> {
  const raw = readStored(CAMERA_REFRAME_KEY);

  if (!raw) {
    return {};
  }

  try {
    return (JSON.parse(raw) as Record<string, Partial<Reframe>>) ?? {};
  } catch {
    return {};
  }
}

function loadReframe() {
  const saved = storedReframes()[reframeKey()];

  reframe.zoom = clamp(toNumber(saved?.zoom, 1), 1, MAX_ZOOM);
  reframe.x = clamp(toNumber(saved?.x, 0.5), 0, 1);
  reframe.y = clamp(toNumber(saved?.y, 0.5), 0, 1);
  clampCentre();
}

function persistReframe() {
  const all = storedReframes();
  all[reframeKey()] = { zoom: reframe.zoom, x: reframe.x, y: reframe.y };
  writeStored(CAMERA_REFRAME_KEY, JSON.stringify(all));
}

function clampCentre() {
  const half = 0.5 / Math.max(1, reframe.zoom);
  reframe.x = clamp(reframe.x, half, 1 - half);
  reframe.y = clamp(reframe.y, half, 1 - half);
}

function drawCropFrame() {
  const source = sourceEl.value;
  const canvas = canvasEl.value;

  if (!source || !canvas) {
    return;
  }

  const width = source.videoWidth;
  const height = source.videoHeight;

  if (!width || !height) {
    return;
  }

  // The canvas keeps the camera's own dimensions and the crop is scaled up into
  // it, so zooming never renegotiates the published resolution mid-match.
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const zoom = Math.max(1, reframe.zoom);
  const cropWidth = width / zoom;
  const cropHeight = height / zoom;
  const left = clamp(reframe.x * width - cropWidth / 2, 0, width - cropWidth);
  const top = clamp(reframe.y * height - cropHeight / 2, 0, height - cropHeight);

  context.drawImage(
    source,
    left,
    top,
    cropWidth,
    cropHeight,
    0,
    0,
    width,
    height,
  );
  lastDrawAt = Date.now();
}

type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

let frameHandle: number | null = null;
let frameHandleIsVideo = false;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let lastDrawAt = 0;

function pumpCropFrames() {
  drawCropFrame();

  const source = sourceEl.value as FrameVideo | null;

  if (!source) {
    return;
  }

  if (source.requestVideoFrameCallback) {
    frameHandleIsVideo = true;
    frameHandle = source.requestVideoFrameCallback(pumpCropFrames);
    return;
  }

  frameHandleIsVideo = false;
  frameHandle = requestAnimationFrame(pumpCropFrames);
}

function startCropLoop() {
  stopCropLoop();
  pumpCropFrames();

  // captureStream only emits a frame when something draws to the canvas, and
  // both frame callbacks stop dead in a backgrounded tab — which is exactly
  // where this popup lives once the player alt-tabs into the game. The floor
  // keeps the publish alive (~1Hz there) instead of showing the organizer a
  // frozen feed.
  keepAliveTimer = setInterval(() => {
    if (Date.now() - lastDrawAt > 500) {
      drawCropFrame();
    }
  }, 500);
}

function stopCropLoop() {
  if (frameHandle !== null) {
    if (frameHandleIsVideo) {
      (sourceEl.value as FrameVideo | null)?.cancelVideoFrameCallback?.(
        frameHandle,
      );
    } else {
      cancelAnimationFrame(frameHandle);
    }

    frameHandle = null;
  }

  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function videoSender() {
  return (
    publishPc
      ?.getSenders()
      .find((candidate) => candidate.track?.kind === "video") ?? null
  );
}

async function startCrop() {
  const source = sourceEl.value;
  const canvas = canvasEl.value;

  if (!source || !canvas || !stream) {
    return;
  }

  if (source.srcObject !== stream) {
    source.srcObject = stream;
  }

  try {
    await source.play();
  } catch {
    // Already playing, or autoplay refused a stream we still own.
  }

  if (!source.videoWidth) {
    await new Promise<void>((resolve) => {
      const done = () => {
        source.removeEventListener("loadedmetadata", done);
        resolve();
      };

      source.addEventListener("loadedmetadata", done);
      setTimeout(done, 1000);
    });
  }

  drawCropFrame();

  if (!cropStream) {
    // captureStream is video only. Only the video sender is swapped, so the
    // microphone keeps riding the audio sender the publish opened with.
    cropStream = canvas.captureStream(30);
    const [track] = cropStream.getVideoTracks();
    await videoSender()?.replaceTrack(track ?? null);
  }

  syncPreview();
  startCropLoop();
}

async function stopCrop() {
  stopCropLoop();

  if (cropStream) {
    const [rawTrack] = stream?.getVideoTracks() ?? [];
    await videoSender()?.replaceTrack(rawTrack ?? null);

    for (const track of cropStream.getTracks()) {
      track.stop();
    }

    cropStream = null;
  }

  if (sourceEl.value) {
    sourceEl.value.srcObject = null;
  }

  syncPreview();
}

// Serialised: the zoom slider fires far faster than a track swap completes, and
// two overlapping starts would publish one canvas and leak the other.
let reframeChain: Promise<void> = Promise.resolve();

function applyReframe(persist = true) {
  clampCentre();

  if (persist) {
    persistReframe();
  }

  if (phase.value !== "connected") {
    return reframeChain;
  }

  reframeChain = reframeChain
    .then(() => (cropping.value ? startCrop() : stopCrop()))
    .catch(() => {});

  return reframeChain;
}

function setZoom(percent: number) {
  reframe.zoom = clamp(percent / 100, 1, MAX_ZOOM);
  void applyReframe();
}

function resetReframe() {
  reframe.zoom = 1;
  reframe.x = 0.5;
  reframe.y = 0.5;
  void applyReframe();
}

let dragPointer: number | null = null;
let dragOrigin = { pointerX: 0, pointerY: 0, x: 0.5, y: 0.5 };

function onDragStart(event: PointerEvent) {
  if (!cropping.value) {
    return;
  }

  const target = event.currentTarget as HTMLElement;
  target.setPointerCapture(event.pointerId);
  dragPointer = event.pointerId;
  dragging.value = true;
  dragOrigin = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    x: reframe.x,
    y: reframe.y,
  };
}

function onDragMove(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== dragPointer) {
    return;
  }

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return;
  }

  // Dragging moves the picture, so the crop window travels the other way, and
  // the preview is already magnified by the zoom.
  reframe.x =
    dragOrigin.x -
    (event.clientX - dragOrigin.pointerX) / (rect.width * reframe.zoom);
  reframe.y =
    dragOrigin.y -
    (event.clientY - dragOrigin.pointerY) / (rect.height * reframe.zoom);
  clampCentre();
}

function onDragEnd(event: PointerEvent) {
  if (!dragging.value) {
    return;
  }

  const target = event.currentTarget as HTMLElement;

  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }

  dragging.value = false;
  dragPointer = null;
  persistReframe();
}

async function connect() {
  phase.value = "connecting";
  errorMessage.value = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints(facingMode),
      audio: true,
    });

    syncPreview();

    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    publishPc = pc;

    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    await negotiateWebRtc(pc, cameraPlayerPublishUrl(token.value));

    phase.value = "connected";
    await refreshCameras();
    loadReframe();
    await applyReframe(false);
    // Only start watching for a call now: getUserMedia above was the user
    // gesture that lets the incoming stream play with audio.
    pollTalk();
  } catch (error) {
    phase.value = "error";
    errorMessage.value =
      error instanceof Error ? error.message : String(error);
  }
}

// Swaps the live track in place so the publish survives a camera change --
// renegotiating would drop the feed for a beat. Audio is deliberately left
// alone: it is already published, and re-requesting it would strand the sender
// on a stopped track.
async function useVideoTrack(mode: "user" | "environment") {
  const replacement = await navigator.mediaDevices.getUserMedia({
    video: videoConstraints(mode),
  });

  const [videoTrack] = replacement.getVideoTracks();

  if (!videoTrack) {
    return false;
  }

  const previous = stream?.getVideoTracks() ?? [];
  const next = new MediaStream([videoTrack, ...(stream?.getAudioTracks() ?? [])]);

  if (!cropping.value) {
    await videoSender()?.replaceTrack(videoTrack);
  }

  for (const track of previous) {
    track.stop();
  }

  stream = next;
  syncPreview();

  return true;
}

async function setCamera(deviceId: string) {
  cameraDeviceId.value = deviceId;
  writeStored(CAMERA_DEVICE_KEY, deviceId || null);

  if (phase.value !== "connected") {
    return;
  }

  try {
    if (await useVideoTrack(facingMode)) {
      loadReframe();
      await applyReframe(false);
      detectFlip();
    }
  } catch {
    // Keep the existing stream if the chosen camera is unavailable.
  }
}

async function flipCamera() {
  const next = facingMode === "user" ? "environment" : "user";
  const previousPick = cameraDeviceId.value;
  // Clear any explicit pick, or videoConstraints ignores the flip entirely.
  cameraDeviceId.value = "";

  try {
    if (await useVideoTrack(next)) {
      facingMode = next;
      writeStored(CAMERA_DEVICE_KEY, null);
      loadReframe();
      await applyReframe(false);
      detectFlip();
      return;
    }

    cameraDeviceId.value = previousPick;
  } catch {
    // Keep the existing stream if the other camera is unavailable.
    cameraDeviceId.value = previousPick;
  }
}

let talkTimer: ReturnType<typeof setTimeout> | null = null;

async function pollTalk() {
  const { ready } = await fetchCameraTalkStatus(token.value);

  if (ready && !talking.value) {
    await joinTalk();
  } else if (!ready && talking.value) {
    endTalk();
  }

  talkTimer = setTimeout(pollTalk, 2000);
}

async function joinTalk() {
  try {
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    talkPc = pc;
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    pc.ontrack = (event) => {
      if (!talkEl.value) {
        return;
      }

      talkEl.value.srcObject = event.streams[0];
      void playTalk();
    };

    await negotiateWebRtc(pc, cameraPlayerTalkUrl(token.value));
    talking.value = true;
  } catch {
    endTalk();
  }
}

// If autoplay refuses sound the promise rejects and nothing plays at all, so
// fall back to a muted start -- a picture with a visible unmute beats a black
// panel the player cannot fix.
async function playTalk() {
  const el = talkEl.value;

  if (!el) {
    return;
  }

  el.muted = talkMuted.value;

  try {
    await el.play();
  } catch {
    talkMuted.value = true;
    el.muted = true;
    await el.play().catch(() => {});
  }
}

function toggleTalkAudio() {
  talkMuted.value = !talkMuted.value;
  void playTalk();
}

function endTalk() {
  talking.value = false;
  talkMuted.value = false;
  talkPc?.close();
  talkPc = null;

  if (talkEl.value) {
    talkEl.value.srcObject = null;
  }
}

onMounted(() => {
  void refreshCameras();
  navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
});

function onDeviceChange() {
  void refreshCameras();
}

onBeforeUnmount(() => {
  navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);

  if (talkTimer) {
    clearTimeout(talkTimer);
  }

  endTalk();
  void hangupPlayerTalk(token.value);
  stopCropLoop();
  publishPc?.close();

  for (const track of cropStream?.getTracks() ?? []) {
    track.stop();
  }

  for (const track of stream?.getTracks() ?? []) {
    track.stop();
  }
});
</script>

<template>
  <div
    class="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground"
  >
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(70%_100%_at_50%_0%,hsl(var(--tac-amber)/0.10),transparent_72%)]"
    ></div>
    <div
      class="pointer-events-none absolute inset-0 opacity-[0.035]"
      style="
        background-image: repeating-linear-gradient(
          0deg,
          currentColor 0,
          currentColor 1px,
          transparent 1px,
          transparent 4px
        );
      "
    ></div>

    <main
      class="relative mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-6"
    >
      <section
        v-if="phase === 'idle'"
        class="flex flex-col items-center gap-6 text-center"
      >
        <div class="space-y-2">
          <h1 class="text-xl font-semibold tracking-tight">
            {{ $t("camera.title") }}
          </h1>
          <p class="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            {{ $t("camera.subtitle") }}
          </p>
        </div>

        <Button
          class="w-full max-w-sm"
          size="lg"
          variant="tactical"
          @click="connect"
        >
          <LucideVideo class="h-4 w-4" />
          {{ $t("camera.connect") }}
        </Button>

        <p
          class="flex max-w-sm items-start gap-2 text-left text-[11px] leading-snug text-muted-foreground"
        >
          <LucideShieldCheck class="mt-px h-3.5 w-3.5 shrink-0" />
          {{ $t("camera.permission_hint") }}
        </p>
      </section>

      <section
        v-else-if="phase === 'connecting'"
        class="flex flex-col items-center gap-4"
      >
        <LucideLoader2
          class="h-6 w-6 animate-spin text-[hsl(var(--tac-amber))]"
        />
        <p
          class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
        >
          {{ $t("camera.connecting") }}
        </p>
      </section>

      <section
        v-else-if="phase === 'error'"
        class="flex flex-col items-center gap-5 text-center"
      >
        <span
          class="flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/40 bg-destructive/10 text-destructive"
        >
          <LucideTriangleAlert class="h-5 w-5" />
        </span>

        <div class="space-y-2">
          <h1 class="text-base font-semibold tracking-tight">
            {{ $t("camera.error") }}
          </h1>
          <p
            class="mx-auto max-w-sm break-words font-mono text-[11px] leading-relaxed text-muted-foreground"
          >
            {{ errorMessage }}
          </p>
        </div>

        <Button class="w-full max-w-sm" variant="secondary" @click="connect">
          <LucideRefreshCw class="h-4 w-4" />
          {{ $t("camera.retry") }}
        </Button>
      </section>

      <div v-show="phase === 'connected'" class="flex flex-col gap-3">
        <!-- No object-cover and no forced aspect ratio: either one crops a frame
             whose real ratio does not match the box. Cropping here is only ever
             the deliberate reframe below. -->
        <div class="relative overflow-hidden rounded-xl border bg-black">
          <video
            v-show="previewVisible"
            ref="previewEl"
            class="block w-full bg-black"
            autoplay
            playsinline
            muted
          ></video>

          <div
            v-if="!previewVisible"
            class="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center"
          >
            <LucideEyeOff class="h-5 w-5 text-muted-foreground/60" />
            <p
              class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
            >
              {{ $t("camera.preview_hidden") }}
            </p>
            <p class="max-w-xs text-[11px] leading-snug text-muted-foreground/80">
              {{ $t("camera.preview_hidden_hint") }}
            </p>
          </div>

          <span
            class="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-2 rounded-full border border-emerald-500/50 bg-black/70 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.22em] text-emerald-400 backdrop-blur-sm"
          >
            <span class="relative flex h-1.5 w-1.5">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
              ></span>
              <span
                class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"
              ></span>
            </span>
            {{ $t("camera.live") }}
          </span>

          <div
            v-show="cropping && previewVisible"
            class="absolute inset-0 touch-none select-none"
            :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
            @pointerdown="onDragStart"
            @pointermove="onDragMove"
            @pointerup="onDragEnd"
            @pointercancel="onDragEnd"
          >
            <div
              class="absolute inset-3 border border-[hsl(var(--tac-amber)/0.4)]"
            >
              <span
                class="absolute inset-y-0 left-1/3 w-px bg-[hsl(var(--tac-amber)/0.2)]"
              ></span>
              <span
                class="absolute inset-y-0 left-2/3 w-px bg-[hsl(var(--tac-amber)/0.2)]"
              ></span>
              <span
                class="absolute inset-x-0 top-1/3 h-px bg-[hsl(var(--tac-amber)/0.2)]"
              ></span>
              <span
                class="absolute inset-x-0 top-2/3 h-px bg-[hsl(var(--tac-amber)/0.2)]"
              ></span>
            </div>

            <span
              v-if="!dragging"
              class="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-[hsl(var(--tac-amber)/0.5)] bg-black/70 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))] backdrop-blur-sm"
            >
              {{ $t("camera.reframe_drag") }}
            </span>
          </div>
        </div>

        <p class="text-center text-[11px] leading-snug text-muted-foreground">
          {{ $t("camera.keep_open") }}
        </p>

        <DeviceSelect
          v-if="realCameras.length > 1"
          :icon="LucideVideo"
          :devices="cameras"
          :model-value="cameraDeviceId"
          :active="true"
          @update:model-value="setCamera"
        />

        <div class="flex flex-wrap gap-2">
          <Button
            v-if="canFlip"
            class="flex-1"
            variant="outline"
            size="sm"
            @click="flipCamera"
          >
            <LucideSwitchCamera class="h-3.5 w-3.5" />
            {{ $t("camera.flip") }}
          </Button>

          <Button
            class="flex-1"
            variant="outline"
            size="sm"
            @click="togglePreview"
          >
            <component
              :is="previewVisible ? LucideEyeOff : LucideEye"
              class="h-3.5 w-3.5"
            />
            {{
              previewVisible
                ? $t("camera.hide_preview")
                : $t("camera.show_preview")
            }}
          </Button>
        </div>

        <div
          v-show="previewVisible"
          class="space-y-3 rounded-xl border bg-card/40 p-3"
        >
          <div class="flex items-center justify-between gap-3">
            <span
              class="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
            >
              <LucideCrop class="h-3 w-3" />
              {{ $t("camera.reframe") }}
            </span>
            <span
              class="font-mono text-[0.68rem] tabular-nums"
              :class="
                cropping
                  ? 'text-[hsl(var(--tac-amber))]'
                  : 'text-muted-foreground'
              "
            >
              {{ zoomPercent }}%
            </span>
          </div>

          <Slider
            :model-value="[zoomPercent]"
            :min="100"
            :max="300"
            :step="5"
            @update:model-value="(value) => setZoom(value?.[0] ?? 100)"
          />

          <div class="flex items-end justify-between gap-3">
            <p class="text-[11px] leading-snug text-muted-foreground">
              {{
                cropping ? $t("camera.reframe_hint") : $t("camera.reframe_idle")
              }}
            </p>
            <Button
              class="shrink-0"
              variant="ghost"
              size="xs"
              :disabled="!cropping"
              @click="resetReframe"
            >
              <LucideRotateCcw class="h-3 w-3" />
              {{ $t("camera.reframe_reset") }}
            </Button>
          </div>
        </div>
      </div>

      <div
        v-show="talking"
        class="relative overflow-hidden rounded-xl border border-[hsl(var(--tac-amber)/0.4)] bg-black"
      >
        <video
          ref="talkEl"
          class="block w-full bg-black"
          autoplay
          playsinline
        ></video>

        <span
          class="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--tac-amber)/0.5)] bg-black/70 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.22em] text-[hsl(var(--tac-amber))] backdrop-blur-sm"
        >
          {{ $t("camera.talk_label") }}
        </span>

        <Button
          class="absolute bottom-2 right-2 h-7 gap-1.5 border-[hsl(var(--tac-amber)/0.5)] bg-black/70 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-[hsl(var(--tac-amber))] hover:bg-black/90 hover:text-[hsl(var(--tac-amber))]"
          variant="outline"
          size="xs"
          @click="toggleTalkAudio"
        >
          <component
            :is="talkMuted ? LucideVolumeX : LucideVolume2"
            class="h-3 w-3"
          />
          {{ talkMuted ? $t("camera.talk_unmute") : $t("camera.talk_mute") }}
        </Button>
      </div>
    </main>

    <video
      ref="sourceEl"
      class="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
      aria-hidden="true"
      autoplay
      playsinline
      muted
    ></video>
    <canvas
      ref="canvasEl"
      class="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
      aria-hidden="true"
    ></canvas>
  </div>
</template>
