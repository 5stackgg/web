<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from "vue";
import { Button } from "~/components/ui/button";
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
import TopoBackground from "@/layouts/components/TopoBackground.vue";
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

const phase = ref<"preview" | "connecting" | "connected" | "error">(
  "preview",
);
const mediaErrorKind = ref<"denied" | "missing" | "busy" | "unknown" | null>(
  null,
);
const mediaPending = ref(false);
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

const coarsePointer = ref(
  typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches,
);

// Only a touch device has a portrait sensor worth asking for. A webcam handed
// a portrait constraint answers with a cropped or letterboxed frame, which is
// how a desktop feed ends up as a phone-shaped sliver -- so ask for nothing and
// publish whatever the camera calls native.
function videoConstraints(mode: "user" | "environment"): MediaTrackConstraints {
  const preferred: MediaTrackConstraints = coarsePointer.value
    ? { width: { ideal: 720 }, height: { ideal: 1280 } }
    : {};

  if (cameraDeviceId.value) {
    // An explicit device wins over facingMode -- asking for both lets the
    // browser satisfy the wrong one.
    return { ...preferred, deviceId: { exact: cameraDeviceId.value } };
  }

  return { ...preferred, facingMode: { ideal: mode } };
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

  if (!stream) {
    return reframeChain;
  }

  reframeChain = reframeChain
    .then(() => (cropping.value ? startCrop() : stopCrop()))
    .catch(() => {});

  return reframeChain;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistReframe();
  }, 500);
}

function setZoom(next: number) {
  const clamped = clamp(next, 1, MAX_ZOOM);

  if (clamped === reframe.zoom) {
    return;
  }

  reframe.zoom = clamped;
  void applyReframe(false);
  schedulePersist();
}

function resetReframe() {
  reframe.zoom = 1;
  reframe.x = 0.5;
  reframe.y = 0.5;
  void applyReframe();
}

const stageEl = ref<HTMLElement | null>(null);
const pointers = new Map<number, { x: number; y: number }>();
let pinchDistance = 0;
let pinchZoom = 1;
let dragOrigin = { pointerX: 0, pointerY: 0, x: 0.5, y: 0.5 };

// Registered by hand because the modifier form leaves the listener passive on
// some engines, and a passive wheel handler cannot stop the page scrolling.
function onWheel(event: WheelEvent) {
  if (!stream || !previewVisible.value) {
    return;
  }

  event.preventDefault();

  const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
  setZoom(reframe.zoom * Math.exp((-event.deltaY * lines) / 700));
}

function pointerDistance() {
  const [first, second] = [...pointers.values()];

  if (!first || !second) {
    return 0;
  }

  return Math.hypot(first.x - second.x, first.y - second.y);
}

// The frame is letterboxed inside the stage, so a drag has to be measured
// against the picture rather than the box it sits in.
function pictureSize(rect: DOMRect) {
  const el = previewEl.value;
  const ratio =
    el && el.videoWidth && el.videoHeight ? el.videoWidth / el.videoHeight : 0;

  if (!ratio || !rect.width || !rect.height) {
    return { width: rect.width, height: rect.height };
  }

  if (rect.width / rect.height > ratio) {
    return { width: rect.height * ratio, height: rect.height };
  }

  return { width: rect.width, height: rect.width / ratio };
}

function onPointerDown(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement;
  target.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size === 2) {
    pinchDistance = pointerDistance();
    pinchZoom = reframe.zoom;
    dragging.value = false;
    return;
  }

  if (pointers.size === 1 && cropping.value) {
    dragging.value = true;
    dragOrigin = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: reframe.x,
      y: reframe.y,
    };
  }
}

function onPointerMove(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) {
    return;
  }

  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size >= 2) {
    const distance = pointerDistance();

    if (pinchDistance > 0 && distance > 0) {
      setZoom(pinchZoom * (distance / pinchDistance));
    }

    return;
  }

  if (!dragging.value) {
    return;
  }

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const picture = pictureSize(rect);

  if (!picture.width || !picture.height) {
    return;
  }

  // Dragging moves the picture, so the crop window travels the other way, and
  // the preview is already magnified by the zoom.
  reframe.x =
    dragOrigin.x -
    (event.clientX - dragOrigin.pointerX) / (picture.width * reframe.zoom);
  reframe.y =
    dragOrigin.y -
    (event.clientY - dragOrigin.pointerY) / (picture.height * reframe.zoom);
  clampCentre();
}

function onPointerUp(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement;

  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }

  pointers.delete(event.pointerId);

  if (pointers.size < 2) {
    pinchDistance = 0;
  }

  if (pointers.size === 0) {
    dragging.value = false;
    persistReframe();
  }
}

function describeMediaError(error: unknown) {
  const name = (error as DOMException)?.name;

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "denied" as const;
  }

  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "missing" as const;
  }

  if (name === "NotReadableError" || name === "AbortError") {
    return "busy" as const;
  }

  return "unknown" as const;
}

// Local only -- nothing is published until they press connect. Framing, device
// and zoom are all things you want settled before you are on the broadcast.
async function startPreview() {
  mediaErrorKind.value = null;
  mediaPending.value = true;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints(facingMode),
      audio: true,
    });

    // Resolved before the controls render, so the device picker and flip
    // button are never a second frame that shifts the page.
    await refreshCameras();
    loadReframe();
    syncPreview();
    await applyReframe(false);
  } catch (error) {
    mediaErrorKind.value = describeMediaError(error);
  } finally {
    mediaPending.value = false;
  }
}

async function connect() {
  if (!stream) {
    await startPreview();
  }

  if (!stream) {
    return;
  }

  phase.value = "connecting";
  errorMessage.value = null;

  try {
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    publishPc = pc;

    // The already-running preview is what goes live, cropped exactly as they
    // left it -- captureStream is video only, so the microphone comes off the
    // camera stream beside it.
    const published = new MediaStream([
      ...(cropStream ?? stream).getVideoTracks(),
      ...stream.getAudioTracks(),
    ]);

    for (const track of published.getTracks()) {
      pc.addTrack(track, published);
    }

    await negotiateWebRtc(pc, cameraPlayerPublishUrl(token.value));

    phase.value = "connected";
    // Only start watching for a call now: the connect click was the user
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

  if (!stream) {
    await startPreview();
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
  void startPreview();
  navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
  stageEl.value?.addEventListener("wheel", onWheel, { passive: false });
});

function onDeviceChange() {
  void refreshCameras();
}

onBeforeUnmount(() => {
  navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
  stageEl.value?.removeEventListener("wheel", onWheel);

  if (persistTimer) {
    clearTimeout(persistTimer);
  }

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
  <!-- layout: false drops the app shell, so the standard background comes in
       explicitly rather than leaving this page on flat black. -->
  <TopoBackground />

  <div
    class="relative z-10 flex min-h-screen flex-col overflow-hidden text-foreground"
  >
    <main
      class="relative mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-3 px-4 py-6"
    >
      <div
        class="flex min-h-[3.5rem] items-center gap-3 rounded-xl border px-3 py-2 transition-colors"
        :class="
          phase === 'connected'
            ? 'border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.06)]'
            : 'border-border bg-card/40'
        "
      >
        <span
          class="inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.22em]"
          :class="
            phase === 'connected'
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
              : phase === 'error'
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-border bg-background/40 text-muted-foreground'
          "
        >
          <span class="relative flex h-1.5 w-1.5">
            <span
              v-if="phase === 'connected'"
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
            ></span>
            <span
              class="relative inline-flex h-1.5 w-1.5 rounded-full"
              :class="
                phase === 'connected'
                  ? 'bg-emerald-400'
                  : phase === 'error'
                    ? 'bg-destructive'
                    : 'bg-muted-foreground/60'
              "
            ></span>
          </span>
          {{ $t(`camera.phase.${phase}`) }}
        </span>

        <p class="min-w-0 flex-1 text-xs font-semibold leading-snug sm:text-sm">
          <template v-if="phase === 'connected'">
            {{ $t("camera.keep_open") }}
          </template>
          <template v-else-if="phase === 'connecting'">
            {{ $t("camera.connecting") }}
          </template>
          <template v-else-if="phase === 'error'">
            {{ $t("camera.error") }}
          </template>
          <template v-else>
            {{ $t("camera.headline_preview") }}
          </template>
        </p>

        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.2em] transition-colors"
          :class="
            previewVisible
              ? 'border-border bg-background/40 text-muted-foreground hover:text-foreground'
              : 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
          "
          :aria-label="
            previewVisible ? $t('camera.hide_preview') : $t('camera.show_preview')
          "
          :title="
            previewVisible ? $t('camera.hide_preview') : $t('camera.show_preview')
          "
          @click="togglePreview"
        >
          <component
            :is="previewVisible ? LucideEye : LucideEyeOff"
            class="h-2.5 w-2.5"
          />
          {{ $t("camera.preview") }}
        </button>
      </div>

      <!-- The stage is reserved from the device class, never from the track:
           dimensions only arrive on loadedmetadata and the page must not move
           when they do. The frame is contained inside it, so it is letterboxed
           at its true ratio and never cropped -- cropping here is only ever the
           deliberate reframe. -->
      <div
        ref="stageEl"
        class="relative w-full overflow-hidden rounded-xl border bg-black"
        :class="coarsePointer ? 'aspect-[3/4]' : 'aspect-video'"
      >
        <video
          v-show="previewVisible"
          ref="previewEl"
          class="absolute inset-0 h-full w-full object-contain"
          autoplay
          playsinline
          muted
        ></video>

        <div
          v-show="!previewVisible"
          class="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center"
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

        <div
          v-show="previewVisible && !mediaErrorKind && !mediaPending"
          class="absolute inset-0 z-10 touch-none select-none"
          :class="cropping ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <div
            v-show="cropping"
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
        </div>

        <span
          v-if="cropping && previewVisible"
          class="pointer-events-none absolute bottom-2 left-2 z-20 rounded-full border border-[hsl(var(--tac-amber)/0.5)] bg-black/70 px-2 py-0.5 font-mono text-[0.55rem] tabular-nums text-[hsl(var(--tac-amber))] backdrop-blur-sm"
        >
          {{ zoomPercent }}%
        </span>

        <button
          v-if="cropping && previewVisible"
          type="button"
          class="absolute bottom-2 right-2 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/70 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm transition-colors hover:border-white/40 hover:text-white"
          @click="resetReframe"
        >
          <LucideRotateCcw class="h-2.5 w-2.5" />
          {{ $t("camera.reframe_reset") }}
        </button>

        <div
          v-show="talking"
          class="absolute right-2 top-2 z-20 w-1/3 overflow-hidden rounded-lg border border-[hsl(var(--tac-amber)/0.5)] bg-black shadow-lg"
        >
          <div class="relative aspect-video">
            <video
              ref="talkEl"
              class="absolute inset-0 h-full w-full object-contain"
              autoplay
              playsinline
            ></video>
          </div>

          <div
            class="flex items-center justify-between gap-1 border-t border-[hsl(var(--tac-amber)/0.35)] px-1.5 py-1"
          >
            <span
              class="truncate font-mono text-[0.5rem] uppercase tracking-[0.16em] text-[hsl(var(--tac-amber))]"
            >
              {{ $t("camera.talk_label") }}
            </span>
            <button
              type="button"
              class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[hsl(var(--tac-amber))] transition-colors hover:bg-[hsl(var(--tac-amber)/0.15)]"
              :aria-label="
                talkMuted ? $t('camera.talk_unmute') : $t('camera.talk_mute')
              "
              :title="
                talkMuted ? $t('camera.talk_unmute') : $t('camera.talk_mute')
              "
              @click="toggleTalkAudio"
            >
              <component
                :is="talkMuted ? LucideVolumeX : LucideVolume2"
                class="h-2.5 w-2.5"
              />
            </button>
          </div>
        </div>

        <div
          v-if="mediaPending"
          class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center"
        >
          <LucideLoader2
            class="h-5 w-5 animate-spin text-[hsl(var(--tac-amber))]"
          />
          <p class="max-w-xs text-[11px] leading-snug text-muted-foreground">
            {{ $t("camera.media_pending") }}
          </p>
        </div>

        <div
          v-else-if="mediaErrorKind"
          class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center"
        >
          <LucideTriangleAlert class="h-6 w-6 text-destructive" />
          <p
            class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-destructive"
          >
            {{ $t("camera.error") }}
          </p>
          <p class="max-w-xs text-[11px] leading-snug text-muted-foreground">
            {{ $t(`camera.media_error.${mediaErrorKind}`) }}
          </p>
          <Button variant="secondary" size="sm" @click="startPreview">
            <LucideRefreshCw class="h-3.5 w-3.5" />
            {{ $t("camera.retry") }}
          </Button>
        </div>
      </div>

      <p
        class="text-center font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground/70"
      >
        {{ $t("camera.reframe_gesture") }}
      </p>

      <DeviceSelect
        v-if="realCameras.length > 1"
        :icon="LucideVideo"
        :devices="cameras"
        :model-value="cameraDeviceId"
        :active="true"
        @update:model-value="setCamera"
      />

      <Button
        v-if="canFlip"
        class="w-full"
        variant="outline"
        size="sm"
        @click="flipCamera"
      >
        <LucideSwitchCamera class="h-3.5 w-3.5" />
        {{ $t("camera.flip") }}
      </Button>

      <template v-if="phase !== 'connected'">
        <Button
          class="w-full"
          size="lg"
          variant="tactical"
          :loading="phase === 'connecting'"
          :disabled="!!mediaErrorKind || mediaPending"
          @click="connect"
        >
          <LucideVideo class="h-4 w-4" />
          {{ $t("camera.connect") }}
        </Button>

        <p
          v-if="phase === 'error' && errorMessage"
          class="break-words text-center font-mono text-[11px] leading-relaxed text-destructive"
        >
          {{ errorMessage }}
        </p>

        <p
          class="flex items-start gap-2 text-[11px] leading-snug text-muted-foreground/70"
        >
          <LucideShieldCheck class="mt-px h-3.5 w-3.5 shrink-0" />
          {{ $t("camera.permission_hint") }}
        </p>
      </template>

      <p
        class="border-t pt-3 text-center text-[11px] leading-relaxed text-muted-foreground/70"
      >
        {{ $t("camera.reason") }}
      </p>
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
