import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import StreamCanvas from "~/components/match/StreamCanvas.vue";

const WHEP_URL = "https://stream.example/demo-1/whep";

let unmount: (() => void) | undefined;

async function mountCanvas(props: Record<string, unknown>) {
  const wrapper = await mountSuspended(StreamCanvas, {
    props: { whepUrl: WHEP_URL, showBoot: true, ...props },
    slots: { boot: () => "booting" },
    global: {
      stubs: {
        WhepPlayer: { template: '<div class="whep-player" />' },
      },
    },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

describe("StreamCanvas", () => {
  it("holds the player back until the stream is live", async () => {
    const wrapper = await mountCanvas({ isLive: false });

    expect(wrapper.find(".whep-player").exists()).toBe(false);
    expect(wrapper.text()).toContain("booting");
  });

  it("connects under the boot screen when asked to preconnect", async () => {
    const wrapper = await mountCanvas({ isLive: false, preconnect: true });

    expect(wrapper.find(".whep-player").exists()).toBe(true);
    expect(wrapper.text()).toContain("booting");
  });

  it("keeps the same player when the stream goes live", async () => {
    const wrapper = await mountCanvas({ isLive: false, preconnect: true });
    const player = wrapper.find(".whep-player").element;

    await wrapper.setProps({ isLive: true, preconnect: false });

    expect(wrapper.find(".whep-player").element).toBe(player);
  });
});
