import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import GpuPlate from "~/components/gpu-nodes/GpuPlate.vue";
import type { GpuDeviceView } from "~/components/gpu-nodes/gpuDevices";

const card = (fields: Partial<GpuDeviceView> = {}): GpuDeviceView => ({
  key: "0",
  name: "RTX 5060",
  memoryMb: 8192,
  load: 10,
  vramUsedMb: 1740,
  vram: 21,
  temperature: 42,
  power: 25,
  ...fields,
});

const mountPlate = (devices: GpuDeviceView[]) =>
  mountSuspended(GpuPlate, {
    props: {
      devices,
      tone: "ok",
      live: false,
      statusLabel: "Online",
      working: false,
      enabled: true,
    },
  });

describe("GpuPlate", () => {
  it("shows the card's capacity and a calm temperature without a warning", async () => {
    const wrapper = await mountPlate([card()]);

    expect(wrapper.text()).toContain("RTX 5060");
    expect(wrapper.text()).toContain("8 GB");
    expect(wrapper.text()).toContain("42 °C");
    expect(wrapper.find('[data-testid="gpu-temp-warn"]').exists()).toBe(false);
  });

  it("warns from 80 °C and turns red from 90 °C", async () => {
    const hot = await mountPlate([card({ temperature: 83 })]);
    const critical = await mountPlate([card({ temperature: 91 })]);

    expect(hot.find('[data-testid="gpu-temp-warn"]').exists()).toBe(true);
    expect(hot.get(".gpl-sub [data-tone]").attributes("data-tone")).toBe(
      "warn",
    );
    expect(critical.get(".gpl-sub [data-tone]").attributes("data-tone")).toBe(
      "bad",
    );
  });

  it("gives a two-card node a line per card with its own gauge", async () => {
    const wrapper = await mountPlate([
      card({ key: "0", name: "RTX 4080 SUPER", memoryMb: 16376 }),
      card({ key: "1", name: "RTX 3060", memoryMb: 12288, temperature: 39 }),
    ]);

    expect(wrapper.findAll('[data-testid="gpu-plate-card"]')).toHaveLength(2);
    expect(wrapper.text()).toContain("RTX 3060");
    expect(wrapper.text()).toContain("12 GB");
    expect(wrapper.find(".gpl-count").text()).toBe("2");
  });

  it("fills the gauge bars from load and video memory", async () => {
    const wrapper = await mountPlate([card({ load: 64, vram: 50 })]);

    const [load, vram] = wrapper.findAll(".gpl-bar > i");
    expect(load.attributes("style")).toContain("scaleY(0.640)");
    expect(vram.attributes("style")).toContain("scaleY(0.500)");
  });
});
