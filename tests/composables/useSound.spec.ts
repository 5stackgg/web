import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSound } from "~/composables/useSound";

let constructed = 0;

class FakeAudioContext {
  currentTime = 0;
  destination = {};

  constructor() {
    constructed += 1;
  }

  createOscillator() {
    return {
      type: "sine",
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  createGain() {
    return {
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    };
  }
}

beforeEach(() => {
  constructed = 0;
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.useFakeTimers({ toFake: ["setTimeout"] });
});

afterEach(() => {
  useSound().updateSettings(true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("useSound chat notification", () => {
  it("plays both beeps while sounds are on", () => {
    const { playNotificationSound } = useSound();

    playNotificationSound();
    vi.runAllTimers();

    expect(constructed).toBe(2);
  });

  it("stays silent once sounds are turned off", () => {
    const { updateSettings, playNotificationSound } = useSound();

    updateSettings(false);
    playNotificationSound();
    vi.runAllTimers();

    expect(constructed).toBe(0);
  });
});
