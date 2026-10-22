import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import StreamControls from "~/components/match/StreamControls.vue";

async function mountControls(
  props: Record<string, unknown> = {},
  slots: Record<string, string> = {},
) {
  return mountSuspended(StreamControls, { props, slots });
}

describe("StreamControls", () => {
  it("puts fullscreen and the host's buttons bottom left, sound bottom right", async () => {
    const wrapper = await mountControls(
      { fullscreen: false, muted: false, volume: 0.5 },
      { default: '<button type="button" class="host-control" />' },
    );
    const fullscreen = wrapper.find('button[aria-label="Fullscreen"]');
    const mute = wrapper.find('button[aria-label="Mute"]');

    expect(fullscreen.element.parentElement!.className).toContain("left-");
    expect(fullscreen.element.nextElementSibling?.className).toBe(
      "host-control",
    );
    expect(mute.element.parentElement!.className).toContain("right-");
    expect(mute.element.parentElement!.className).toContain("backdrop-blur");
    expect(wrapper.find('input[type="range"]').exists()).toBe(true);
  });

  it("keeps Tap to unmute up while the rest hides", async () => {
    const wrapper = await mountControls({
      fullscreen: false,
      muted: true,
      volume: 1,
      unmutePill: true,
      visible: false,
    });
    const pill = wrapper.find('button[aria-label="Unmute"]');

    expect(pill.text()).toBe("Tap to unmute");
    expect(pill.classes()).not.toContain("opacity-0");
    expect(
      wrapper.find('button[aria-label="Fullscreen"]').element.parentElement!
        .className,
    ).toContain("opacity-0");
    expect(wrapper.find('input[type="range"]').exists()).toBe(false);
  });

  it("swaps the icon instead without the pill, and drops the slider while muted", async () => {
    const wrapper = await mountControls({ muted: true, volume: 1 });

    expect(wrapper.find('button[aria-label="Unmute"]').text()).toBe("");
    expect(wrapper.find('input[type="range"]').exists()).toBe(false);
  });

  describe("on touch", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("stays up without hover, but still hides when the host says so", async () => {
      vi.spyOn(window, "matchMedia").mockReturnValue({
        matches: true,
      } as MediaQueryList);
      const fullscreenBar = (wrapper: any) =>
        wrapper.find('button[aria-label="Fullscreen"]').element.parentElement!
          .className;

      const shown = await mountControls({ fullscreen: false });
      await flushPromises();
      expect(fullscreenBar(shown)).toContain("opacity-100");

      const hidden = await mountControls({ fullscreen: false, visible: false });
      await flushPromises();
      expect(fullscreenBar(hidden)).toContain("opacity-0");
    });
  });

  it("leaves out what the host passes as null", async () => {
    const wrapper = await mountControls({ muted: false });

    expect(wrapper.find('button[aria-label="Fullscreen"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('button[aria-label="Mute"]').exists()).toBe(true);
    expect(wrapper.find('input[type="range"]').exists()).toBe(false);
  });

  it("keeps both bars together in one corner when aligned to the end", async () => {
    const wrapper = await mountControls({
      fullscreen: false,
      muted: false,
      align: "end",
      placement: "top",
    });
    const root = wrapper.find(".stream-controls");

    expect(root.classes()).toContain("top-[var(--stream-control-inset)]");
    expect(root.classes()).toContain("right-[var(--stream-control-inset)]");
    expect(root.findAll(".backdrop-blur-\\[14px\\]")).toHaveLength(2);
  });

  it("leaves pointer events to the host, so a click-through tile stays one", async () => {
    const wrapper = await mountControls({
      fullscreen: false,
      muted: true,
      unmutePill: true,
    });

    expect(wrapper.find(".pointer-events-auto").exists()).toBe(false);
  });

  it("reports what the viewer asks for", async () => {
    const wrapper = await mountControls({
      fullscreen: false,
      muted: false,
      volume: 1,
    });

    await wrapper.find('button[aria-label="Fullscreen"]').trigger("click");
    await wrapper.find('button[aria-label="Mute"]').trigger("click");
    await wrapper.find('input[type="range"]').setValue("0.3");

    expect(wrapper.emitted("toggle-fullscreen")).toHaveLength(1);
    expect(wrapper.emitted("toggle-mute")).toHaveLength(1);
    expect(wrapper.emitted("update:volume")?.at(-1)).toEqual([0.3]);
  });
});
