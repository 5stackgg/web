// Voice activity gate + input meter, on the audio thread.
//
// This used to be an AnalyserNode read from requestAnimationFrame on the main
// thread, which cost a full frame callback + a reactive write per display
// refresh (240/s on the monitors this app is actually used on) and -- worse --
// stopped dead the moment the tab was backgrounded. A player who alt-tabbed
// into the game left the gate frozen at whatever it was: usually shut, so the
// rest of the party never heard them again.
//
// An AudioWorkletProcessor runs in the audio rendering thread regardless of
// page visibility, so the gate keeps working while they play, and the main
// thread only hears about it when something actually changes.

const HOLD_SECONDS = 0.32;
// Time constant of the open/close ramp. A hard 0/1 switch is an audible click.
const RAMP_SECONDS = 0.03;
// Byte-domain parity: the old meter read 0..127 peaks and divided by 96, so a
// float peak maps the same way and every stored threshold keeps its meaning.
const LEVEL_SCALE = 128 / 96;
// Meter updates are only useful to a UI that is on screen. Off by default: a
// connected player with no settings panel open needs no level messages at all.
const METER_INTERVAL_SECONDS = 0.08;

class VoiceGateProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const settings = options?.processorOptions ?? {};

    this.threshold = settings.threshold ?? 0.08;
    this.mode = settings.mode ?? "voice";
    this.muted = settings.muted === true;
    this.meter = settings.meter === true;

    this.gain = 0;
    this.openUntil = 0;
    this.transmitting = false;
    this.lastReportAt = 0;
    this.reportedLevel = -1;
    // Per-sample ramp coefficient, same shape as setTargetAtTime.
    this.coefficient = 1 - Math.exp(-1 / (RAMP_SECONDS * sampleRate));
    this.ramp = new Float32Array(128);

    this.port.onmessage = (event) => {
      const data = event.data ?? {};

      if (typeof data.threshold === "number") {
        this.threshold = data.threshold;
      }

      if (typeof data.mode === "string") {
        this.mode = data.mode;
      }

      if (typeof data.muted === "boolean") {
        this.muted = data.muted;
      }

      if (typeof data.meter === "boolean") {
        this.meter = data.meter;
        // Re-arm so switching the meter on updates the bar immediately rather
        // than after the next interval.
        this.reportedLevel = -1;
        this.lastReportAt = 0;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!output || !output.length) {
      return true;
    }

    const source = input && input.length ? input[0] : null;
    const frames = output[0].length;

    if (!source) {
      // Nothing upstream yet (or the track ended): emit silence but stay alive,
      // returning false would drop the node out of the graph for good.
      for (let channel = 0; channel < output.length; channel++) {
        output[channel].fill(0);
      }

      return true;
    }

    let peak = 0;

    for (let i = 0; i < frames; i++) {
      const sample = source[i] < 0 ? -source[i] : source[i];

      if (sample > peak) {
        peak = sample;
      }
    }

    const level = Math.min(1, peak * LEVEL_SCALE);

    if (level >= this.threshold) {
      this.openUntil = currentTime + HOLD_SECONDS;
    }

    const gateOpen = this.mode === "open" || currentTime < this.openUntil;
    const transmitting = gateOpen && !this.muted;
    const target = transmitting ? 1 : 0;

    if (this.ramp.length !== frames) {
      this.ramp = new Float32Array(frames);
    }

    for (let i = 0; i < frames; i++) {
      this.gain += (target - this.gain) * this.coefficient;
      this.ramp[i] = this.gain;
    }

    for (let channel = 0; channel < output.length; channel++) {
      const from = input[channel] ?? source;
      const to = output[channel];

      for (let i = 0; i < frames; i++) {
        to[i] = from[i] * this.ramp[i];
      }
    }

    // The main thread is told about a state flip immediately -- that drives the
    // transmit indicator -- and about the level only while a meter is on show.
    if (transmitting !== this.transmitting) {
      this.transmitting = transmitting;
      this.lastReportAt = currentTime;
      this.reportedLevel = level;
      this.port.postMessage({ transmitting, level });

      return true;
    }

    if (
      this.meter &&
      currentTime - this.lastReportAt >= METER_INTERVAL_SECONDS
    ) {
      this.lastReportAt = currentTime;

      // A meter bar is drawn in whole percent; anything finer is a reactive
      // write and a re-render nobody can see.
      if (Math.abs(level - this.reportedLevel) >= 0.01) {
        this.reportedLevel = level;
        this.port.postMessage({ transmitting, level });
      }
    }

    return true;
  }
}

registerProcessor("voice-gate", VoiceGateProcessor);
