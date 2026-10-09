import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import metadata from "~/public/radars/metadata.json";
import type { UtilityLineup } from "~/types/utility";
import type { UtilityMetaSpot } from "~/utilities/utilityDisplay";

const CANVAS = 1024;
const FRAME = 390;

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

// A mined spot that lands 200 units east of the lineup: about 15px away on a
// phone, well inside the lineup's 22px of reach.
const spot = {
  key: "de_mirage:Smoke:1",
  utilityType: "Smoke",
  side: "T",
  technique: null,
  throwStrength: null,
  throwers: 12,
  throws: 40,
  matches: 9,
  lineups: 0,
  viewYaw: null,
  viewPitch: null,
  firstSeenAt: null,
  lastSeenAt: null,
  refreshedAt: null,
  origin: { x: -1500, y: -1400, z: -160 },
  landing: { x: -600, y: -600, z: -160 },
} as unknown as UtilityMetaSpot;

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;
const mounted: Wrapper[] = [];

afterEach(() => {
  vi.useRealTimers();
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

// A 390px board on a screen that is touched, or pointed at.
async function mountBoard(coarse: boolean, props: Record<string, unknown> = {}) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private report: ResizeObserverCallback) {}
      observe(target: Element) {
        const box = [{ inlineSize: FRAME, blockSize: FRAME }];
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
      ...props,
    },
    attachTo: document.body,
  });
  mounted.push(wrapper);
  await flushPromises();
  await wrapper.vm.$nextTick();
  // Nothing is laid out here: the map is given the box a phone gives it.
  const box = { left: 0, top: 0, width: FRAME, height: FRAME } as DOMRect;
  wrapper.find("svg").element.getBoundingClientRect = () => box;
  wrapper.find(".aspect-square").element.getBoundingClientRect = () => box;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  return wrapper;
}

const px = (units: number) => (units * FRAME) / CANVAS;

// Where a circle written into the svg is on the glass.
function centre(circle: Element) {
  return {
    x: px(Number(circle.getAttribute("cx"))),
    y: px(Number(circle.getAttribute("cy"))),
  };
}

const landing = (wrapper: Wrapper) =>
  centre(wrapper.findAll("[data-mark-hit]")[0].element);
const ring = (wrapper: Wrapper) =>
  centre(wrapper.find("g.meta-marker circle").element);

// A finger down and up at a point, and the click the browser makes of it,
// sent to whatever is drawn topmost there: `on`.
function tap(on: Element, at: { x: number; y: number }) {
  const init = {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: at.x,
    clientY: at.y,
    button: 0,
    bubbles: true,
    cancelable: true,
  };
  on.dispatchEvent(new PointerEvent("pointerdown", init));
  on.dispatchEvent(new PointerEvent("pointerup", init));
  on.dispatchEvent(new MouseEvent("click", init));
}

const zoomOf = (wrapper: Wrapper) =>
  (wrapper.vm as unknown as { zoom: number }).zoom;
const lineupMark = (wrapper: Wrapper) =>
  wrapper.find("g[data-peek-line]").element;

describe("UtilityRadarBoard taps on a phone", () => {
  it("opens a mark at once when the tap lands on it", async () => {
    const wrapper = await mountBoard(true);

    tap(lineupMark(wrapper), landing(wrapper));

    expect(wrapper.emitted("select")).toEqual([["l-1"]]);
  });

  // The room round a mark is there for a finger that misses; it is also most
  // of the map, and the first tap of a double tap lands in it.
  it("waits out a double tap for a tap beside a mark, then opens it", async () => {
    const wrapper = await mountBoard(true);
    const at = landing(wrapper);

    tap(lineupMark(wrapper), { x: at.x - 16, y: at.y });
    expect(wrapper.emitted("select")).toBeUndefined();

    await vi.advanceTimersByTimeAsync(320);
    expect(wrapper.emitted("select")).toEqual([["l-1"]]);
  });

  it("zooms on a double tap beside a mark, and opens nothing", async () => {
    const wrapper = await mountBoard(true);
    const at = landing(wrapper);
    const beside = { x: at.x - 16, y: at.y };

    tap(lineupMark(wrapper), beside);
    tap(lineupMark(wrapper), beside);
    expect(zoomOf(wrapper)).toBe(2);

    await vi.advanceTimersByTimeAsync(600);
    expect(wrapper.emitted("select")).toBeUndefined();
  });

  it("opens a mark once on a double tap that lands on it, and zooms", async () => {
    const wrapper = await mountBoard(true);
    const at = landing(wrapper);

    tap(lineupMark(wrapper), at);
    tap(lineupMark(wrapper), at);
    await vi.advanceTimersByTimeAsync(600);

    expect(wrapper.emitted("select")).toEqual([["l-1"]]);
    expect(zoomOf(wrapper)).toBe(2);
  });

  it("opens a mark on a click of the mouse without waiting, wherever on it", async () => {
    const wrapper = await mountBoard(false);
    const at = landing(wrapper);

    lineupMark(wrapper).dispatchEvent(
      new MouseEvent("click", {
        clientX: at.x - 8,
        clientY: at.y,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(wrapper.emitted("select")).toEqual([["l-1"]]);
  });
});

describe("UtilityRadarBoard taps where a ring and a mark overlap", () => {
  const withRing = { metaSpots: [spot], metaInteractive: true };

  it("draws them closer together than a finger's reach", async () => {
    const wrapper = await mountBoard(true, withRing);
    const apart = Math.hypot(
      ring(wrapper).x - landing(wrapper).x,
      ring(wrapper).y - landing(wrapper).y,
    );

    expect(apart).toBeGreaterThan(8);
    expect(apart).toBeLessThan(22);
  });

  // The lineup's mark is drawn over the ring, so its reach takes the tap.
  it("opens the ring when the tap is on the ring", async () => {
    const wrapper = await mountBoard(true, withRing);

    tap(lineupMark(wrapper), ring(wrapper));
    await vi.advanceTimersByTimeAsync(320);

    expect(wrapper.emitted("select-meta")).toEqual([[spot.key]]);
    expect(wrapper.emitted("select")).toBeUndefined();
  });

  it("opens the lineup when the tap is on the lineup's mark", async () => {
    const wrapper = await mountBoard(true, withRing);

    tap(wrapper.find("g.meta-marker").element, landing(wrapper));
    await vi.advanceTimersByTimeAsync(320);

    expect(wrapper.emitted("select")).toEqual([["l-1"]]);
    expect(wrapper.emitted("select-meta")).toBeUndefined();
  });
});
