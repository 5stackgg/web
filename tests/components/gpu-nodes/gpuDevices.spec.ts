// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GPU_TEMP_CRIT,
  GPU_TEMP_HOT,
  gbOf,
  gpuDevices,
  loadTone,
  shortGpuName,
  tempTone,
  vramTone,
} from "~/components/gpu-nodes/gpuDevices";

const reading = (device: Record<string, unknown>) => ({
  gpu: [
    { time: "t0", devices: [{ index: 0, utilization_percent: 5 }] },
    { time: "t1", devices: [device] },
  ],
});

describe("gpu temperature", () => {
  it("stays calm below the hot line, warns from it, and is bad from the critical one", () => {
    expect(GPU_TEMP_HOT).toBe(80);
    expect(GPU_TEMP_CRIT).toBe(90);
    expect(tempTone(null)).toBe("ok");
    expect(tempTone(79.9)).toBe("ok");
    expect(tempTone(80)).toBe("warn");
    expect(tempTone(89)).toBe("warn");
    expect(tempTone(90)).toBe("bad");
  });

  it("tones load and video memory on their own lines", () => {
    expect(loadTone(69)).toBe("ok");
    expect(loadTone(70)).toBe("warn");
    expect(loadTone(85)).toBe("bad");
    expect(vramTone(89)).toBe("ok");
    expect(vramTone(90)).toBe("warn");
    expect(vramTone(97)).toBe("bad");
    expect(vramTone(null)).toBe("ok");
  });
});

describe("gpuDevices", () => {
  it("names each card from gpu_info and reads its newest sample", () => {
    const [card] = gpuDevices(
      {
        gpu_info: [
          { index: 0, name: "NVIDIA GeForce RTX 4070", memory_mb: 12288 },
        ],
      },
      reading({
        index: 0,
        name: "NVIDIA GeForce RTX 4070",
        memory_mb: 12288,
        memory_used_mb: 9318,
        utilization_percent: 64,
        temperature_c: 71,
        power_w: 168,
      }),
    );

    expect(card).toMatchObject({
      name: "RTX 4070",
      memoryMb: 12288,
      load: 64,
      vramUsedMb: 9318,
      temperature: 71,
      power: 168,
    });
    expect(card.vram).toBeCloseTo(75.8, 1);
  });

  it("keeps the name and capacity when there is no reading", () => {
    const [card] = gpuDevices({
      gpu_info: [{ name: "NVIDIA GeForce RTX 3080", memory_mb: 10240 }],
    });

    expect(card.name).toBe("RTX 3080");
    expect(gbOf(card.memoryMb)).toBe(10);
    expect(card.load).toBeNull();
    expect(card.vram).toBeNull();
    expect(card.temperature).toBeNull();
  });

  it("matches readings to cards by index on a two-card node", () => {
    const cards = gpuDevices(
      {
        gpu_info: [
          { index: 0, name: "NVIDIA GeForce RTX 4080 SUPER", memory_mb: 16376 },
          { index: 1, name: "NVIDIA GeForce RTX 3060", memory_mb: 12288 },
        ],
      },
      {
        gpu: [
          {
            time: "t",
            devices: [
              { index: 1, utilization_percent: 2, temperature_c: 39 },
              { index: 0, utilization_percent: 47, temperature_c: 83 },
            ],
          },
        ],
      },
    );

    expect(cards.map((card) => [card.name, card.load])).toEqual([
      ["RTX 4080 SUPER", 47],
      ["RTX 3060", 2],
    ]);
    expect(tempTone(cards[0].temperature)).toBe("warn");
  });

  it("falls back to the reading's own name when gpu_info is empty", () => {
    const cards = gpuDevices(
      { gpu_info: [] },
      reading({ index: 0, name: "NVIDIA RTX A4000", utilization_percent: 0 }),
    );

    expect(cards).toHaveLength(1);
    expect(cards[0].name).toBe("RTX A4000");
    expect(gpuDevices({ gpu_info: null })).toEqual([]);
    expect(shortGpuName("")).toBeNull();
  });
});
