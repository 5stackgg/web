import { ref, computed, watch, onScopeDispose } from "vue";
import { negotiateWebRtc, SignalingError } from "~/composables/useCameraApi";
import {
  fetchVoiceParticipants,
  voiceLeaveUrl,
  voicePublishUrl,
  voiceSubscribeUrl,
  type VoiceParticipant,
} from "~/composables/useVoiceApi";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";

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
// The gate and the meter live here, on the audio thread. See the file itself
// for why: a main thread loop cost a callback per display refresh and froze
// solid the moment the player alt-tabbed into the game.
const GATE_WORKLET_URL = "/voice-gate.worklet.js";

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

// Which microphone, which speakers, how sensitive the gate is: these describe
// the player's hardware, not the channel they happen to be in. They live at
// module scope so the settings dialog reads and writes the same values from
// every surface -- otherwise changing a device from a match panel would edit a
// second, private copy while the live party session carried on with the first.
const inputDevices = ref<Array<MediaDeviceInfo>>([]);
const outputDevices = ref<Array<MediaDeviceInfo>>([]);
const micDeviceId = ref(storedDevice(MIC_DEVICE_KEY));
const outputDeviceId = ref(storedDevice(OUTPUT_DEVICE_KEY));
const inputMode = ref<VoiceInputMode>(
  (storedDevice(INPUT_MODE_KEY) as VoiceInputMode) || "voice",
);
const threshold = ref(storedNumber(THRESHOLD_KEY, 0.08));
const noiseSuppression = ref(storedFlag(SUPPRESSION_KEY, true));

export function useVoiceChat(
  lobbyId: () => string | null | undefined,
  channelLabel?: () => string,
) {
  const registry = useActiveVoiceChannel();

  const connected = ref(false);
  const connecting = ref(false);
  const muted = ref(false);
  // `error` is an i18n key; `errorDetail` is the raw technical line, shown
  // underneath so a failure can actually be diagnosed rather than guessed at.
  const error = ref<string | null>(null);
  const errorDetail = ref<string | null>(null);
  const participants = ref<Array<VoiceParticipant>>([]);

  // 0..1, driven off the live mic so a player can see their own input working
  // without having to ask someone else whether they can be heard.
  const inputLevel = ref(0);
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
  let gateNode: AudioWorkletNode | null = null;
  let gateGain: GainNode | null = null;
  let monitorGain: GainNode | null = null;
  let published: MediaStream | null = null;
  let meterFrame: number | null = null;
  let openUntil = 0;
  // A level bar is the only thing that wants a continuous read of the mic, so
  // nothing is metered until something is on screen to show it.
  let metering = false;
  const subscriptions = new Map<
    string,
    { pc: RTCPeerConnection; audio: HTMLAudioElement }
  >();
  // Peers are kept for a beat after they stop publishing: one failed poll of
  // MediaMTX reports the whole party as gone, and tearing every peer connection
  // down and renegotiating it a poll later is both audible and expensive.
  const lastPublishing = new Map<string, number>();
  const SUBSCRIPTION_GRACE_MS = 15_000;
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
  //   mic -> gate worklet (level + VAD + ramped gain) -> destination -> peer
  //
  // Muting and voice activity both drive the same gain, so remote peers only
  // ever hear silence rather than a track that disappears and comes back.
  async function buildGraph(stream: MediaStream) {
    teardownGraph();

    const context = new AudioContext();
    audioContext = context;

    const source = context.createMediaStreamSource(stream);
    const destination = context.createMediaStreamDestination();

    monitorGain = context.createGain();
    monitorGain.gain.value = monitoring.value ? 1 : 0;
    monitorGain.connect(context.destination);

    const worklet = await buildGateNode(context);

    if (audioContext !== context) {
      // Torn down while the worklet module loaded; the context is already
      // closed and building the fallback on it would throw.
      return destination.stream;
    }

    const gate = worklet ?? buildFallbackGate(context);

    source.connect(gate.input);
    gate.output.connect(destination);
    // Loopback is taken after the gate, so what a player hears when they
    // monitor is exactly what the other side gets -- including being cut off
    // when they set the sensitivity too high.
    gate.output.connect(monitorGain);

    published = destination.stream;

    return destination.stream;
  }

  // Returns null when the browser has no AudioWorklet, or the module fails to
  // load -- both fall back to the main thread graph below.
  async function buildGateNode(context: AudioContext) {
    if (!context.audioWorklet) {
      return null;
    }

    try {
      await context.audioWorklet.addModule(GATE_WORKLET_URL);
    } catch (caught) {
      console.warn("[voice] gate worklet unavailable", caught);
      return null;
    }

    if (audioContext !== context) {
      // Torn down while the module was loading.
      return null;
    }

    const node = new AudioWorkletNode(context, "voice-gate", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: {
        threshold: threshold.value,
        mode: inputMode.value,
        muted: muted.value,
        meter: metering,
      },
    });

    node.port.onmessage = (event) => {
      const data = event.data as { level?: number; transmitting?: boolean };

      if (typeof data.transmitting === "boolean") {
        transmitting.value = data.transmitting;
      }

      if (metering && typeof data.level === "number") {
        inputLevel.value = data.level;
      }
    };

    gateNode = node;

    return { input: node as AudioNode, output: node as AudioNode };
  }

  // Legacy path for engines without AudioWorklet: an analyser read on an
  // animation frame. Deliberately fails open while the tab is hidden -- frame
  // callbacks stop there, and a frozen gate means a player who alt-tabbed into
  // the game is silently cut off for the rest of the match.
  function buildFallbackGate(context: AudioContext) {
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    const gain = context.createGain();
    gain.gain.value = 0;
    gateGain = gain;
    analyser.connect(gain);

    const samples = new Uint8Array(analyser.frequencyBinCount);

    const setGate = (open: boolean) => {
      if (open === transmitting.value) {
        return;
      }

      transmitting.value = open;
      gain.gain.setTargetAtTime(open ? 1 : 0, context.currentTime, GATE_RAMP_S);
    };

    const read = () => {
      if (typeof document !== "undefined" && document.hidden) {
        meterFrame = null;
        setGate(!muted.value);
        return;
      }

      analyser.getByteTimeDomainData(samples);

      let peak = 0;
      for (let i = 0; i < samples.length; i++) {
        const sample = Math.abs(samples[i] - 128);
        if (sample > peak) {
          peak = sample;
        }
      }

      const level = Math.min(1, peak / 96);

      if (metering) {
        inputLevel.value = level;
      }

      const now = performance.now();
      if (level >= threshold.value) {
        openUntil = now + GATE_HOLD_MS;
      }

      setGate((inputMode.value === "open" || now < openUntil) && !muted.value);

      meterFrame = requestAnimationFrame(read);
    };

    fallbackVisibility = () => {
      if (!document.hidden && meterFrame === null && audioContext === context) {
        read();
      }
    };

    document.addEventListener("visibilitychange", fallbackVisibility);
    read();

    // The mic feeds the analyser; everything downstream comes off the gain, or
    // the gate would pass audio through ungated.
    return { input: analyser as AudioNode, output: gain as AudioNode };
  }

  let fallbackVisibility: (() => void) | null = null;

  function teardownGraph() {
    if (meterFrame !== null) {
      cancelAnimationFrame(meterFrame);
      meterFrame = null;
    }

    if (fallbackVisibility) {
      document.removeEventListener("visibilitychange", fallbackVisibility);
      fallbackVisibility = null;
    }

    if (gateNode) {
      gateNode.port.onmessage = null;
      gateNode.disconnect();
      gateNode = null;
    }

    void audioContext?.close().catch(() => {});
    audioContext = null;
    gateGain = null;
    monitorGain = null;
    published = null;
    inputLevel.value = 0;
    transmitting.value = false;
    openUntil = 0;
    // `monitoring` and `previewing` describe the session, not the graph: this
    // also runs when the graph is rebuilt for a new microphone, and a device
    // change is not the player closing their mic check.
  }

  // Nothing to meter until a level bar is on screen. Kept out of `previewing`
  // on purpose: the settings dialog can be opened mid-call, when the mic is
  // already live and there is no preview to start.
  function setMetering(enabled: boolean) {
    metering = enabled;

    if (!enabled) {
      inputLevel.value = 0;
    }

    gateNode?.port.postMessage({ meter: enabled });
  }

  // The worklet holds its own copy of the gate settings, so pushing changes is
  // what keeps the two in step. The fallback reads the refs directly.
  watch([threshold, inputMode, muted], ([nextThreshold, nextMode, nextMuted]) => {
    if (gateNode) {
      gateNode.port.postMessage({
        threshold: nextThreshold,
        mode: nextMode,
        muted: nextMuted,
      });
      return;
    }

    // The fallback reads these on an animation frame, which does not run while
    // the tab is hidden -- exactly when someone alt-tabbed into the game reaches
    // for mute. Applied straight to the gain there so it still takes effect.
    if (!gateGain || !audioContext || !document.hidden) {
      return;
    }

    transmitting.value = !nextMuted;
    gateGain.gain.setTargetAtTime(
      nextMuted ? 0 : 1,
      audioContext.currentTime,
      GATE_RAMP_S,
    );
  });

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
      await buildGraph(micStream);
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
      registry.register(id, leave);
      registry.claim({ id, label: channelLabel?.() ?? id });
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
      registry.unregister(id);

      // Drops our own publish so the rest of the party stops hearing a dead
      // path; best effort, the session times out on its own regardless.
      await fetch(voiceLeaveUrl(id), {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }
  }

  function teardown() {
    const id = lobbyId();

    if (id) {
      registry.release(id);
    }

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
    lastPublishing.clear();
    monitoring.value = false;
    previewing.value = false;
    setMetering(false);
  }

  // Mute is enforced by the gate in buildGraph, which the render loop applies
  // on its next frame -- the raw track stays live so the meter keeps reading.
  function toggleMute() {
    muted.value = !muted.value;
  }

  // The device is a shared preference, so the change is recorded here and
  // acted on by whichever session actually holds the microphone -- which may
  // be a different surface to the one whose dialog is open.
  function setMicDevice(deviceId: string) {
    if (deviceId === micDeviceId.value) {
      return;
    }

    micDeviceId.value = deviceId;
    rememberDevice(MIC_DEVICE_KEY, deviceId);
  }

  // Swaps the live track in place so the session survives a device change --
  // renegotiating would drop everyone's audio for a beat.
  async function useMicDevice() {
    if (!micStream) {
      return;
    }

    try {
      const replacement = await openMic();
      const outgoing = await buildGraph(replacement);
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

  function setNoiseSuppression(enabled: boolean) {
    noiseSuppression.value = enabled;
    remember(SUPPRESSION_KEY, String(enabled));
  }

  // Applied to the live track where the browser supports it, so toggling it
  // does not interrupt the call; only a refusal costs a reopen.
  async function useNoiseSuppression(enabled: boolean) {
    const [track] = micStream?.getAudioTracks() ?? [];

    if (!track) {
      return;
    }

    try {
      await track.applyConstraints({ noiseSuppression: enabled });
    } catch {
      await useMicDevice();
    }
  }

  function setOutputDevice(deviceId: string) {
    outputDeviceId.value = deviceId;
    rememberDevice(OUTPUT_DEVICE_KEY, deviceId);
  }

  // Only the session holding the call has anything to route; everywhere else
  // these watchers are no-ops, which is what makes one shared set of settings
  // safe to edit from any surface.
  watch(micDeviceId, () => {
    void useMicDevice();
  });

  watch(noiseSuppression, (enabled) => {
    void useNoiseSuppression(enabled);
  });

  watch(outputDeviceId, async () => {
    for (const { audio } of subscriptions.values()) {
      await applyOutput(audio);
    }
  });

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
    lastPublishing.delete(steamId);
  }

  async function poll() {
    const id = lobbyId();

    if (!id || !connected.value) {
      return;
    }

    try {
      const next = await fetchVoiceParticipants(id);

      // Left while the request was in flight: writing here would repopulate a
      // party the session no longer belongs to.
      if (!connected.value || lobbyId() !== id) {
        return;
      }

      participants.value = next;

      const now = Date.now();
      const publishing = new Set(
        // `speaking` is MediaMTX path readiness, ie. "has a live mic", not
        // voice activity -- the gate keeps the track up through every pause.
        next
          .filter((participant) => participant.speaking)
          .map((participant) => participant.steamId),
      );

      for (const steamId of publishing) {
        lastPublishing.set(steamId, now);

        if (steamId !== mySteamId.value) {
          void subscribe(steamId);
        }
      }

      // Anyone who stopped publishing: drop the peer connection rather than
      // leaving a dead one open for the rest of the session. Held briefly, so a
      // single unanswered MediaMTX poll doesn't renegotiate the whole party.
      for (const [steamId] of subscriptions) {
        if (publishing.has(steamId)) {
          continue;
        }

        if (now - (lastPublishing.get(steamId) ?? 0) < SUBSCRIPTION_GRACE_MS) {
          continue;
        }

        unsubscribe(steamId);
      }
    } catch {
      // A failed poll is not a reason to tear the session down.
    }

    if (!connected.value) {
      return;
    }

    // Backed off while the tab is hidden: nobody is reading the party list
    // from inside the game, and the peers that matter are already connected.
    pollTimer = setTimeout(
      poll,
      typeof document !== "undefined" && document.hidden ? 10_000 : 3_000,
    );
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

  // The voice session currently held somewhere else in the app, if any. Joining
  // here would take the microphone from it, so the UI warns before it does.
  const conflict = computed(() => {
    const id = lobbyId();

    return id ? registry.conflictWith(id) : null;
  });

  // Returns whatever it disconnected, so the caller can name it in a toast.
  async function joinSwitching() {
    const id = lobbyId();

    if (!id) {
      return null;
    }

    const displaced = await registry.leaveActiveUnless(id);
    await join();

    return displaced;
  }

  return {
    conflict,
    joinSwitching,
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
    setMetering,
  };
}

export type VoiceChat = ReturnType<typeof useVoiceChat>;
