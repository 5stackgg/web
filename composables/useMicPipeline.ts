import { ref, watch, onScopeDispose } from "vue";
import { useAudioSettings } from "~/composables/useAudioSettings";

// One microphone, gated and metered, ready to be published by whatever wants
// it -- a voice channel or the audio half of a camera feed. Everything from the
// mic to the outgoing track lives here so both go through the same graph:
//
//   mic -> gate worklet (level + VAD + ramped gain) -> destination -> consumer
//
// The gate is a gain, never a track swap, so muting and voice activity are
// silence on a live track rather than a track that disappears and comes back.

// How long the gate stays open after the last sample above threshold. Without
// it every pause between words clips the tail of the sentence.
const GATE_HOLD_MS = 320;
// Ramped rather than switched: a hard 0/1 gain change is an audible click.
const GATE_RAMP_S = 0.03;
// The gate and the meter run on the audio thread. See the worklet itself for
// why: a main thread loop cost a callback per display refresh and froze solid
// the moment the player alt-tabbed into the game.
const GATE_WORKLET_URL = "/voice-gate.worklet.js";

export type MicPipelineOptions = {
  // Called whenever the outgoing track is replaced -- a device change rebuilds
  // the graph, and the consumer has to hand the new track to its sender.
  onTrack?: (track: MediaStreamTrack | null) => void;
};

export function useMicPipeline(options: MicPipelineOptions = {}) {
  const settings = useAudioSettings();

  // One microphone can feed more than one destination -- the camera page
  // publishes it with its video and, if the player joins, to their team channel
  // as well -- and every one of them has to be handed the replacement when the
  // device changes.
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

  // 0..1, driven off the live mic so a player can see their own input working
  // without having to ask someone else whether they can be heard.
  const inputLevel = ref(0);
  // Whether the gate is currently letting audio through, so the UI can show the
  // same thing the other side is hearing.
  const transmitting = ref(false);
  // Loopback so a player can hear themselves. Taken after the gate, so what
  // they hear is exactly what the other side gets -- including being cut off
  // when the sensitivity is set too high.
  const monitoring = ref(false);
  const muted = ref(false);
  // The mic is open. Whether anyone is receiving it is the consumer's business.
  const live = ref(false);

  let micStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let gateNode: AudioWorkletNode | null = null;
  let gateGain: GainNode | null = null;
  let monitorGain: GainNode | null = null;
  let published: MediaStream | null = null;
  let meterFrame: number | null = null;
  let fallbackVisibility: (() => void) | null = null;
  let openUntil = 0;
  // A level bar is the only thing that wants a continuous read of the mic, so
  // nothing is metered until something is on screen to show it.
  let metering = false;

  function outgoingTrack() {
    return published?.getAudioTracks()[0] ?? null;
  }

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
      return null;
    }

    const node = new AudioWorkletNode(context, "voice-gate", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: {
        threshold: settings.threshold.value,
        mode: settings.inputMode.value,
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
      if (level >= settings.threshold.value) {
        openUntil = now + GATE_HOLD_MS;
      }

      setGate(
        (settings.inputMode.value === "open" || now < openUntil) &&
          !muted.value,
      );

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
    // `monitoring` is not reset here: this also runs when the graph is rebuilt
    // for a new microphone, and a device change is not the player closing their
    // mic check.
  }

  // Opens the mic and builds the graph. Nothing is sent anywhere until the
  // consumer takes `track()` -- which is what lets a player get their setup
  // right before anyone can hear them.
  async function start(existing?: MediaStream) {
    if (micStream) {
      return true;
    }

    micStream = existing ?? (await settings.openMic());
    // Labels are only populated once permission exists, so this is the first
    // point a device picker can show real names.
    await settings.refreshDevices();
    await buildGraph(micStream);
    live.value = true;

    return true;
  }

  function stop() {
    teardownGraph();
    setMetering(false);
    monitoring.value = false;
    live.value = false;

    for (const track of micStream?.getTracks() ?? []) {
      track.stop();
    }

    micStream = null;
    emitTrack(null);
  }

  // Swaps the microphone underneath a live session. The outgoing track changes
  // with the graph, so the consumer is handed the replacement rather than the
  // session being renegotiated.
  async function useCurrentDevice() {
    if (!micStream) {
      return;
    }

    const replacement = await settings.openMic();
    await buildGraph(replacement);

    for (const existing of micStream.getTracks()) {
      existing.stop();
    }

    micStream = replacement;
    emitTrack(outgoingTrack());
  }

  // Applied to the live track where the browser supports it, so toggling it
  // does not interrupt anything; only a refusal costs a reopen.
  async function useNoiseSuppression(enabled: boolean) {
    const [track] = micStream?.getAudioTracks() ?? [];

    if (!track) {
      return;
    }

    try {
      await track.applyConstraints({ noiseSuppression: enabled });
    } catch {
      await useCurrentDevice();
    }
  }

  // Nothing to meter until a level bar is on screen. Kept separate from "the
  // mic is open" on purpose: the settings dialog can be opened mid-call, when
  // the mic is already live.
  function setMetering(enabled: boolean) {
    metering = enabled;

    if (!enabled) {
      inputLevel.value = 0;
    }

    gateNode?.port.postMessage({ meter: enabled });
  }

  function setMuted(next: boolean) {
    muted.value = next;
  }

  function toggleMute() {
    muted.value = !muted.value;
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

  // The worklet holds its own copy of the gate settings, so pushing changes is
  // what keeps the two in step. The fallback reads the refs directly.
  watch(
    [settings.threshold, settings.inputMode, muted],
    ([nextThreshold, nextMode, nextMuted]) => {
      gateNode?.port.postMessage({
        threshold: nextThreshold,
        mode: nextMode,
        muted: nextMuted,
      });
    },
  );

  // Only the pipeline that actually holds the microphone reacts; everywhere
  // else these are no-ops, which is what makes one shared set of settings safe
  // to edit from any surface.
  watch(settings.micDeviceId, () => {
    void useCurrentDevice().catch((caught) => {
      console.error("[voice] could not switch microphone", caught);
    });
  });

  watch(settings.noiseSuppression, (enabled) => {
    void useNoiseSuppression(enabled);
  });

  onScopeDispose(stop);

  return {
    inputLevel,
    transmitting,
    monitoring,
    muted,
    live,
    start,
    stop,
    onTrack,
    track: outgoingTrack,
    stream: () => published,
    setMetering,
    setMuted,
    toggleMute,
    toggleMonitor,
  };
}

export type MicPipeline = ReturnType<typeof useMicPipeline>;
