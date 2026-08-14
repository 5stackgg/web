import { ref, onScopeDispose, type Ref } from "vue";

// Who is talking on a camera feed, for a surface that is watching rather than
// listening.
//
// The voice hub gets this for free -- each player's own gate reports over the
// socket -- but an organizer watching the camera grid is not in anybody's voice
// channel, so the only thing that knows is the audio arriving with the feed.
// That means measuring it, which is the one kind of continuous work the media
// stack otherwise avoids. It is kept affordable three ways:
//
//   - one AudioContext for the whole page, not one per tile
//   - one timer for every registered stream, not one per tile
//   - a 10Hz interval rather than an animation frame, because this drives a
//     four-bar indicator and nothing about it wants 60 samples a second
//
// Registration is explicit, so only a surface that actually shows the meter
// pays for it.

const SAMPLE_MS = 100;
// Below this the bars stay down. Set above room tone so an open mic in a quiet
// room does not read as somebody talking.
const FLOOR = 0.045;

type Entry = {
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  // Explicitly backed by an ArrayBuffer: getByteTimeDomainData will not take a
  // view over a SharedArrayBuffer, which is what the bare type allows.
  samples: Uint8Array<ArrayBuffer>;
  level: Ref<number>;
};

let context: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const entries = new Set<Entry>();

function sampleAll() {
  for (const entry of entries) {
    entry.analyser.getByteTimeDomainData(entry.samples);

    let peak = 0;

    for (let index = 0; index < entry.samples.length; index++) {
      const deviation = Math.abs(entry.samples[index] - 128);

      if (deviation > peak) {
        peak = deviation;
      }
    }

    const level = Math.min(1, peak / 96);

    entry.level.value = level < FLOOR ? 0 : level;
  }
}

function ensureTimer() {
  if (timer || entries.size === 0) {
    return;
  }

  timer = setInterval(sampleAll, SAMPLE_MS);
}

function stopTimerIfIdle() {
  if (entries.size > 0 || !timer) {
    return;
  }

  clearInterval(timer);
  timer = null;
}

export function useStreamAudioLevel() {
  const level = ref(0);

  let entry: Entry | null = null;

  function stop() {
    if (!entry) {
      return;
    }

    entries.delete(entry);
    entry.source.disconnect();
    entry.analyser.disconnect();
    entry = null;
    level.value = 0;

    stopTimerIfIdle();
  }

  // Safe to call with the same stream twice, or with null to detach: the tile
  // this serves reconnects on its own schedule.
  function watch(stream: MediaStream | null) {
    stop();

    if (!stream || stream.getAudioTracks().length === 0) {
      return;
    }

    if (typeof AudioContext === "undefined") {
      return;
    }

    context ??= new AudioContext();

    // Autoplay policy can leave the shared context suspended until the page has
    // been interacted with; nothing here makes noise, so resuming is safe.
    if (context.state === "suspended") {
      void context.resume().catch(() => {});
    }

    try {
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;

      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      // Deliberately not connected to the destination: this reads the feed, it
      // does not play it. The tile's own <video> decides whether it is audible.
      entry = {
        analyser,
        source,
        samples: new Uint8Array(analyser.frequencyBinCount),
        level,
      };

      entries.add(entry);
      ensureTimer();
    } catch (caught) {
      console.warn("[camera] could not meter this feed", caught);
      entry = null;
    }
  }

  onScopeDispose(stop);

  return { level, watch, stop };
}
