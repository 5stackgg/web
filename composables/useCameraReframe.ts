import { ref, reactive, computed, onScopeDispose, type Ref } from "vue";
import { CAPTURE_FPS } from "~/composables/useCameraPipeline";

// Zoom and pan for a camera feed, and the canvas that actually applies it.
//
// Cropping is not a constraint on the camera: the canvas keeps the sensor's own
// dimensions and the crop is scaled up into it, so a player reframing mid-match
// never renegotiates the published resolution. While cropping, the canvas'
// captured stream is what gets published in place of the raw track -- which is
// why this owns an output track of its own rather than just some numbers.

const REFRAME_KEY = "5stack:camera:reframe";
const MAX_ZOOM = 3;

export type Reframe = { zoom: number; x: number; y: number };

type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export type CameraReframeOptions = {
  sourceEl: Ref<HTMLVideoElement | null>;
  canvasEl: Ref<HTMLCanvasElement | null>;
  // The raw camera stream being reframed.
  stream: () => MediaStream | null;
  // Reframes are remembered per camera, so a player who set up a laptop webcam
  // does not inherit that framing when they plug in a different one.
  deviceId: () => string;
  // The surface to publish: the canvas track while cropping, the raw track once
  // the crop is dropped. The consumer swaps its sender rather than renegotiate.
  onOutputTrack?: (track: MediaStreamTrack | null) => void;
  // Called after the published surface changes, so a preview showing either the
  // raw stream or the canvas can re-point itself.
  onSurfaceChange?: () => void;
};

export function useCameraReframe(options: CameraReframeOptions) {
  const { sourceEl, canvasEl } = options;

  const reframe = reactive<Reframe>({ zoom: 1, x: 0.5, y: 0.5 });
  const dragging = ref(false);

  const cropping = computed(() => reframe.zoom > 1.001);
  const zoomPercent = computed(() => Math.round(reframe.zoom * 100));

  let cropStream: MediaStream | null = null;

  function readStored(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStored(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Private browsing — the framing just won't persist.
    }
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function toNumber(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function reframeKey() {
    const [track] = options.stream()?.getVideoTracks() ?? [];
    return track?.getSettings().deviceId || options.deviceId() || "default";
  }

  function storedReframes(): Record<string, Partial<Reframe>> {
    const raw = readStored(REFRAME_KEY);

    if (!raw) {
      return {};
    }

    try {
      return (JSON.parse(raw) as Record<string, Partial<Reframe>>) ?? {};
    } catch {
      return {};
    }
  }

  function clampCentre() {
    const half = 0.5 / Math.max(1, reframe.zoom);
    reframe.x = clamp(reframe.x, half, 1 - half);
    reframe.y = clamp(reframe.y, half, 1 - half);
  }

  function load() {
    const saved = storedReframes()[reframeKey()];

    reframe.zoom = clamp(toNumber(saved?.zoom, 1), 1, MAX_ZOOM);
    reframe.x = clamp(toNumber(saved?.x, 0.5), 0, 1);
    reframe.y = clamp(toNumber(saved?.y, 0.5), 0, 1);
    clampCentre();
  }

  function persist() {
    const all = storedReframes();
    all[reframeKey()] = { zoom: reframe.zoom, x: reframe.x, y: reframe.y };
    writeStored(REFRAME_KEY, JSON.stringify(all));
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

  let frameHandle: number | null = null;
  let frameHandleIsVideo = false;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  let lastDrawAt = 0;

  // Frame callbacks fire at the camera's rate, which can be well above what is
  // published; drawing more often than captureStream will sample is work thrown
  // straight away.
  const MIN_DRAW_INTERVAL_MS = 1000 / CAPTURE_FPS - 2;

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
    const top = clamp(
      reframe.y * height - cropHeight / 2,
      0,
      height - cropHeight,
    );

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

  async function startCrop() {
    const source = sourceEl.value;
    const canvas = canvasEl.value;
    const stream = options.stream();

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
      options.onOutputTrack?.(track ?? null);
    }

    options.onSurfaceChange?.();
    startCropLoop();
  }

  async function stopCrop() {
    stopCropLoop();

    if (cropStream) {
      const [rawTrack] = options.stream()?.getVideoTracks() ?? [];
      options.onOutputTrack?.(rawTrack ?? null);

      for (const track of cropStream.getTracks()) {
        track.stop();
      }

      cropStream = null;
    }

    if (sourceEl.value) {
      sourceEl.value.srcObject = null;
    }

    options.onSurfaceChange?.();
  }

  // Serialised: the zoom slider fires far faster than a track swap completes, and
  // two overlapping starts would publish one canvas and leak the other.
  let chain: Promise<void> = Promise.resolve();

  function apply(persistNow = true) {
    clampCentre();

    if (persistNow) {
      persist();
    }

    if (!options.stream()) {
      return chain;
    }

    chain = chain
      .then(() => (cropping.value ? startCrop() : stopCrop()))
      .catch(() => {});

    return chain;
  }

  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  function schedulePersist() {
    if (persistTimer) {
      clearTimeout(persistTimer);
    }

    persistTimer = setTimeout(() => {
      persistTimer = null;
      persist();
    }, 500);
  }

  function setZoom(next: number) {
    const clamped = clamp(next, 1, MAX_ZOOM);

    if (clamped === reframe.zoom) {
      return;
    }

    reframe.zoom = clamped;
    void apply(false);
    schedulePersist();
  }

  function reset() {
    reframe.zoom = 1;
    reframe.x = 0.5;
    reframe.y = 0.5;
    void apply();
  }

  onScopeDispose(() => {
    if (persistTimer) {
      clearTimeout(persistTimer);
    }

    stopCropLoop();

    for (const track of cropStream?.getTracks() ?? []) {
      track.stop();
    }

    cropStream = null;
  });

  return {
    reframe,
    dragging,
    cropping,
    zoomPercent,
    maxZoom: MAX_ZOOM,
    load,
    persist,
    apply,
    clampCentre,
    setZoom,
    reset,
    croppedTrack: () => cropStream?.getVideoTracks()[0] ?? null,
  };
}

export type CameraReframe = ReturnType<typeof useCameraReframe>;
