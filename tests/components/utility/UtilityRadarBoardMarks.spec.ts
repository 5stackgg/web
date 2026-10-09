import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import metadata from "~/public/radars/metadata.json";
import type { UtilityLineup } from "~/types/utility";

const CANVAS = 1024;

const lineup = {
  id: "l-1",
  name: "Window smoke",
  map_name: "de_mirage",
  utility_type: "Smoke",
  side: "T",
  origin_x: -1200,
  origin_y: -1300,
  origin_z: -160,
  land_x: -800,
  land_y: -600,
  land_z: -160,
} as unknown as UtilityLineup;

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;
type Board = { zoom: number; zoomIn: () => void };

const mounted: Wrapper[] = [];

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

// A board `frame` CSS px wide, on a screen that is or is not a touch screen.
async function mountBoard(frame: number, coarse: boolean) {
  // Nothing is laid out here, so the measurement is handed over the way a
  // browser reports it: on the first observation.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private report: ResizeObserverCallback) {}
      observe(target: Element) {
        const box = [{ inlineSize: frame, blockSize: frame }];
        this.report(
          [
            { target, contentBoxSize: box, borderBoxSize: box },
          ] as unknown as ResizeObserverEntry[],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("coarse") ? coarse : false,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(metadata))),
  );
  const wrapper = await mountSuspended(UtilityRadarBoard, {
    props: {
      mapName: "de_mirage",
      lineups: [lineup],
      seedSrc: "/radars/de_mirage.png",
    },
    attachTo: document.body,
  });
  mounted.push(wrapper);
  await flushPromises();
  await wrapper.vm.$nextTick();
  return wrapper;
}

const board = (wrapper: Wrapper) => wrapper.vm as unknown as Board;

// What a radius written into the svg measures on the glass, in CSS px.
function onScreen(wrapper: Wrapper, frame: number, selector: string) {
  const px = (frame * board(wrapper).zoom) / CANVAS;
  return wrapper
    .findAll(selector)
    .map((circle) => Number(circle.attributes("r")) * px);
}

async function zoomThrough(wrapper: Wrapper, read: () => number[]) {
  const seen: { zoom: number; sizes: number[] }[] = [];
  for (let step = 0; step < 7; step++) {
    seen.push({ zoom: board(wrapper).zoom, sizes: read() });
    board(wrapper).zoomIn();
    await flushPromises();
  }
  return seen;
}

// The landing ring: the one circle drawn in the lineup's own colour.
const RING = "g.utility-glyph-fade circle:last-child";

describe("UtilityRadarBoard marks", () => {
  it("keeps a mark the same size on a phone however far in the map is", async () => {
    const wrapper = await mountBoard(390, true);
    const seen = await zoomThrough(wrapper, () =>
      onScreen(wrapper, 390, RING),
    );

    expect(seen[0].zoom).toBe(1);
    expect(seen[seen.length - 1].zoom).toBe(6);
    const radii = seen.map((entry) => entry.sizes[0]);
    // Stretched with a 390px board it used to be 2.7px, at every zoom. Under
    // a finger the ring is 18px across inside its casing, 22px with it.
    expect(radii[0]).toBeCloseTo(7 * 1.3);
    radii.slice(1).forEach((radius, index) => {
      expect(radius).toBeGreaterThanOrEqual(radii[index]);
    });
    expect(radii[radii.length - 1] / radii[0]).toBeLessThan(1.35);
  });

  it("gives a finger 44px to hit at every zoom", async () => {
    const wrapper = await mountBoard(390, true);
    const seen = await zoomThrough(wrapper, () =>
      onScreen(wrapper, 390, "[data-mark-hit]"),
    );

    for (const entry of seen) {
      expect(entry.sizes).toHaveLength(2);
      for (const radius of entry.sizes) {
        expect(radius * 2).toBeGreaterThanOrEqual(44 - 1e-6);
      }
    }
  });

  it("gives a mouse at least 24px, and the marks as they were drawn", async () => {
    const wrapper = await mountBoard(888, false);
    const seen = await zoomThrough(wrapper, () =>
      onScreen(wrapper, 888, "[data-mark-hit]"),
    );
    const rings = onScreen(wrapper, 888, RING);

    for (const entry of seen) {
      for (const radius of entry.sizes) {
        expect(radius * 2).toBeGreaterThanOrEqual(24 - 1e-6);
        expect(radius * 2).toBeLessThan(44);
      }
    }
    // A board this wide draws its marks to its own scale, as before; all the
    // way in they have gained a third.
    expect(seen[0].sizes[0] * 2).toBeCloseTo(24);
    expect(rings[0]).toBeCloseTo(((7 * 888) / CANVAS) * 6 ** 0.15);
  });

  it("lays the board out at the zoom it rests at, instead of stretching it", async () => {
    const wrapper = await mountBoard(390, true);
    const layer = wrapper.find("[data-board-layer]").element as HTMLElement;
    const map = wrapper.find(".aspect-square").element;
    const finger = (type: string, id: number, x: number) =>
      map.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          pointerType: "touch",
          isPrimary: id === 1,
          clientX: x,
          clientY: 200,
          bubbles: true,
        }),
      );

    expect(layer.style.width).toBe("100%");
    expect(layer.style.transform).toContain("scale(1)");

    finger("pointerdown", 1, 100);
    finger("pointerdown", 2, 200);
    finger("pointermove", 1, 50);
    finger("pointermove", 2, 250);
    await flushPromises();
    // Mid-pinch the difference rides the transform: no layout per frame.
    expect(board(wrapper).zoom).toBeCloseTo(2);
    expect(layer.style.width).toBe("100%");
    expect(layer.style.transform).toContain("scale(2)");

    finger("pointerup", 2, 250);
    finger("pointerup", 1, 50);
    await flushPromises();
    expect(layer.style.width).toBe("200%");
    expect(layer.style.left).toBe("-50%");
    expect(layer.style.transform).toContain("scale(1)");
  });

  // Laying the board out again is a layout of everything on it. One per
  // event of a gesture is a layout per frame.
  it("rides the transform through a double-tap drag, too", async () => {
    const wrapper = await mountBoard(390, true);
    const layer = wrapper.find("[data-board-layer]").element as HTMLElement;
    const map = wrapper.find(".aspect-square").element;
    const finger = (type: string, y: number) =>
      map.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          clientX: 100,
          clientY: y,
          bubbles: true,
        }),
      );

    finger("pointerdown", 100);
    finger("pointerup", 100);
    finger("pointerdown", 100);
    finger("pointermove", 130);
    finger("pointermove", 160);
    await flushPromises();
    expect(board(wrapper).zoom).toBeCloseTo(Math.exp(0.6), 2);
    expect(layer.style.width).toBe("100%");
    expect(layer.style.willChange).toBe("transform");

    finger("pointerup", 160);
    await flushPromises();
    expect(layer.style.width).not.toBe("100%");
    expect(layer.style.transform).toContain("scale(1)");
  });

  it("rides it through a wheel with no glide, and lays out when the wheel rests", async () => {
    const wrapper = await mountBoard(888, false);
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query.includes("reduced-motion"),
          media: query,
          addEventListener() {},
          removeEventListener() {},
        }) as unknown as MediaQueryList,
    );
    const layer = wrapper.find("[data-board-layer]").element as HTMLElement;
    const map = wrapper.find(".aspect-square").element;
    const wheel = () =>
      map.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: -60,
          bubbles: true,
          cancelable: true,
        }),
      );

    wheel();
    wheel();
    wheel();
    await flushPromises();
    expect(board(wrapper).zoom).toBeGreaterThan(1.3);
    expect(layer.style.width).toBe("100%");

    await new Promise((resolve) => setTimeout(resolve, 220));
    await flushPromises();
    expect(layer.style.width).not.toBe("100%");
    expect(layer.style.transform).toContain("scale(1)");
  });
});
