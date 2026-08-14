<script setup lang="ts">
import {
  ref,
  reactive,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
} from "vue";
import { Button } from "~/components/ui/button";
import {
  LucideCrop,
  LucideEye,
  LucideEyeOff,
  LucideLoader2,
  LucideMic,
  LucideRadioTower,
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
import VoiceSettingsButton from "~/components/voice/VoiceSettingsButton.vue";
import MatchVoicePanel from "~/components/match/MatchVoicePanel.vue";
import TopoBackground from "@/layouts/components/TopoBackground.vue";
import { generateQuery } from "~/graphql/graphqlGen";
import { useAudioSettings } from "~/composables/useAudioSettings";
import { useMicPipeline } from "~/composables/useMicPipeline";
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

// This runs on the player's own machine for the length of a match, next to the
// game. A monitoring camera is watched in a tile a few hundred pixels wide, so
// capturing and encoding anything near a modern sensor's native resolution is
// frames per second spent on detail nobody looks at. Everything below is an
// `ideal`: a camera that cannot do it keeps working at whatever it can.
const CAPTURE_FPS = 24;
// Enough for a face and a pair of hands in a grid tile, and roughly a third of
// the encode cost of the 720p the browser hands out by default.
const CAPTURE_BITRATE = 350_000;

// Only a touch device has a portrait sensor worth asking for. A webcam handed
// a portrait constraint answers with a cropped or letterboxed frame, which is
// how a desktop feed ends up as a phone-shaped sliver -- so constrain only the
// height there and let the camera keep its own aspect.
function videoConstraints(mode: "user" | "environment"): MediaTrackConstraints {
  const preferred: MediaTrackConstraints = coarsePointer.value
    ? {
        width: { ideal: 480 },
        height: { ideal: 854 },
        frameRate: { ideal: CAPTURE_FPS, max: 30 },
      }
    : {
        height: { ideal: 360 },
        frameRate: { ideal: CAPTURE_FPS, max: 30 },
      };

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
const previewHidden = ref(readStored(CAMERA_PREVIEW_KEY) === "hidden");

// Hiding is only ever offered as a way to save the player's machine some work
// once they are already live. During setup the preview is always on -- framing
// yourself is the whole point of the step, and a stored "hidden" from an
// earlier match must not leave someone setting up against a blank stage.
const previewVisible = computed(
  () => phase.value !== "connected" || !previewHidden.value,
);
const cropping = computed(() => reframe.zoom > 1.001);
const zoomPercent = computed(() => Math.round(reframe.zoom * 100));

// Detaching the stream is what actually frees the decode; hiding the element
// alone would keep the player's machine rendering a video it cannot see. The
// publish is a separate pipeline and is untouched either way.
//
// While cropping, the canvas is what gets shown -- it is already the exact
// surface being published. Feeding its captured stream back into a <video>
// would decode the frames this machine just finished drawing.
function syncPreview() {
  const el = previewEl.value;

  if (!el) {
    return;
  }

  const next = previewVisible.value && !cropping.value ? stream : null;

  if (el.srcObject !== next) {
    el.srcObject = next;
  }
}

function togglePreview() {
  previewHidden.value = !previewHidden.value;
  writeStored(CAMERA_PREVIEW_KEY, previewHidden.value ? "hidden" : null);
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

// Held across frames: getContext is a lookup, not a constructor, but it was
// being called on every single drawn frame. `alpha: false` lets the compositor
// skip a blend a camera frame never needs. Deliberately not `desynchronized`:
// that hands frames straight to the display and is not reliably sampled by
// captureStream, which is the whole point of this canvas.
let canvasContext: CanvasRenderingContext2D | null = null;

function cropContext(canvas: HTMLCanvasElement) {
  if (!canvasContext || canvasContext.canvas !== canvas) {
    canvasContext = canvas.getContext("2d", { alpha: false });
  }

  return canvasContext;
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

  const context = cropContext(canvas);

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

// Frame callbacks fire at the camera's rate, which can be well above what is
// published; drawing more often than captureStream will sample is work thrown
// straight away.
const MIN_DRAW_INTERVAL_MS = 1000 / CAPTURE_FPS - 2;

function pumpCropFrames() {
  if (Date.now() - lastDrawAt >= MIN_DRAW_INTERVAL_MS) {
    drawCropFrame();
  }

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

function audioSender() {
  return (
    publishPc
      ?.getSenders()
      .find((candidate) => candidate.track?.kind === "audio") ?? null
  );
}

// The microphone goes through exactly the same pipeline as a voice channel:
// same device choice, same noise suppression, same gate, same mic check. An
// organizer listening to a camera feed is listening to a player's microphone,
// so there is no reason for it to behave differently here.
const audioSettings = useAudioSettings();
const mic = useMicPipeline({
  onTrack: (track) => {
    void audioSender()?.replaceTrack(track).catch(() => {});
  },
});

// Metered while they are still setting up, so the indicator moves as they talk
// and they can tell the microphone works before going live. Once live it costs
// nothing until they open the settings, which turns it back on for the meter.
function syncMetering() {
  mic.setMetering(phase.value !== "connected" && previewVisible.value);
}

watch([phase, previewVisible], syncMetering);

const micDotOpacity = computed(
  () => 0.25 + Math.min(1, mic.inputLevel.value * 4) * 0.75,
);

// Publishing a camera is not joining a call. The feed is for the observer HUD
// and for organizers watching -- teammates never hear it -- so a player who
// wants to talk to their team has to join the channel, and this is the last
// screen they are on before a match, which makes it the place to offer it.
//
// The camera's microphone is handed straight to the channel: one capture, one
// gate, one mute for both destinations, rather than a second open of a device
// some hardware only grants once.
const matchId = computed(() => String(route.params.id));
const myLineupId = ref<string | null>(null);
const voiceEnabled = computed(
  () => useApplicationSettingsStore().voiceChatMatchesEnabled,
);

// The token names a feed, not a team, so the lineup has to be looked up -- and
// only a signed-in session can. A phone opened from a QR code usually is not
// one, and voice would refuse it anyway, so this is best effort and the control
// simply does not appear when it comes back empty.
async function resolveMyLineup() {
  if (!useAuthStore().me) {
    return;
  }

  try {
    const { data } = await useNuxtApp().$apollo.defaultClient.query({
      fetchPolicy: "network-only",
      query: generateQuery({
        matches_by_pk: [
          { id: matchId.value },
          {
            id: true,
            lineup_1: { id: true, is_on_lineup: true },
            lineup_2: { id: true, is_on_lineup: true },
          },
        ],
      }),
    });

    const match = (data as any)?.matches_by_pk;

    myLineupId.value =
      [match?.lineup_1, match?.lineup_2].find(
        (lineup: any) => lineup?.is_on_lineup,
      )?.id ?? null;
  } catch {
    // Not signed in on this device, or not on this match. Either way there is
    // no channel to offer.
  }
}

// Constraints are a request to the camera; this is a ceiling on the encoder,
// which is where the CPU actually goes. Without it a machine with headroom
// happily spends it -- on a player who is trying to run a game at the same
// time. Resolution is held in preference to smoothness: the point of the feed
// is seeing the player, not fluid motion.
async function capVideoEncoder(pc: RTCPeerConnection) {
  const sender = pc
    .getSenders()
    .find((candidate) => candidate.track?.kind === "video");

  if (!sender) {
    return;
  }

  try {
    const parameters = sender.getParameters();

    parameters.encodings = parameters.encodings?.length
      ? parameters.encodings
      : [{}];

    for (const encoding of parameters.encodings) {
      encoding.maxBitrate = CAPTURE_BITRATE;
      encoding.maxFramerate = CAPTURE_FPS;
    }

    (
      parameters as RTCRtpSendParameters & { degradationPreference?: string }
    ).degradationPreference = "maintain-resolution";

    await sender.setParameters(parameters);
  } catch {
    // Older engines reject parts of setParameters; the feed is fine without it.
  }
}

async function startCrop() {
  const source = sourceEl.value;
  const canvas = canvasEl.value;

  if (!source || !canvas || !stream) {
    return;
  }

  // Already cropping. Every step of a pinch or a wheel spin lands here, and the
  // draw loop reads the reframe values live -- so restarting it (cancelling the
  // frame callback, re-creating the keep-alive interval) is pure churn on a
  // phone that is already encoding video.
  if (cropStream && frameHandle !== null) {
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
// against the picture rather than the box it sits in. While cropping it is the
// canvas on show, so the ratio comes from there.
function pictureSize(rect: DOMRect) {
  const el = previewEl.value;
  const canvas = canvasEl.value;
  const ratio = cropping.value
    ? canvas && canvas.width && canvas.height
      ? canvas.width / canvas.height
      : 0
    : el && el.videoWidth && el.videoHeight
      ? el.videoWidth / el.videoHeight
      : 0;

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
    const media = await openMedia();

    // Asked for together so the browser prompts once, then split: the camera
    // stays here and the microphone goes to the pipeline that gates, meters and
    // owns it -- the same one a voice channel uses.
    const audioTracks = media.getAudioTracks();

    for (const track of audioTracks) {
      media.removeTrack(track);
    }

    stream = media;
    await mic.start(new MediaStream(audioTracks));
    syncMetering();

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

// A remembered camera or microphone that has since been unplugged fails the
// whole request with OverconstrainedError, which would leave a player staring
// at "no device found" on hardware that works. Forget the picks and retry.
async function openMedia() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: videoConstraints(facingMode),
      audio: audioSettings.micConstraints(),
    });
  } catch (error) {
    const remembered =
      cameraDeviceId.value || audioSettings.micDeviceId.value;

    if (
      (error as DOMException)?.name !== "OverconstrainedError" ||
      !remembered
    ) {
      throw error;
    }

    cameraDeviceId.value = "";
    writeStored(CAMERA_DEVICE_KEY, null);
    audioSettings.setMicDevice("");

    return navigator.mediaDevices.getUserMedia({
      video: videoConstraints(facingMode),
      audio: audioSettings.micConstraints(),
    });
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
    // left it. The microphone comes off the pipeline rather than the camera
    // stream, so what the organizer hears is what the mic check played back:
    // the chosen device, gated and processed the same way voice is.
    const micTrack = mic.track();

    const published = new MediaStream([
      ...(cropStream ?? stream).getVideoTracks(),
      ...(micTrack ? [micTrack] : []),
    ]);

    for (const track of published.getTracks()) {
      pc.addTrack(track, published);
    }

    await negotiateWebRtc(pc, cameraPlayerPublishUrl(token.value));
    await capVideoEncoder(pc);

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
// Closing the page while a poll is in flight used to leave the loop running:
// clearing the timer does nothing to a request that is about to re-arm it, so
// the page kept polling -- and could still open a peer connection -- forever.
let disposed = false;

async function pollTalk() {
  const { ready } = await fetchCameraTalkStatus(token.value);

  if (disposed) {
    return;
  }

  if (ready && !talking.value) {
    await joinTalk();
  } else if (!ready && talking.value) {
    endTalk();
  }

  if (disposed) {
    return;
  }

  talkTimer = setTimeout(pollTalk, 2000);
}

async function joinTalk() {
  if (disposed) {
    return;
  }

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
  void resolveMyLineup();
  navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
  stageEl.value?.addEventListener("wheel", onWheel, { passive: false });
});

function onDeviceChange() {
  void refreshCameras();
}

onBeforeUnmount(() => {
  disposed = true;
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
          v-if="phase === 'connected'"
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
          v-show="previewVisible && !cropping"
          ref="previewEl"
          class="absolute inset-0 h-full w-full object-contain"
          autoplay
          playsinline
          muted
        ></video>

        <!-- The published surface itself, shown in place of the preview while
             cropping. Shrunk rather than hidden when it is not on show: this is
             what captureStream is publishing, and display:none is not a state
             worth betting a player's feed on. -->
        <canvas
          ref="canvasEl"
          aria-hidden="true"
          :class="
            previewVisible && cropping
              ? 'absolute inset-0 h-full w-full object-contain'
              : 'pointer-events-none absolute left-0 top-0 h-px w-px opacity-0'
          "
        ></canvas>

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

      <!-- The organizer hears this feed, so the microphone gets the same setup
           the party hub gives it: device, mic check, sensitivity, output and
           noise suppression. Reachable before going live rather than after
           discovering the wrong mic mid-match. -->
      <div
        v-if="!mediaErrorKind"
        class="flex items-center justify-between gap-3 rounded-xl border bg-card/40 px-3 py-2"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <span
            class="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors"
            :class="
              mic.live.value
                ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
                : 'border-border bg-muted/40 text-muted-foreground'
            "
          >
            <LucideMic class="h-3.5 w-3.5" />
            <span
              v-if="mic.live.value"
              class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 transition-opacity duration-75"
              :style="{ opacity: micDotOpacity }"
            ></span>
          </span>

          <div class="flex min-w-0 flex-col">
            <span class="truncate text-xs font-medium">
              {{ $t("camera.mic") }}
            </span>
            <span class="truncate text-[10px] text-muted-foreground">
              {{ $t("camera.mic_hint") }}
            </span>
          </div>
        </div>

        <VoiceSettingsButton
          :pipeline="mic"
          keep-alive
          class="h-8 w-8 shrink-0"
          @closed="syncMetering"
        />
      </div>

      <!-- Sharing a camera is not joining a call: the feed goes to the observer
           HUD and to organizers, never to teammates. Same microphone, second
           destination -- so the keys sit next to the mic they belong to. -->
      <div
        v-if="myLineupId && !mediaErrorKind && voiceEnabled"
        class="flex items-center justify-between gap-3 rounded-xl border bg-card/40 px-3 py-2"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground"
          >
            <LucideRadioTower class="h-3.5 w-3.5" />
          </span>

          <div class="flex min-w-0 flex-col">
            <span class="truncate text-xs font-medium">
              {{ $t("voice.team_voice") }}
            </span>
            <span class="truncate text-[10px] text-muted-foreground">
              {{ $t("camera.voice_hint") }}
            </span>
          </div>
        </div>

        <MatchVoicePanel
          inline
          hide-settings
          class="shrink-0"
          :pipeline="mic"
          :lineup-id="myLineupId"
          :label="$t('chat.your_team')"
        />
      </div>

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

    <!-- Kept renderable rather than hidden: a display:none video is free to
         stop decoding, and this one is what the crop draws from. -->
    <video
      ref="sourceEl"
      class="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
      aria-hidden="true"
      autoplay
      playsinline
      muted
    ></video>
  </div>
</template>
