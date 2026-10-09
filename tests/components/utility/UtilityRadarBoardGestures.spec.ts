import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import metadata from "~/public/radars/metadata.json";
import type { UtilityLineup } from "~/types/utility";

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
  preview_stills_url: { aim: "https://cdn.test/aim.jpg" },
} as unknown as UtilityLineup;

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;

const mounted: Wrapper[] = [];

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: !query.includes("reduced-motion"),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(metadata))),
  );
});

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

async function mountBoard(props: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(UtilityRadarBoard, {
    props: {
      mapName: "de_mirage",
      lineups: [lineup],
      seedSrc: "/radars/de_mirage.png",
      peek: true,
      ...props,
    },
    attachTo: document.body,
  });
  mounted.push(wrapper);
  await flushPromises();
  await wrapper.vm.$nextTick();
  return wrapper;
}

const surface = (wrapper: Wrapper) =>
  wrapper.find(".aspect-square").element as HTMLElement;
const zoomOf = (wrapper: Wrapper) =>
  (wrapper.vm as unknown as { zoom: number }).zoom;

function pointer(
  target: Element,
  type: string,
  id: number,
  x: number,
  y: number,
  pointerType = "touch",
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: id,
      pointerType,
      clientX: x,
      clientY: y,
      button: 0,
      bubbles: true,
    }),
  );
}

function tap(target: Element, x: number, y: number) {
  pointer(target, "pointerdown", 1, x, y);
  pointer(target, "pointerup", 1, x, y);
}

describe("UtilityRadarBoard touch gestures", () => {
  it("takes the gesture from the browser on the map and nowhere else", async () => {
    const wrapper = await mountBoard();
    expect(surface(wrapper).classList.contains("touch-none")).toBe(true);

    const still = await mountBoard({ touch: false });
    expect(surface(still).classList.contains("touch-none")).toBe(false);
  });

  it("zooms in on a double tap and leaves a single tap alone", async () => {
    const wrapper = await mountBoard();
    const map = surface(wrapper);

    tap(map, 100, 100);
    expect(zoomOf(wrapper)).toBe(1);

    tap(map, 104, 98);
    expect(zoomOf(wrapper)).toBe(2);
  });

  it("zooms with two fingers, freely, and never selects from a pinch", async () => {
    const wrapper = await mountBoard();
    const map = surface(wrapper);

    pointer(map, "pointerdown", 1, 100, 200);
    pointer(map, "pointerdown", 2, 200, 200);
    pointer(map, "pointermove", 1, 60, 200);
    pointer(map, "pointermove", 2, 247, 200);
    expect(zoomOf(wrapper)).toBeCloseTo(1.87);

    pointer(map, "pointerup", 2, 247, 200);
    pointer(map, "pointerup", 1, 60, 200);
    wrapper.find("g.cursor-pointer").element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(wrapper.emitted("select")).toBeUndefined();
  });

  it("steps back out on a two-finger tap", async () => {
    const wrapper = await mountBoard();
    const map = surface(wrapper);
    tap(map, 100, 100);
    tap(map, 100, 100);
    expect(zoomOf(wrapper)).toBe(2);

    pointer(map, "pointerdown", 1, 100, 200);
    pointer(map, "pointerdown", 2, 200, 200);
    pointer(map, "pointerup", 2, 200, 200);
    pointer(map, "pointerup", 1, 100, 200);
    expect(zoomOf(wrapper)).toBe(1);
  });

  it("zooms with one finger after a double tap that drags", async () => {
    const wrapper = await mountBoard();
    const map = surface(wrapper);

    tap(map, 100, 100);
    pointer(map, "pointerdown", 1, 100, 100);
    pointer(map, "pointermove", 1, 100, 160);
    expect(zoomOf(wrapper)).toBeCloseTo(Math.exp(0.6), 2);
    pointer(map, "pointerup", 1, 100, 160);
    expect(zoomOf(wrapper)).toBeCloseTo(Math.exp(0.6), 2);
  });

  it("still selects the marker a finger taps", async () => {
    const wrapper = await mountBoard();
    const marker = wrapper.find("g.cursor-pointer").element;

    pointer(marker, "pointerdown", 1, 100, 100);
    pointer(marker, "pointerup", 1, 100, 100);
    marker.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    expect(wrapper.emitted("select")).toEqual([["l-1"]]);
  });

  it("never opens the hover peek from a finger", async () => {
    const wrapper = await mountBoard();
    const marker = wrapper.find("g.cursor-pointer").element;

    marker.dispatchEvent(
      new PointerEvent("pointerenter", { pointerType: "touch" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(
      document.querySelector("[data-reka-popper-content-wrapper]"),
    ).toBeNull();
  });
});
