import { ref, computed, watch, onScopeDispose } from "vue";
import { negotiateWebRtc, SignalingError } from "~/composables/useCameraApi";
import {
  fetchVoiceParticipants,
  voiceLeaveUrl,
  voicePublishUrl,
  voiceSubscribeUrl,
  type VoiceParticipant,
} from "~/composables/useVoiceApi";

// One party voice session. MediaMTX acts as the SFU: each member publishes
// their own mic to voice-<lobbyId>-<steamId> and pulls every other member's
// path, so nobody needs a direct peer connection to anybody else.

const MIC_DEVICE_KEY = "5stack:voice:mic";
const OUTPUT_DEVICE_KEY = "5stack:voice:output";
const INPUT_MODE_KEY = "5stack:voice:input-mode";
const THRESHOLD_KEY = "5stack:voice:threshold";
const SUPPRESSION_KEY = "5stack:voice:noise-suppression";

export type VoiceInputMode = "voice" | "open";

// How long the gate stays open after the last sample above threshold. Without
// it every pause between words clips the tail of the sentence.
const GATE_HOLD_MS = 320;
// Ramped rather than switched: a hard 0/1 gain change is an audible click.
const GATE_RAMP_S = 0.03;

function storedNumber(key: string, fallback: number) {
  try {
    const raw = Number(localStorage.getItem(key));
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
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

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing — the choice just won't persist.
  }
}

function storedDevice(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
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

export function useVoiceChat(lobbyId: () => string | null | undefined) {
  const connected = ref(false);
  const connecting = ref(false);
  const muted = ref(false);
  // `error` is an i18n key; `errorDetail` is the raw technical line, shown
  // underneath so a failure can actually be diagnosed rather than guessed at.
  const error = ref<string | null>(null);
  const errorDetail = ref<string | null>(null);
  const participants = ref<Array<VoiceParticipant>>([]);

  const inputDevices = ref<Array<MediaDeviceInfo>>([]);
  const outputDevices = ref<Array<MediaDeviceInfo>>([]);
  const micDeviceId = ref(storedDevice(MIC_DEVICE_KEY));
  const outputDeviceId = ref(storedDevice(OUTPUT_DEVICE_KEY));
  // 0..1, driven off the live mic so a player can see their own input working
  // without having to ask someone else whether they can be heard.
  const inputLevel = ref(0);
  const inputMode = ref<VoiceInputMode>(
    (storedDevice(INPUT_MODE_KEY) as VoiceInputMode) || "voice",
  );
  const threshold = ref(storedNumber(THRESHOLD_KEY, 0.08));
  const noiseSuppression = ref(storedFlag(SUPPRESSION_KEY, true));
  // Whether the gate is currently letting audio through, so the UI can show
  // the same thing the other side is hearing.
  const transmitting = ref(false);
  // Loopback so a player can hear themselves. Taken after the gate, so what
  // they hear is exactly what the other side gets -- including being cut off
  // when the sensitivity is set too high.
  const monitoring = ref(false);
  // Mic is open and metering, but nothing is being sent to anyone.
  const previewing = ref(false);

  let publishPc: RTCPeerConnection | null = null;
  let micStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let gateGain: GainNode | null = null;
  let monitorGain: GainNode | null = null;
  let published: MediaStream | null = null;
  let meterFrame: number | null = null;
  let openUntil = 0;
  const subscriptions = new Map<
    string,
    { pc: RTCPeerConnection; audio: HTMLAudioElement }
  >();
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

  function iceServers(): Array<RTCIceServer> {
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }

  // Browsers only expose getUserMedia on a secure origin, so a panel served
  // over plain http silently has no `mediaDevices` at all. Checked up front so
  // that shows up as an explanation rather than a TypeError nobody sees.
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

  // The published track comes off this graph, not straight off the mic, so the
  // gate can open and close without renegotiating anything:
  //
  //   mic -> analyser (level + VAD) -> gain (the gate) -> destination -> peer
  //
  // Muting and voice activity both drive the same gain, so remote peers only
  // ever hear silence rather than a track that disappears and comes back.
  function buildGraph(stream: MediaStream) {
    teardownGraph();

    const context = new AudioContext();
    audioContext = context;

    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    const gain = context.createGain();
    gateGain = gain;
    const destination = context.createMediaStreamDestination();

    context.createMediaStreamSource(stream).connect(analyser);
    analyser.connect(gain);
    gain.connect(destination);

    gain.gain.value = 0;
    published = destination.stream;
    monitorGain = context.createGain();
    monitorGain.gain.value = monitoring.value ? 1 : 0;
    gain.connect(monitorGain);
    monitorGain.connect(context.destination);

    const samples = new Uint8Array(analyser.frequencyBinCount);
    const read = () => {
      analyser.getByteTimeDomainData(samples);

      let peak = 0;
      for (const sample of samples) {
        peak = Math.max(peak, Math.abs(sample - 128));
      }

      const level = Math.min(1, peak / 96);
      inputLevel.value = level;

      const now = performance.now();
      if (level >= threshold.value) {
        openUntil = now + GATE_HOLD_MS;
      }

      const gateOpen = inputMode.value === "open" || now < openUntil;
      const shouldSend = gateOpen && !muted.value;

      if (shouldSend !== transmitting.value) {
        transmitting.value = shouldSend;
        gain.gain.setTargetAtTime(
          shouldSend ? 1 : 0,
          context.currentTime,
          GATE_RAMP_S,
        );
      }

      meterFrame = requestAnimationFrame(read);
    };
    read();

    return destination.stream;
  }

  function teardownGraph() {
    if (meterFrame !== null) {
      cancelAnimationFrame(meterFrame);
      meterFrame = null;
    }

    void audioContext?.close().catch(() => {});
    audioContext = null;
    gateGain = null;
    monitorGain = null;
    monitoring.value = false;
    previewing.value = false;
    published = null;
    inputLevel.value = 0;
    transmitting.value = false;
    openUntil = 0;
  }

  async function openMic() {
    const constraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: noiseSuppression.value,
      autoGainControl: true,
    };

    if (micDeviceId.value) {
      constraints.deviceId = { exact: micDeviceId.value };
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: constraints,
        video: false,
      });
    } catch (caught) {
      // A remembered device that has since been unplugged fails with
      // OverconstrainedError; fall back rather than stranding the player.
      if ((caught as Error)?.name === "OverconstrainedError" && micDeviceId.value) {
        micDeviceId.value = "";
        rememberDevice(MIC_DEVICE_KEY, "");
        return navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: noiseSuppression.value,
            autoGainControl: true,
          },
          video: false,
        });
      }
      throw caught;
    }
  }

  function describeError(caught: unknown) {
    // Keep the raw cause visible in the console; the UI gets the short version.
    console.error("[voice]", caught);

    errorDetail.value = null;

    if (caught instanceof SignalingError) {
      errorDetail.value = caught.message;

      if (caught.kind === "unreachable") {
        return "voice.errors.unreachable";
      }
      if (caught.status === 401 || caught.status === 403) {
        return "voice.errors.forbidden";
      }
      if (caught.status === 404) {
        return "voice.errors.not_deployed";
      }

      return "voice.errors.signaling";
    }

    const name = (caught as Error)?.name;

    if (name === "NotAllowedError" || name === "SecurityError") {
      return "voice.errors.permission_denied";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "voice.errors.no_microphone";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "voice.errors.microphone_busy";
    }

    errorDetail.value = (caught as Error)?.message ?? String(caught);
    return "voice.errors.unknown";
  }

  // Opens the mic and builds the graph without any peer connection, so the
  // meter, the gate and the loopback all work before joining -- a player can
  // get their setup right before anyone else can hear them.
  async function startPreview() {
    if (micStream) {
      return true;
    }

    const blocked = unsupportedReason();
    if (blocked) {
      error.value = blocked;
      return false;
    }

    error.value = null;
    errorDetail.value = null;

    try {
      micStream = await openMic();
      // Labels are only populated once permission exists, so this is the first
      // point a device picker can show real names.
      await refreshDevices();
      buildGraph(micStream);
      previewing.value = true;
      return true;
    } catch (caught) {
      error.value = describeError(caught);
      teardown();
      return false;
    }
  }

  function stopPreview() {
    if (connected.value) {
      return;
    }

    teardown();
  }

  async function join() {
    const id = lobbyId();

    if (!id || connected.value || connecting.value) {
      return;
    }

    connecting.value = true;

    try {
      if (!(await startPreview()) || !micStream || !published) {
        return;
      }

      const outgoing = published;

      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      publishPc = pc;

      for (const track of outgoing.getAudioTracks()) {
        pc.addTrack(track, outgoing);
      }

      await negotiateWebRtc(pc, voicePublishUrl(id), "include");

      connected.value = true;
      previewing.value = false;
      void poll();
    } catch (caught) {
      error.value = describeError(caught);
      teardown();
    } finally {
      connecting.value = false;
    }
  }

  async function leave() {
    const id = lobbyId();

    teardown();

    if (id) {
      // Drops our own publish so the rest of the party stops hearing a dead
      // path; best effort, the session times out on its own regardless.
      await fetch(voiceLeaveUrl(id), {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }
  }

  function teardown() {
    connected.value = false;
    teardownGraph();

    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }

    for (const [steamId] of subscriptions) {
      unsubscribe(steamId);
    }

    publishPc?.close();
    publishPc = null;

    for (const track of micStream?.getTracks() ?? []) {
      track.stop();
    }

    micStream = null;
    participants.value = [];
  }

  // Mute is enforced by the gate in buildGraph, which the render loop applies
  // on its next frame -- the raw track stays live so the meter keeps reading.
  function toggleMute() {
    muted.value = !muted.value;
  }

  // Swaps the live track in place so the session survives a device change --
  // renegotiating would drop everyone's audio for a beat.
  async function setMicDevice(deviceId: string) {
    micDeviceId.value = deviceId;
    rememberDevice(MIC_DEVICE_KEY, deviceId);

    if (!connected.value) {
      return;
    }

    try {
      const replacement = await openMic();
      const outgoing = buildGraph(replacement);
      const [track] = outgoing.getAudioTracks();
      const sender = publishPc
        ?.getSenders()
        .find((candidate) => candidate.track?.kind === "audio");

      await sender?.replaceTrack(track);

      for (const existing of micStream?.getTracks() ?? []) {
        existing.stop();
      }

      micStream = replacement;
    } catch (caught) {
      error.value = describeError(caught);
    }
  }

  function toggleMonitor() {
    monitoring.value = !monitoring.value;

    if (monitorGain && audioContext) {
      monitorGain.gain.setTargetAtTime(
        monitoring.value ? 1 : 0,
        audioContext.currentTime,
        GATE_RAMP_S,
      );
    }
  }

  // Confirms the output picker actually routes somewhere audible, without
  // needing another person on the call.
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

  function setInputMode(mode: VoiceInputMode) {
    inputMode.value = mode;
    remember(INPUT_MODE_KEY, mode);
  }

  function setThreshold(value: number) {
    threshold.value = Math.min(1, Math.max(0, value));
    remember(THRESHOLD_KEY, String(threshold.value));
  }

  // Applied to the live track where the browser supports it, so toggling it
  // does not interrupt the call; only a refusal costs a reopen.
  async function setNoiseSuppression(enabled: boolean) {
    noiseSuppression.value = enabled;
    remember(SUPPRESSION_KEY, String(enabled));

    const [track] = micStream?.getAudioTracks() ?? [];

    if (!track) {
      return;
    }

    try {
      await track.applyConstraints({ noiseSuppression: enabled });
    } catch {
      if (connected.value) {
        await setMicDevice(micDeviceId.value);
      }
    }
  }

  async function setOutputDevice(deviceId: string) {
    outputDeviceId.value = deviceId;
    rememberDevice(OUTPUT_DEVICE_KEY, deviceId);

    for (const { audio } of subscriptions.values()) {
      await applyOutput(audio);
    }
  }

  async function applyOutput(audio: HTMLAudioElement) {
    const sinkId = outputDeviceId.value;
    const element = audio as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };

    if (!sinkId || typeof element.setSinkId !== "function") {
      return;
    }

    // Chromium-only; Firefox and Safari just keep the system default.
    await element.setSinkId(sinkId).catch(() => {});
  }

  async function subscribe(steamId: string) {
    const id = lobbyId();

    if (!id || subscriptions.has(steamId) || steamId === mySteamId.value) {
      return;
    }

    try {
      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      const audio = new Audio();
      audio.autoplay = true;

      // Registered before negotiating so the first track is never missed.
      subscriptions.set(steamId, { pc, audio });

      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void applyOutput(audio);
        void audio.play().catch(() => {});
      };

      await negotiateWebRtc(pc, voiceSubscribeUrl(id, steamId), "include");
    } catch {
      unsubscribe(steamId);
    }
  }

  function unsubscribe(steamId: string) {
    const subscription = subscriptions.get(steamId);

    if (!subscription) {
      return;
    }

    subscription.pc.close();
    subscription.audio.pause();
    subscription.audio.srcObject = null;
    subscriptions.delete(steamId);
  }

  async function poll() {
    const id = lobbyId();

    if (!id || !connected.value) {
      return;
    }

    try {
      participants.value = await fetchVoiceParticipants(id);

      const speaking = new Set(
        participants.value
          .filter((participant) => participant.speaking)
          .map((participant) => participant.steamId),
      );

      for (const steamId of speaking) {
        if (steamId !== mySteamId.value) {
          void subscribe(steamId);
        }
      }

      // Anyone who stopped publishing: drop the peer connection rather than
      // leaving a dead one open for the rest of the session.
      for (const [steamId] of subscriptions) {
        if (!speaking.has(steamId)) {
          unsubscribe(steamId);
        }
      }
    } catch {
      // A failed poll is not a reason to tear the session down.
    }

    pollTimer = setTimeout(poll, 3000);
  }

  // Leaving the party ends the call: the lobby the session belongs to is gone.
  watch(
    () => lobbyId(),
    (next, previous) => {
      if (previous && next !== previous) {
        teardown();
      }
    },
  );

  onScopeDispose(() => {
    teardown();
  });

  return {
    connected,
    connecting,
    muted,
    error,
    errorDetail,
    unsupported,
    participants,
    inputDevices,
    outputDevices,
    micDeviceId,
    outputDeviceId,
    inputLevel,
    inputMode,
    threshold,
    noiseSuppression,
    transmitting,
    monitoring,
    previewing,
    join,
    leave,
    toggleMute,
    refreshDevices,
    setMicDevice,
    setOutputDevice,
    setInputMode,
    setThreshold,
    setNoiseSuppression,
    toggleMonitor,
    playTestTone,
    startPreview,
    stopPreview,
  };
}
