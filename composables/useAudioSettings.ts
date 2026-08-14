import { computed, ref } from "vue";

// One microphone, one set of settings, for the whole app.
//
// Voice channels and a camera feed are different transports, but they are the
// same person speaking into the same hardware, so the device pickers, the
// sensitivity and the processing live here at module scope rather than being
// rebuilt per surface. Anything that opens a microphone reads these; the
// settings dialog writes them from wherever it happens to be opened.

const MIC_DEVICE_KEY = "5stack:voice:mic";
const OUTPUT_DEVICE_KEY = "5stack:voice:output";
const INPUT_MODE_KEY = "5stack:voice:input-mode";
const THRESHOLD_KEY = "5stack:voice:threshold";
const SUPPRESSION_KEY = "5stack:voice:noise-suppression";

export type VoiceInputMode = "voice" | "open";

// What a device that has never been set up sounds like. Kept here rather than
// inline in the refs so the settings page can put a player back to them.
export const AUDIO_DEFAULTS = {
  micDeviceId: "",
  outputDeviceId: "",
  inputMode: "voice" as VoiceInputMode,
  threshold: 0.08,
  noiseSuppression: true,
};

function storedNumber(key: string, fallback: number) {
  try {
    const raw = localStorage.getItem(key);

    if (raw === null || raw === "") {
      return fallback;
    }

    // 0 is a real setting -- the sensitivity slider's own minimum, an open gate
    // with no floor -- so it has to survive the round trip. Reading a missing
    // key as 0 is what made `> 0` look like a sound guard here.
    const value = Number(raw);

    return Number.isFinite(value) && value >= 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

function storedFlag(key: string, fallback: boolean) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  } catch {
    return fallback;
  }
}

function storedText(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing — the choice just won't persist.
  }
}

function rememberDevice(key: string, value: string) {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Private browsing — the choice just won't persist.
  }
}

const inputDevices = ref<Array<MediaDeviceInfo>>([]);
const outputDevices = ref<Array<MediaDeviceInfo>>([]);
const micDeviceId = ref(storedText(MIC_DEVICE_KEY));
const outputDeviceId = ref(storedText(OUTPUT_DEVICE_KEY));
const inputMode = ref<VoiceInputMode>(
  (storedText(INPUT_MODE_KEY) as VoiceInputMode) || AUDIO_DEFAULTS.inputMode,
);
const threshold = ref(storedNumber(THRESHOLD_KEY, AUDIO_DEFAULTS.threshold));
const noiseSuppression = ref(
  storedFlag(SUPPRESSION_KEY, AUDIO_DEFAULTS.noiseSuppression),
);

// Browsers only expose getUserMedia on a secure origin, so a panel served over
// plain http silently has no `mediaDevices` at all. Checked up front so that
// shows up as an explanation rather than a TypeError nobody sees.
function unsupportedReason(): string | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return typeof window !== "undefined" && !window.isSecureContext
      ? "voice.errors.insecure_origin"
      : "voice.errors.unsupported";
  }

  return null;
}

const unsupported = computed(() => unsupportedReason());

// Every surface that opens a microphone fails the same handful of ways, and a
// player who is told "could not start voice chat" learns nothing. The detail is
// only carried for the cases we cannot name.
export function describeMicError(caught: unknown): {
  key: string;
  detail: string | null;
} {
  const name = (caught as Error)?.name;

  if (name === "NotAllowedError" || name === "SecurityError") {
    return { key: "voice.errors.permission_denied", detail: null };
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return { key: "voice.errors.no_microphone", detail: null };
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return { key: "voice.errors.microphone_busy", detail: null };
  }

  return {
    key: "voice.errors.unknown",
    detail: (caught as Error)?.message ?? String(caught),
  };
}

async function refreshDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    inputDevices.value = devices.filter((d) => d.kind === "audioinput");
    outputDevices.value = devices.filter((d) => d.kind === "audiooutput");
  } catch {
    // Labels stay empty until a permission has been granted; not fatal.
  }
}

// The constraints every microphone in the app is opened with. Kept here so a
// camera feed and a voice channel cannot drift into processing the same mic
// two different ways.
function micConstraints(): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: noiseSuppression.value,
    autoGainControl: true,
  };

  if (micDeviceId.value) {
    constraints.deviceId = { exact: micDeviceId.value };
  }

  return constraints;
}

// A remembered device that has since been unplugged fails with
// OverconstrainedError; fall back rather than stranding the player.
async function openMic(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: micConstraints(),
      video: false,
    });
  } catch (caught) {
    if (
      (caught as Error)?.name !== "OverconstrainedError" ||
      !micDeviceId.value
    ) {
      throw caught;
    }

    setMicDevice("");

    return navigator.mediaDevices.getUserMedia({
      audio: micConstraints(),
      video: false,
    });
  }
}

// The setters only record the choice. Applying it is the job of whichever
// pipeline currently holds the microphone, which watches these refs -- that is
// what lets the dialog be opened from a surface that is not the live one.
function setMicDevice(deviceId: string) {
  if (deviceId === micDeviceId.value) {
    return;
  }

  micDeviceId.value = deviceId;
  rememberDevice(MIC_DEVICE_KEY, deviceId);
}

function setOutputDevice(deviceId: string) {
  if (deviceId === outputDeviceId.value) {
    return;
  }

  outputDeviceId.value = deviceId;
  rememberDevice(OUTPUT_DEVICE_KEY, deviceId);
}

function setInputMode(mode: VoiceInputMode) {
  inputMode.value = mode;
  remember(INPUT_MODE_KEY, mode);
}

function setThreshold(value: number) {
  threshold.value = Math.min(1, Math.max(0, value));
  remember(THRESHOLD_KEY, String(threshold.value));
}

function setNoiseSuppression(enabled: boolean) {
  noiseSuppression.value = enabled;
  remember(SUPPRESSION_KEY, String(enabled));
}

function resetToDefaults() {
  setMicDevice(AUDIO_DEFAULTS.micDeviceId);
  setOutputDevice(AUDIO_DEFAULTS.outputDeviceId);
  setInputMode(AUDIO_DEFAULTS.inputMode);
  setThreshold(AUDIO_DEFAULTS.threshold);
  setNoiseSuppression(AUDIO_DEFAULTS.noiseSuppression);
}

const isDefault = computed(
  () =>
    micDeviceId.value === AUDIO_DEFAULTS.micDeviceId &&
    outputDeviceId.value === AUDIO_DEFAULTS.outputDeviceId &&
    inputMode.value === AUDIO_DEFAULTS.inputMode &&
    threshold.value === AUDIO_DEFAULTS.threshold &&
    noiseSuppression.value === AUDIO_DEFAULTS.noiseSuppression,
);

// Chromium-only; Firefox and Safari just keep the system default.
async function applyOutput(element: HTMLMediaElement) {
  const sinkId = outputDeviceId.value;
  const target = element as HTMLMediaElement & {
    setSinkId?: (id: string) => Promise<void>;
  };

  if (!sinkId || typeof target.setSinkId !== "function") {
    return;
  }

  await target.setSinkId(sinkId).catch(() => {});
}

// Confirms the output picker actually routes somewhere audible, without needing
// another person on the call.
async function playTestTone() {
  const context = new AudioContext();

  try {
    const destination = context.createMediaStreamDestination();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 440;
    // Short fade either side: a square-on/off sine is an unpleasant click.
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.setValueAtTime(0.12, context.currentTime + 0.35);
    gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.4);

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.4);

    const audio = new Audio();
    audio.srcObject = destination.stream;
    await applyOutput(audio);
    await audio.play().catch(() => {});

    await new Promise((resolve) => setTimeout(resolve, 500));
    audio.pause();
    audio.srcObject = null;
  } finally {
    void context.close().catch(() => {});
  }
}

export function useAudioSettings() {
  return {
    inputDevices,
    outputDevices,
    micDeviceId,
    outputDeviceId,
    inputMode,
    threshold,
    noiseSuppression,
    unsupported,
    isDefault,
    refreshDevices,
    micConstraints,
    openMic,
    setMicDevice,
    setOutputDevice,
    setInputMode,
    setThreshold,
    setNoiseSuppression,
    resetToDefaults,
    applyOutput,
    playTestTone,
  };
}
