import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref, type PropType } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { useMapCover } from "~/composables/useMapCover";

// A phone: the page scrolls in a box that starts under a 60px header, and
// the map's frame is a 390px square inside it.
const WINDOW = { width: 390, height: 800 };
const SCROLLER = { left: 0, top: 60, width: 390, height: 740 };

let frameTop = 170;

type Box = { left: number; top: number; size: number[] };

const boxes: Record<string, () => Box> = {
  frame: () => ({ left: 0, top: frameTop, size: [390, 390] }),
  scroller: () => ({
    left: SCROLLER.left,
    top: SCROLLER.top,
    size: [SCROLLER.width, SCROLLER.height],
  }),
};

function boxOf(element: Element) {
  return boxes[element.className]?.() ?? { left: 0, top: 0, size: [0, 0] };
}

const Host = defineComponent({
  props: {
    from: { type: Number as PropType<number | null>, default: null },
  },
  setup(props, { expose }) {
    const frame = ref<HTMLElement | null>(null);
    const { cover } = useMapCover({
      frame: () => frame.value,
      coveredFrom: () => props.from,
    });
    expose({ cover });
    return () =>
      h("div", [
        h("div", { class: "scroller", style: "overflow-y: auto" }, [
          h("div", { class: "frame", ref: frame }),
        ]),
        h("div", { class: "list", style: "overflow-y: auto" }),
      ]);
  },
});

type Wrapper = ReturnType<typeof mount<typeof Host>>;

const mounted: Wrapper[] = [];

beforeEach(() => {
  frameTop = 170;
  Object.defineProperty(window, "innerWidth", {
    value: WINDOW.width,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: WINDOW.height,
    configurable: true,
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const { left, top, size } = boxOf(this);
      return {
        left,
        top,
        width: size[0],
        height: size[1],
        right: left + size[0],
        bottom: top + size[1],
        x: left,
        y: top,
      } as DOMRect;
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return boxOf(this).size[0];
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return boxOf(this).size[1];
    },
  );
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

async function mountHost(from: number | null) {
  const wrapper = mount(Host, { props: { from }, attachTo: document.body });
  mounted.push(wrapper);
  await flushPromises();
  return wrapper;
}

const cover = (wrapper: Wrapper) =>
  (wrapper.vm as unknown as { cover: Record<string, number> }).cover;

// The next animation frame, which is when a scroll or a resize is read.
const nextFrame = async () => {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await flushPromises();
};

describe("useMapCover", () => {
  it("is how far the sheet's top edge comes up the map's frame", async () => {
    const wrapper = await mountHost(480);

    expect(cover(wrapper)).toEqual({ top: 0, right: 0, bottom: 80, left: 0 });
  });

  it("follows that edge as the sheet comes to rest somewhere else", async () => {
    const wrapper = await mountHost(480);

    await wrapper.setProps({ from: 712 });
    expect(cover(wrapper)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });

    await wrapper.setProps({ from: 72 });
    expect(cover(wrapper)).toEqual({ top: 0, right: 0, bottom: 390, left: 0 });
  });

  it("counts what has scrolled out under the page's own top edge", async () => {
    frameTop = 20;
    const wrapper = await mountHost(380);

    expect(cover(wrapper)).toEqual({ top: 40, right: 0, bottom: 30, left: 0 });
  });

  it("reads again a frame after the page under the map scrolls", async () => {
    const wrapper = await mountHost(480);

    frameTop = 110;
    wrapper.find(".scroller").element.dispatchEvent(new Event("scroll"));
    expect(cover(wrapper).bottom).toBe(80);
    await nextFrame();

    expect(cover(wrapper)).toEqual({ top: 0, right: 0, bottom: 20, left: 0 });
  });

  it("is not moved by a list scrolling somewhere else", async () => {
    const wrapper = await mountHost(480);

    frameTop = 110;
    wrapper.find(".list").element.dispatchEvent(new Event("scroll"));
    await nextFrame();

    expect(cover(wrapper).bottom).toBe(80);
  });

  it("reads again when the window changes size", async () => {
    const wrapper = await mountHost(480);

    frameTop = 140;
    window.dispatchEvent(new Event("resize"));
    await nextFrame();

    expect(cover(wrapper).bottom).toBe(50);
  });

  it("reads again once whatever is carrying the map into place has landed", async () => {
    // The page slides in from 20px lower down, map and all.
    frameTop = 190;
    let land = () => {};
    const slide = {
      effect: { target: document.body },
      playState: "running",
      finished: new Promise<void>((resolve) => (land = resolve)),
    };
    const running = [slide];
    Object.defineProperty(document, "getAnimations", {
      value: () => running,
      configurable: true,
    });
    const wrapper = await mountHost(480);
    expect(cover(wrapper).bottom).toBe(100);

    frameTop = 170;
    running.length = 0;
    land();
    await flushPromises();
    await nextFrame();

    expect(cover(wrapper).bottom).toBe(80);
    Reflect.deleteProperty(document, "getAnimations");
  });

  it("measures nothing while nothing lies over the map", async () => {
    frameTop = 20;
    const wrapper = await mountHost(null);

    expect(cover(wrapper)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });

    await wrapper.setProps({ from: 380 });
    expect(cover(wrapper).bottom).toBe(30);
    await wrapper.setProps({ from: null });
    expect(cover(wrapper)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});
