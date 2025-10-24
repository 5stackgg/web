import { ref } from "vue";

export const useSound = () => {
  const isEnabled = ref(true);
  const volume = ref(0.7);

  const loadSettings = () => {
    if (!import.meta.client) {
      return;
    }

    const savedEnabled = localStorage.getItem("chat-sound-enabled");
    const savedVolume = localStorage.getItem("chat-sound-volume");

    if (savedEnabled !== null) {
      isEnabled.value = savedEnabled === "true";
    }
    if (savedVolume !== null) {
      volume.value = parseFloat(savedVolume);
    }
  };

  const saveSettings = () => {
    if (!import.meta.client) {
      return;
    }

    localStorage.setItem("chat-sound-enabled", isEnabled.value.toString());
    localStorage.setItem("chat-sound-volume", volume.value.toString());
  };

  const generateBeepSound = (
    frequency: number = 800,
    duration: number = 200,
  ) => {
    if (!import.meta.client) {
      return;
    }

    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(
      volume.value * 0.3,
      audioContext.currentTime + 0.01,
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration / 1000,
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);

    return audioContext;
  };

  const playNotificationSound = () => {
    generateBeepSound(800, 200);

    // Add a second beep for a more distinctive notification
    setTimeout(() => {
      generateBeepSound(600, 150);
    }, 100);
  };

  const playMatchFoundSound = () => {
    if (!import.meta.client || !isEnabled.value) {
      return;
    }

    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      const now = audioContext.currentTime;

      // Master chain with light compression for punch
      const masterGain = audioContext.createGain();
      masterGain.gain.setValueAtTime(
        Math.max(0.1, Math.min(1, volume.value)),
        now,
      );

      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, now);
      compressor.knee.setValueAtTime(20, now);
      compressor.ratio.setValueAtTime(3, now);
      compressor.attack.setValueAtTime(0.003, now);
      compressor.release.setValueAtTime(0.15, now);

      // Gentle master EQ: add low-shelf boost and lower low-pass cutoff to soften brightness
      const masterShelf = audioContext.createBiquadFilter();
      masterShelf.type = "lowshelf";
      masterShelf.frequency.setValueAtTime(80, now);
      masterShelf.gain.setValueAtTime(1.5, now);

      const masterLowpass = audioContext.createBiquadFilter();
      masterLowpass.type = "lowpass";
      masterLowpass.frequency.setValueAtTime(2000, now);
      masterLowpass.Q.setValueAtTime(0.7, now);

      compressor.connect(masterShelf);
      masterShelf.connect(masterLowpass);
      masterLowpass.connect(masterGain);
      masterGain.connect(audioContext.destination);

      // Echo network (feedback delay with low-pass in the loop)
      const echoInput = audioContext.createGain();
      echoInput.gain.setValueAtTime(1, now);
      const delayNode = audioContext.createDelay(1.0);
      delayNode.delayTime.setValueAtTime(0.22, now); // ~220ms echo
      const echoFilter = audioContext.createBiquadFilter();
      echoFilter.type = "lowpass";
      echoFilter.frequency.setValueAtTime(1200, now);
      echoFilter.Q.setValueAtTime(0.7, now);
      const feedback = audioContext.createGain();
      feedback.gain.setValueAtTime(0.25, now); // gentle repeats
      const echoWet = audioContext.createGain();
      echoWet.gain.setValueAtTime(
        Math.min(0.6, Math.max(0.15, volume.value * 0.6)),
        now,
      );

      // Wire echo: input -> delay -> filter -> feedback -> back to delay; also to wet out
      echoInput.connect(delayNode);
      delayNode.connect(echoFilter);
      echoFilter.connect(feedback);
      feedback.connect(delayNode);
      echoFilter.connect(echoWet);
      echoWet.connect(compressor);

      // 1) Punchy bass "kick" (short sine with pitch drop and fast decay)
      const kickOsc = audioContext.createOscillator();
      const kickGain = audioContext.createGain();
      kickOsc.type = "sine";
      kickOsc.frequency.setValueAtTime(140, now);
      kickOsc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
      kickGain.gain.setValueAtTime(0, now);
      kickGain.gain.linearRampToValueAtTime(
        Math.min(1, volume.value * 0.85),
        now + 0.004,
      );
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      kickOsc.connect(kickGain);
      kickGain.connect(compressor);
      kickOsc.start(now);
      kickOsc.stop(now + 0.26);

      // Utility to schedule a smooth note with filter and envelope
      const scheduleNote = (
        frequency: number,
        startOffset: number,
        length: number,
        wave: OscillatorType = "sine",
        gainLevel: number = 0.3,
      ) => {
        const osc = audioContext.createOscillator();
        const filter = audioContext.createBiquadFilter();
        const env = audioContext.createGain();

        osc.type = wave;
        osc.frequency.setValueAtTime(frequency, now + startOffset);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(450, now + startOffset);
        filter.Q.setValueAtTime(0.7, now + startOffset);
        // Open the filter modestly as the sound blooms (keeps it less bright)
        filter.frequency.linearRampToValueAtTime(
          1100,
          now + startOffset + Math.min(0.35, length),
        );

        env.gain.setValueAtTime(0, now + startOffset);
        env.gain.linearRampToValueAtTime(
          gainLevel * Math.max(0.2, volume.value),
          now + startOffset + 0.08,
        );
        env.gain.linearRampToValueAtTime(
          gainLevel * Math.max(0.12, volume.value * 0.5),
          now + startOffset + 0.4,
        );
        env.gain.exponentialRampToValueAtTime(
          0.001,
          now + startOffset + length,
        );

        osc.connect(filter);
        filter.connect(env);
        env.connect(compressor);
        // Send to echo as well
        env.connect(echoInput);

        osc.start(now + startOffset);
        osc.stop(now + startOffset + length + 0.01);
      };

      // 2) Smooth chord/arpeggio, transposed down an octave for warmth
      // C major flavor: C3, E3, G3 staggered for a gentle arpeggio
      scheduleNote(130.81, 0.05, 1.1, "sine", 0.3); // C3
      scheduleNote(164.81, 0.18, 1.0, "sine", 0.28); // E3
      scheduleNote(196.0, 0.31, 0.95, "sine", 0.26); // G3

      // Subtle sub-bass pad to bring bass forward without muddiness
      scheduleNote(65.41, 0.02, 0.6, "sine", 0.12); // C2, slightly reduced level

      // 3) Subtle bell accent with light vibrato
      const bellStart = now + 0.55;
      const bell = audioContext.createOscillator();
      const bellGain = audioContext.createGain();
      const bellFilter = audioContext.createBiquadFilter();
      const vibrato = audioContext.createOscillator();
      const vibratoDepth = audioContext.createGain();

      bell.type = "sine";
      bell.frequency.setValueAtTime(523.25, bellStart); // C5
      bellFilter.type = "bandpass";
      bellFilter.frequency.setValueAtTime(900, bellStart);
      bellFilter.Q.setValueAtTime(2, bellStart);

      // Bell envelope
      bellGain.gain.setValueAtTime(0, bellStart);
      bellGain.gain.linearRampToValueAtTime(
        Math.min(0.12, volume.value * 0.25),
        bellStart + 0.04,
      );
      bellGain.gain.exponentialRampToValueAtTime(0.001, bellStart + 0.7);

      // Gentle vibrato
      vibrato.type = "sine";
      vibrato.frequency.setValueAtTime(5, bellStart);
      vibratoDepth.gain.setValueAtTime(3, bellStart); // smaller deviation for subtler brightness
      vibrato.connect(vibratoDepth);
      vibratoDepth.connect(bell.frequency);

      bell.connect(bellFilter);
      bellFilter.connect(bellGain);
      bellGain.connect(compressor);

      bell.start(bellStart);
      vibrato.start(bellStart);
      bell.stop(bellStart + 0.72);
      vibrato.stop(bellStart + 0.72);
    } catch (error) {
      console.warn("Failed to play match found sound:", error);
    }
  };

  const playTickSound = () => {
    if (!import.meta.client || !isEnabled.value) {
      return;
    }

    try {
      // Create a keyboard-like click sound with bass
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Create a short burst for the click
      const bufferSize = audioContext.sampleRate * 0.06; // 60ms
      const buffer = audioContext.createBuffer(
        1,
        bufferSize,
        audioContext.sampleRate,
      );
      const output = buffer.getChannelData(0);

      // Generate a bass-heavy click sound
      for (let i = 0; i < bufferSize; i++) {
        const t = i / audioContext.sampleRate;

        // Low frequency component for bass (around 80-120Hz)
        const bassFreq = 100;
        const bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.4;

        // High frequency component for the "click" (around 2000-3000Hz)
        const clickFreq = 2500;
        const click = Math.sin(2 * Math.PI * clickFreq * t) * 0.2;

        // Add some filtered noise for texture
        const noise = (Math.random() * 2 - 1) * 0.15;

        // Combine all components
        output[i] = bass + click + noise;
      }

      // Create a sharp envelope for keyboard-like attack
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();

      source.buffer = buffer;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Sharp attack and quick decay for keyboard click
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        volume.value * 0.5,
        audioContext.currentTime + 0.002,
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.06,
      );

      source.start(audioContext.currentTime);
      source.stop(audioContext.currentTime + 0.06);
    } catch (error) {
      console.warn("Failed to play tick sound:", error);
    }
  };

  const playCountdownSound = () => {
    if (!import.meta.client || !isEnabled.value) {
      return;
    }

    try {
      // Single-note countdown tone (repeatable every second)
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Fixed frequency and duration for consistent repeatable tick
      const frequency = 330; // E4, clear but not harsh
      const duration = 0.18; // short pulse, fits repeating every second

      const bufferSize = Math.floor(audioContext.sampleRate * duration);
      const buffer = audioContext.createBuffer(
        1,
        bufferSize,
        audioContext.sampleRate,
      );
      const output = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        const t = i / audioContext.sampleRate;
        // Pure sine for softness
        const tone = Math.sin(2 * Math.PI * frequency * t);
        // Simple per-sample envelope: fast attack, quick decay
        const attack = 0.005;
        const decay = duration - attack;
        const env =
          t < attack ? t / attack : Math.max(0, 1 - (t - attack) / decay);
        output[i] =
          tone * env * Math.min(0.6, Math.max(0.15, volume.value * 0.6));
      }

      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      const lowpass = audioContext.createBiquadFilter();
      const dryGain = audioContext.createGain();
      const wetGain = audioContext.createGain();
      const delay = audioContext.createDelay();
      const feedback = audioContext.createGain();
      const echoFilter = audioContext.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(1800, audioContext.currentTime);
      lowpass.Q.setValueAtTime(0.7, audioContext.currentTime);

      const now = audioContext.currentTime;

      source.buffer = buffer;
      source.connect(lowpass);
      lowpass.connect(gainNode);

      // Dry path (direct signal)
      dryGain.gain.setValueAtTime(1, now);
      gainNode.connect(dryGain);
      dryGain.connect(audioContext.destination);

      // Wet path (echo with feedback)
      delay.delayTime.setValueAtTime(0.22, now); // subtle, musical echo
      feedback.gain.setValueAtTime(0.35, now); // echo persistence
      echoFilter.type = "lowpass";
      echoFilter.frequency.setValueAtTime(1500, now);
      echoFilter.Q.setValueAtTime(0.5, now);

      const wetLevel = Math.min(0.5, Math.max(0.1, volume.value * 0.4));
      wetGain.gain.setValueAtTime(wetLevel, now);
      // Let echoes fade out gracefully
      wetGain.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.7);

      gainNode.connect(delay);
      delay.connect(echoFilter);
      echoFilter.connect(wetGain);
      wetGain.connect(audioContext.destination);
      // Feedback loop
      delay.connect(feedback);
      feedback.connect(delay);

      // Additional overall gain shaping (prevents clicks between repeats)
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(
        Math.min(0.9, Math.max(0.2, volume.value)),
        now + 0.01,
      );
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      source.start(now);
      source.stop(now + duration);
    } catch (error) {
      console.warn("Failed to play countdown sound:", error);
    }
  };

  const updateSettings = (enabled: boolean, newVolume?: number) => {
    isEnabled.value = enabled;
    if (newVolume !== undefined) {
      volume.value = Math.max(0, Math.min(1, newVolume));
    }
    saveSettings();
  };

  if (import.meta.client) {
    loadSettings();
  }

  return {
    updateSettings,
    playNotificationSound,
    playMatchFoundSound,
    playTickSound,
    playCountdownSound,
    volume: readonly(volume),
    isEnabled: readonly(isEnabled),
  };
};
