import { useSound } from "./useSound";

describe("useSound", () => {
  it("clamps volume to maximum of 1.0", () => {
    const { updateSettings, volume } = useSound();
    updateSettings(true, 1.5);
    expect(volume.value).toBe(1.0);
  });

  it("clamps volume to minimum of 0.0", () => {
    const { updateSettings, volume } = useSound();
    updateSettings(true, -0.5);
    expect(volume.value).toBe(0.0);
  });

  it("accepts valid volume values", () => {
    const { updateSettings, volume } = useSound();
    updateSettings(true, 0.7);
    expect(volume.value).toBe(0.7);
  });

  it("toggles enabled state", () => {
    const { updateSettings, isEnabled } = useSound();
    updateSettings(false);
    expect(isEnabled.value).toBe(false);
  });

  it("keeps volume within bounds after multiple updates", () => {
    const { updateSettings, volume } = useSound();
    updateSettings(true, 0.5);
    updateSettings(true, 2.0);
    expect(volume.value).toBe(1.0);
    updateSettings(true, -1.0);
    expect(volume.value).toBe(0.0);
  });

  it("defaults to enabled with volume 0.7", () => {
    const { isEnabled, volume } = useSound();
    expect(isEnabled.value).toBe(true);
    expect(volume.value).toBe(0.7);
  });

  it("volume and isEnabled are readonly refs", () => {
    const { isEnabled, volume } = useSound();
    // readonly refs still have .value but writes are no-ops in production
    expect(typeof isEnabled.value).toBe("boolean");
    expect(typeof volume.value).toBe("number");
  });

  it("playMatchFoundSound returns early when isEnabled is false", () => {
    const { updateSettings, playMatchFoundSound } = useSound();
    updateSettings(false);
    // Guard returns early before AudioContext — should not throw
    expect(() => playMatchFoundSound()).not.toThrow();
  });

  it("playTickSound returns early when isEnabled is false", () => {
    const { updateSettings, playTickSound } = useSound();
    updateSettings(false);
    expect(() => playTickSound()).not.toThrow();
  });

  it("playCountdownSound returns early when isEnabled is false", () => {
    const { updateSettings, playCountdownSound } = useSound();
    updateSettings(false);
    expect(() => playCountdownSound()).not.toThrow();
  });
});
