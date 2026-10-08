import { describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ZoomableImage from "~/components/media/ZoomableImage.vue";

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;

const scale = (wrapper: Wrapper) =>
  Number(
    /scale\(([\d.]+)\)/.exec(
      wrapper.find("img").attributes("style") ?? "",
    )?.[1],
  );

async function mount(props: Record<string, unknown>) {
  return await mountSuspended(ZoomableImage, {
    props: { src: "https://cdn.test/aim_close.webp", ...props },
    attachTo: document.body,
  });
}

describe("ZoomableImage", () => {
  it("rests at its crop and zooms in on the wheel", async () => {
    const wrapper = await mount({ baseScale: 1.8 });
    expect(scale(wrapper)).toBe(1.8);

    wrapper.element.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -200, cancelable: true }),
    );
    await flushPromises();
    expect(scale(wrapper)).toBeGreaterThan(1.8);
  });

  it("toggles a close zoom and back on double-click", async () => {
    const wrapper = await mount({ baseScale: 1.8 });

    await wrapper.trigger("dblclick");
    expect(scale(wrapper)).toBe(3);

    await wrapper.trigger("dblclick");
    expect(scale(wrapper)).toBe(1.8);
  });

  it("is a plain picture when it is not interactive", async () => {
    const wrapper = await mount({ interactive: false });

    wrapper.element.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -200, cancelable: true }),
    );
    await wrapper.trigger("dblclick");
    await flushPromises();

    expect(scale(wrapper)).toBe(1);
    expect(wrapper.find("button").exists()).toBe(false);
  });
});
