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

  let publishPc: RTCPeerConnection | null = null;
  let micStream: MediaStream | null = null;
  let meterContext: AudioContext | null = null;
  let meterFrame: number | null = null;
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

  function startMeter(stream: MediaStream) {
    stopMeter();

    try {
      const context = new AudioContext();
      meterContext = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);

      const samples = new Uint8Array(analyser.frequencyBinCount);
      const read = () => {
        analyser.getByteTimeDomainData(samples);
        let peak = 0;
        for (const sample of samples) {
          peak = Math.max(peak, Math.abs(sample - 128));
        }
        inputLevel.value = muted.value ? 0 : Math.min(1, peak / 96);
        meterFrame = requestAnimationFrame(read);
      };
      read();
    } catch {
      // Meter is a nicety; a failure here must not block the call.
    }
  }

  function stopMeter() {
    if (meterFrame !== null) {
      cancelAnimationFrame(meterFrame);
      meterFrame = null;
    }

    void meterContext?.close().catch(() => {});
    meterContext = null;
    inputLevel.value = 0;
  }

  async function openMic() {
    const constraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
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
            noiseSuppression: true,
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

  async function join() {
    const id = lobbyId();

    if (!id || connected.value || connecting.value) {
      return;
    }

    const blocked = unsupportedReason();
    if (blocked) {
      error.value = blocked;
      return;
    }

    connecting.value = true;
    error.value = null;
    errorDetail.value = null;

    try {
      micStream = await openMic();
      // Labels are only populated once permission exists, so this is the first
      // point a device picker can show real names.
      await refreshDevices();

      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      publishPc = pc;

      for (const track of micStream.getAudioTracks()) {
        pc.addTrack(track, micStream);
      }

      await negotiateWebRtc(pc, voicePublishUrl(id), "include");

      connected.value = true;
      applyMute();
      startMeter(micStream);
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
    stopMeter();

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

  function applyMute() {
    for (const track of micStream?.getAudioTracks() ?? []) {
      // Keeps the path published while muted: dropping the track would look
      // like a disconnect to everyone else and churn the whole session.
      track.enabled = !muted.value;
    }
  }

  function toggleMute() {
    muted.value = !muted.value;
    applyMute();
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
      const [track] = replacement.getAudioTracks();
      const sender = publishPc
        ?.getSenders()
        .find((candidate) => candidate.track?.kind === "audio");

      await sender?.replaceTrack(track);

      for (const existing of micStream?.getTracks() ?? []) {
        existing.stop();
      }

      micStream = replacement;
      applyMute();
      startMeter(replacement);
    } catch (caught) {
      error.value = describeError(caught);
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
    join,
    leave,
    toggleMute,
    refreshDevices,
    setMicDevice,
    setOutputDevice,
  };
}
