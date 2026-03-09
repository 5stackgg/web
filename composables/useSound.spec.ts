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
});
