import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import FadeImage from "~/components/media/FadeImage.vue";

describe("FadeImage held still", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const loadStill = async () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100);
    vi.stubGlobal("devicePixelRatio", 2);

    const wrapper = await mountSuspended(FadeImage, {
      props: { src: "https://example.test/big.gif", still: true },
    });

    const source = wrapper.get("img").element as HTMLImageElement;
    Object.defineProperty(source, "naturalWidth", { value: 4000 });
    Object.defineProperty(source, "naturalHeight", { value: 3000 });
    source.dispatchEvent(new Event("load"));
    await flushPromises();
    await flushPromises();

    return wrapper;
  };

  // A 4000 x 3000 GIF drawn at its own size is a 48 MB canvas per tile.
  it("draws at the size it is shown, not the size of the file", async () => {
    const wrapper = await loadStill();
    const canvas = wrapper.get("canvas").element as HTMLCanvasElement;

    expect([canvas.width, canvas.height]).toEqual([400, 200]);
  });

  it("lets go of the canvas when it goes", async () => {
    const wrapper = await loadStill();
    const canvas = wrapper.get("canvas").element as HTMLCanvasElement;

    wrapper.unmount();

    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });
});
