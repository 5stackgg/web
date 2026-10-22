import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ClipPlayer from "~/components/clips/ClipPlayer.vue";

describe("ClipPlayer", () => {
  it("draws the same controls as the stream players, together bottom right", async () => {
    const wrapper = await mountSuspended(ClipPlayer, {
      props: { src: "https://cdn.example/clip.mp4" },
      slots: {
        controls: `<template #controls="{ buttonClass }"><button type="button" :class="buttonClass" class="theater" /></template>`,
      },
    });
    const controls = wrapper.find(".stream-controls");

    expect(controls.classes()).toContain("bottom-[var(--stream-control-inset)]");
    expect(controls.classes()).toContain("right-[var(--stream-control-inset)]");
    expect(
      controls.find('button[aria-label="Fullscreen"]').element
        .nextElementSibling?.classList.contains("theater"),
    ).toBe(true);
    expect(controls.find('button[aria-label="Mute"]').exists()).toBe(true);
    expect(controls.find('input[type="range"]').exists()).toBe(true);
  });
});
