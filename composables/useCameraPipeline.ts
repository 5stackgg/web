import { ref, shallowRef, computed, onScopeDispose } from "vue";

// One camera, opened and kept open, ready to be published by whatever wants it
// -- the match camera feed or a lobby video call. Everything from the device
// list to the outgoing track lives here so both go through the same graph, the
// same way useMicPipeline owns the microphone for voice and the camera page
// alike. The contract is deliberately the same shape: start/stop/track/stream
// plus onTrack, so a consumer drives a camera exactly as it drives a mic.

const CAMERA_DEVICE_KEY = "5stack:camera:device";

// This runs on the player's own machine for the length of a match, next to the
// game. A monitoring camera is watched in a tile a few hundred pixels wide, so
// capturing and encoding anything near a modern sensor's native resolution is
// frames per second spent on detail nobody looks at. Everything below is an
// `ideal`: a camera that cannot do it keeps working at whatever it can.
export const CAPTURE_FPS = 24;
// Enough for a face and a pair of hands in a grid tile, and roughly a third of
// the encode cost of the 720p the browser hands out by default.
export const CAPTURE_BITRATE = 350_000;

export type CameraErrorKind =
  | "denied"
  | "missing"
  | "busy"
  | "insecure"
  | "unknown";

export type CameraStartOptions = {
  // Asked for together with the camera so the browser prompts once. The audio
  // half is handed straight back rather than kept here: it belongs to
  // useMicPipeline, which gates, meters and owns it -- the same one a voice
  // channel uses.
  audio?: MediaTrackConstraints | boolean;
  // Handed the audio half inside the same try as the camera, so a graph that
  // fails to build reports as a media error rather than escaping as an
  // unhandled rejection from whatever called start().
  onAudio?: (stream: MediaStream) => Promise<void> | void;
  forgetAudioDevice?: () => void;
  rememberedAudioDevice?: () => string;
};

export type CameraPipelineOptions = {
  // Called whenever the outgoing track is replaced -- a device change or a flip
  // swaps the raw track, and the consumer has to decide what to do with it. The
  // camera page is deliberately not told to republish: while it is cropping,
  // the canvas is the published surface and the raw track is only its source.
  onTrack?: (track: MediaStreamTrack | null) => void;
};

export function useCameraPipeline(options: CameraPipelineOptions = {}) {
  const trackListeners = new Set<(track: MediaStreamTrack | null) => void>();

  if (options.onTrack) {
    trackListeners.add(options.onTrack);
  }

  function emitTrack(track: MediaStreamTrack | null) {
    for (const listener of trackListeners) {
      listener(track);
    }
  }

  // Returns the unsubscribe, so a borrower that goes away does not keep
  // replacing tracks on a peer connection it already closed.
  function onTrack(listener: (track: MediaStreamTrack | null) => void) {
    trackListeners.add(listener);

    return () => {
      trackListeners.delete(listener);
    };
  }

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

  const devices = ref<Array<MediaDeviceInfo>>([]);
  const deviceId = ref(readStored(CAMERA_DEVICE_KEY) ?? "");
  const canFlip = ref(false);
  // The camera is open. Whether anyone is receiving it is the consumer's
  // business.
  const live = ref(false);
  const pending = ref(false);
  const errorKind = ref<CameraErrorKind | null>(null);

  // A ref, not a plain binding: a consumer rendering the local preview has to
  // re-read it when a device switch swaps the whole stream out, and nothing
  // else about that swap is reactive.
  const active = shallowRef<MediaStream | null>(null);
  let facingMode: "user" | "environment" = "user";

  // Browsers repeat the active camera as a synthetic "default" entry, so the raw
  // count says "two cameras" on a laptop that only has one.
  const realDevices = computed(() =>
    devices.value.filter((device) => device.deviceId !== "default"),
  );

  const coarsePointer = ref(
    typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches,
  );

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

    if (deviceId.value) {
      // An explicit device wins over facingMode -- asking for both lets the
      // browser satisfy the wrong one.
      return { ...preferred, deviceId: { exact: deviceId.value } };
    }

    return { ...preferred, facingMode: { ideal: mode } };
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

    const [track] = active.value?.getVideoTracks() ?? [];
    const facings = track?.getCapabilities?.().facingMode ?? [];

    if (facings.length > 1) {
      canFlip.value = true;
      return;
    }

    const exposesFacing =
      facings.length > 0 || !!track?.getSettings().facingMode;
    canFlip.value = exposesFacing && realDevices.value.length > 1;
  }

  async function refreshDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const found = await navigator.mediaDevices.enumerateDevices();
      devices.value = found.filter((device) => device.kind === "videoinput");
    } catch {
      // Labels only exist once permission has been granted; not fatal.
    }

    detectFlip();
  }

  // Browsers only expose getUserMedia on a secure origin, so a panel served over
  // plain http has no `mediaDevices` at all. Worth naming rather than letting it
  // reach getUserMedia: the TypeError that comes back from calling a method on
  // undefined carries no DOMException name, so it reads as "unknown" -- which is
  // the one phrasing that does not tell a player on a http:// dev host, or
  // behind an ingress that lost its TLS, what is actually wrong.
  function describeUnsupported(): CameraErrorKind | null {
    if (typeof navigator === "undefined") {
      return null;
    }

    if (navigator.mediaDevices?.getUserMedia) {
      return null;
    }

    return typeof window !== "undefined" && !window.isSecureContext
      ? "insecure"
      : "unknown";
  }

  function describeMediaError(error: unknown): CameraErrorKind {
    const name = (error as DOMException)?.name;

    if (name === "NotAllowedError" || name === "SecurityError") {
      return "denied";
    }

    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return "missing";
    }

    if (name === "NotReadableError" || name === "AbortError") {
      return "busy";
    }

    return "unknown";
  }

  // A remembered camera or microphone that has since been unplugged fails the
  // whole request with OverconstrainedError, which would leave a player staring
  // at "no device found" on hardware that works. Forget the picks and retry.
  async function openMedia(
    audio: MediaTrackConstraints | boolean,
    forgetAudioDevice?: () => void,
    rememberedAudioDevice?: () => string,
  ) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: videoConstraints(facingMode),
        audio,
      });
    } catch (error) {
      const remembered = deviceId.value || rememberedAudioDevice?.();

      if (
        (error as DOMException)?.name !== "OverconstrainedError" ||
        !remembered
      ) {
        throw error;
      }

      deviceId.value = "";
      writeStored(CAMERA_DEVICE_KEY, null);
      forgetAudioDevice?.();

      return navigator.mediaDevices.getUserMedia({
        video: videoConstraints(facingMode),
        audio,
      });
    }
  }

  // Local only -- nothing is published until a consumer takes the track.
  async function start(startOptions: CameraStartOptions = {}) {
    errorKind.value = null;

    const unsupported = describeUnsupported();

    if (unsupported) {
      errorKind.value = unsupported;
      return false;
    }

    pending.value = true;

    try {
      const media = await openMedia(
        startOptions.audio ?? false,
        startOptions.forgetAudioDevice,
        startOptions.rememberedAudioDevice,
      );

      const audioTracks = media.getAudioTracks();

      for (const track of audioTracks) {
        media.removeTrack(track);
      }

      active.value = media;
      live.value = true;

      if (audioTracks.length) {
        await startOptions.onAudio?.(new MediaStream(audioTracks));
      }

      // Resolved before the controls render, so the device picker and flip
      // button are never a second frame that shifts the page.
      await refreshDevices();

      return true;
    } catch (error) {
      errorKind.value = describeMediaError(error);
      return false;
    } finally {
      pending.value = false;
    }
  }

  // Swaps the live track in place so a publish survives a camera change --
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

    const previous = active.value?.getVideoTracks() ?? [];
    const next = new MediaStream([
      videoTrack,
      ...(active.value?.getAudioTracks() ?? []),
    ]);

    for (const track of previous) {
      track.stop();
    }

    active.value = next;
    emitTrack(videoTrack);

    return true;
  }

  async function setDevice(id: string) {
    deviceId.value = id;
    writeStored(CAMERA_DEVICE_KEY, id || null);

    if (!active.value) {
      return false;
    }

    try {
      if (await useVideoTrack(facingMode)) {
        detectFlip();
        return true;
      }
    } catch {
      // Keep the existing stream if the chosen camera is unavailable.
    }

    return false;
  }

  async function flip() {
    const next = facingMode === "user" ? "environment" : "user";
    const previousPick = deviceId.value;
    // Clear any explicit pick, or videoConstraints ignores the flip entirely.
    deviceId.value = "";

    try {
      if (await useVideoTrack(next)) {
        facingMode = next;
        writeStored(CAMERA_DEVICE_KEY, null);
        detectFlip();
        return true;
      }

      deviceId.value = previousPick;
    } catch {
      // Keep the existing stream if the other camera is unavailable.
      deviceId.value = previousPick;
    }

    return false;
  }

  function stop() {
    for (const track of active.value?.getTracks() ?? []) {
      track.stop();
    }

    active.value = null;
    live.value = false;
    emitTrack(null);
  }

  function onDeviceChange() {
    void refreshDevices();
  }

  if (typeof navigator !== "undefined") {
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
  }

  onScopeDispose(() => {
    if (typeof navigator !== "undefined") {
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        onDeviceChange,
      );
    }

    stop();
  });

  return {
    devices,
    realDevices,
    deviceId,
    canFlip,
    coarsePointer,
    live,
    pending,
    errorKind,
    start,
    stop,
    setDevice,
    flip,
    refreshDevices,
    onTrack,
    activeStream: active,
    track: () => active.value?.getVideoTracks()[0] ?? null,
    stream: () => active.value,
  };
}

export type CameraPipeline = ReturnType<typeof useCameraPipeline>;
