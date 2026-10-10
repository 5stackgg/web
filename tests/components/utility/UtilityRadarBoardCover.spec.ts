import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import metadata from "~/public/radars/metadata.json";
import type { UtilityLineup } from "~/types/utility";

// Thrown from the middle of the map to low down on it: the landing is in the
// bottom fifth of the radar, where a phone's sheet lies over the board.
const lineup = {
  id: "l-1",
  name: "Low smoke",
  map_name: "de_mirage",
  utility_type: "Smoke",
  side: "T",
  origin_x: -1200,
  origin_y: -1300,
  origin_z: -160,
  land_x: -800,
  land_y: -2700,
  land_z: -160,
} as unknown as UtilityLineup;

// Nothing is laid out here, so the board is given the box a phone gives it:
// a 400px square starting 100px down the window.
const FRAME = { left: 0, top: 100, width: 400, height: 400 };
const BOTTOM = FRAME.top + FRAME.height;
const NONE = { top: 0, right: 0, bottom: 0, left: 0 };
// A sheet whose top edge is 100px up the board.
const SHEET = { ...NONE, bottom: 100 };
const SHEET_TOP = BOTTOM - SHEET.bottom;

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;
type Board = {
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  showSelected: () => void;
};

const mounted: Wrapper[] = [];

// Animation frames the board has asked for, run by hand.
let frames: FrameRequestCallback[] = [];

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

async function mountBoard(props: Record<string, unknown> = {}) {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => {
    frames.push(run);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = [];
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private report: ResizeObserverCallback) {}
      observe(target: Element) {
        const box = [{ inlineSize: FRAME.width, blockSize: FRAME.height }];
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
        matches: query.includes("coarse"),
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
  frame(wrapper).getBoundingClientRect = () =>
    ({
      ...FRAME,
      right: FRAME.left + FRAME.width,
      bottom: BOTTOM,
      x: FRAME.left,
      y: FRAME.top,
    }) as DOMRect;
  await flushPromises();
  await wrapper.vm.$nextTick();
  return wrapper;
}

const frame = (wrapper: Wrapper) =>
  wrapper.find(".aspect-square").element as HTMLElement;
const layer = (wrapper: Wrapper) =>
  wrapper.find("[data-board-layer]").element as HTMLElement;
const board = (wrapper: Wrapper) => wrapper.vm as unknown as Board;

// Where the map is drawn in the window: the square the layer is laid out at,
// moved and scaled by its transform.
function drawn(wrapper: Wrapper) {
  const style = layer(wrapper).style;
  const move = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(style.transform)!;
  const scale =
    (Number(/scale\(([\d.]+)\)/.exec(style.transform)![1]) *
      parseFloat(style.width)) /
    100;
  const centreX = FRAME.left + FRAME.width / 2 + Number(move[1]);
  const centreY = FRAME.top + FRAME.height / 2 + Number(move[2]);
  return {
    left: centreX - (FRAME.width * scale) / 2,
    right: centreX + (FRAME.width * scale) / 2,
    top: centreY - (FRAME.height * scale) / 2,
    bottom: centreY + (FRAME.height * scale) / 2,
  };
}

// Where the lineup's two ends are in the window. The first hit disc is where
// it lands, the second where it is thrown from.
function ends(wrapper: Wrapper) {
  const map = drawn(wrapper);
  const at = (mark: Element) => ({
    x:
      map.left +
      (Number(mark.getAttribute("cx")) / 1024) * (map.right - map.left),
    y:
      map.top +
      (Number(mark.getAttribute("cy")) / 1024) * (map.bottom - map.top),
  });
  const [landing, stance] = Array.from(
    frame(wrapper).querySelectorAll("[data-mark-hit]"),
  ).map(at);
  return { stance, landing };
}

let clock = 0;

function finger(
  wrapper: Wrapper,
  type: string,
  x: number,
  y: number,
  pointerType = "touch",
) {
  clock += 16;
  const event = new PointerEvent(type, {
    pointerId: 1,
    pointerType,
    isPrimary: true,
    clientX: x,
    clientY: y,
    button: 0,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "timeStamp", { value: clock });
  frame(wrapper).dispatchEvent(event);
}

// One finger down at `from`, across to `to` in steps, and up -- slowly
// enough at the end that nothing is thrown.
async function drag(
  wrapper: Wrapper,
  from: { x: number; y: number },
  to: { x: number; y: number },
  pointerType = "touch",
) {
  finger(wrapper, "pointerdown", from.x, from.y, pointerType);
  for (let step = 1; step <= 4; step++) {
    finger(
      wrapper,
      "pointermove",
      from.x + ((to.x - from.x) * step) / 4,
      from.y + ((to.y - from.y) * step) / 4,
      pointerType,
    );
  }
  clock += 400;
  finger(wrapper, "pointerup", to.x, to.y, pointerType);
  await flushPromises();
}

async function runFrames() {
  let now = 1000;
  for (let guard = 0; frames.length && guard < 400; guard++) {
    const run = frames.shift()!;
    now += 16;
    run(now);
  }
  await flushPromises();
}

describe("UtilityRadarBoard under a sheet", () => {
  it("moves up under one finger at 1x until its bottom edge meets the sheet", async () => {
    const wrapper = await mountBoard({ cover: SHEET });
    expect(drawn(wrapper).bottom).toBe(BOTTOM);

    await drag(wrapper, { x: 200, y: 300 }, { x: 200, y: 240 });
    expect(board(wrapper).zoom).toBe(1);
    expect(drawn(wrapper).bottom).toBe(BOTTOM - 60);

    await drag(wrapper, { x: 200, y: 300 }, { x: 200, y: 20 });
    expect(drawn(wrapper).bottom).toBe(SHEET_TOP);
    expect(drawn(wrapper).left).toBe(FRAME.left);
  });

  it("comes back down no further than where it started", async () => {
    const wrapper = await mountBoard({ cover: SHEET });
    await drag(wrapper, { x: 200, y: 300 }, { x: 200, y: 20 });

    await drag(wrapper, { x: 200, y: 150 }, { x: 260, y: 480 });

    expect(drawn(wrapper)).toEqual({
      left: FRAME.left,
      right: FRAME.left + FRAME.width,
      top: FRAME.top,
      bottom: BOTTOM,
    });
  });

  it("does not move at 1x with nothing over it", async () => {
    const wrapper = await mountBoard();

    await drag(wrapper, { x: 200, y: 300 }, { x: 140, y: 120 });

    expect(drawn(wrapper).top).toBe(FRAME.top);
    expect(drawn(wrapper).bottom).toBe(BOTTOM);
    expect(drawn(wrapper).left).toBe(FRAME.left);
  });

  it("stops at the sheet's top edge at any zoom", async () => {
    const wrapper = await mountBoard({ cover: SHEET });
    board(wrapper).zoomIn();
    board(wrapper).zoomIn();
    await flushPromises();
    expect(board(wrapper).zoom).toBeGreaterThan(1.9);

    await drag(wrapper, { x: 200, y: 450 }, { x: 200, y: -900 });
    expect(drawn(wrapper).bottom).toBeCloseTo(SHEET_TOP);

    board(wrapper).zoomOut();
    board(wrapper).zoomOut();
    await flushPromises();
    expect(board(wrapper).zoom).toBe(1);
    expect(drawn(wrapper).bottom).toBeGreaterThanOrEqual(SHEET_TOP);
    expect(drawn(wrapper).top).toBeLessThanOrEqual(FRAME.top);
  });

  it("is let further up as the sheet rises, and brought back as it falls", async () => {
    const wrapper = await mountBoard({ cover: SHEET });
    await drag(wrapper, { x: 200, y: 300 }, { x: 200, y: 20 });
    expect(drawn(wrapper).bottom).toBe(BOTTOM - 100);

    await wrapper.setProps({ cover: { ...NONE, bottom: 160 } });
    await flushPromises();
    expect(drawn(wrapper).bottom).toBe(BOTTOM - 100);
    await drag(wrapper, { x: 200, y: 300 }, { x: 200, y: 20 });
    expect(drawn(wrapper).bottom).toBe(BOTTOM - 160);

    await wrapper.setProps({ cover: { ...NONE, bottom: 40 } });
    await flushPromises();
    expect(drawn(wrapper).bottom).toBe(BOTTOM - 40);
    // Eased there, not jumped.
    expect(layer(wrapper).style.transition).toContain("transform 260ms");

    await wrapper.setProps({ cover: NONE });
    await flushPromises();
    expect(drawn(wrapper).bottom).toBe(BOTTOM);
  });

  it("stops a fling at the limit", async () => {
    const wrapper = await mountBoard({ cover: SHEET });

    finger(wrapper, "pointerdown", 200, 300);
    finger(wrapper, "pointermove", 200, 280);
    finger(wrapper, "pointermove", 200, 260);
    finger(wrapper, "pointerup", 200, 260);
    await flushPromises();
    expect(drawn(wrapper).bottom).toBe(BOTTOM - 40);
    expect(frames.length).toBe(1);

    await runFrames();

    expect(drawn(wrapper).bottom).toBe(SHEET_TOP);
    expect(frames.length).toBe(0);
  });

  it("brings a lineup that is picked out from under the sheet", async () => {
    const wrapper = await mountBoard({ cover: SHEET });
    expect(ends(wrapper).landing.y).toBeGreaterThan(SHEET_TOP);

    await wrapper.setProps({ selectedId: "l-1" });
    await flushPromises();

    const { stance, landing } = ends(wrapper);
    expect(board(wrapper).zoom).toBe(1);
    expect(landing.y).toBeLessThanOrEqual(SHEET_TOP - 20);
    expect(landing.y).toBeGreaterThan(FRAME.top);
    expect(stance.y).toBeGreaterThan(FRAME.top);
    expect(layer(wrapper).style.transition).toContain("transform 260ms");
  });

  it("does so again when asked, and not just because the cover changed", async () => {
    const wrapper = await mountBoard({ selectedId: "l-1" });
    expect(drawn(wrapper).bottom).toBe(BOTTOM);

    await wrapper.setProps({ cover: SHEET });
    await flushPromises();
    expect(drawn(wrapper).bottom).toBe(BOTTOM);
    expect(ends(wrapper).landing.y).toBeGreaterThan(SHEET_TOP);

    board(wrapper).showSelected();
    await flushPromises();
    expect(ends(wrapper).landing.y).toBeLessThanOrEqual(SHEET_TOP - 20);
  });

  it("leaves a lineup that is already in sight where it is", async () => {
    const wrapper = await mountBoard({ cover: { ...NONE, bottom: 20 } });

    await wrapper.setProps({ selectedId: "l-1" });
    await flushPromises();

    expect(drawn(wrapper).bottom).toBe(BOTTOM);
  });

  it("has nowhere to bring it while the sheet covers the whole map", async () => {
    const wrapper = await mountBoard({ cover: { ...NONE, bottom: 400 } });

    await wrapper.setProps({ selectedId: "l-1" });
    await flushPromises();

    expect(drawn(wrapper).bottom).toBe(BOTTOM);
  });

  it("never moves the map out from under a finger, and settles it once that lifts", async () => {
    const wrapper = await mountBoard({ cover: SHEET });
    await drag(wrapper, { x: 200, y: 300 }, { x: 200, y: 20 });

    finger(wrapper, "pointerdown", 200, 200);
    await wrapper.setProps({ cover: NONE, selectedId: "l-1" });
    await flushPromises();
    expect(drawn(wrapper).bottom).toBe(SHEET_TOP);

    clock += 400;
    finger(wrapper, "pointerup", 200, 200);
    await flushPromises();
    expect(drawn(wrapper).bottom).toBe(BOTTOM);
  });
});

describe("UtilityRadarBoard with nothing over it", () => {
  it("still does not move under a mouse at 1x, and still takes the click", async () => {
    const wrapper = await mountBoard();
    const mark = wrapper.find("g[data-peek-line]").element;

    await drag(wrapper, { x: 200, y: 300 }, { x: 150, y: 200 }, "mouse");
    mark.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    expect(drawn(wrapper).top).toBe(FRAME.top);
    expect(drawn(wrapper).left).toBe(FRAME.left);
    expect(frame(wrapper).className).not.toContain("cursor-grab");
    expect(wrapper.emitted("select")).toEqual([["l-1"]]);
  });

  it("still pans under a mouse once zoomed, to the edges of the frame", async () => {
    const wrapper = await mountBoard();
    board(wrapper).zoomIn();
    board(wrapper).zoomIn();
    await flushPromises();
    const zoom = board(wrapper).zoom;

    await drag(wrapper, { x: 200, y: 300 }, { x: 200, y: -900 }, "mouse");

    expect(drawn(wrapper).bottom).toBeCloseTo(BOTTOM);
    expect(drawn(wrapper).top).toBeCloseTo(BOTTOM - FRAME.height * zoom);
    expect(frame(wrapper).className).toContain("cursor-grab");
  });

  it("leaves a mouse at 1x to its click even under a sheet", async () => {
    const wrapper = await mountBoard({ cover: SHEET });
    const mark = wrapper.find("g[data-peek-line]").element;

    await drag(wrapper, { x: 200, y: 300 }, { x: 200, y: 200 }, "mouse");
    mark.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    expect(drawn(wrapper).bottom).toBe(BOTTOM);
    expect(wrapper.emitted("select")).toEqual([["l-1"]]);
  });

  it("ignores a cover on a board that does not take the finger", async () => {
    const wrapper = await mountBoard({ touch: false, cover: SHEET });

    await drag(wrapper, { x: 200, y: 300 }, { x: 200, y: 20 });
    await wrapper.setProps({ selectedId: "l-1" });
    await flushPromises();

    expect(drawn(wrapper).bottom).toBe(BOTTOM);
    expect(frame(wrapper).className).not.toContain("touch-none");
    expect(frame(wrapper).className).not.toContain("cursor-grab");
  });
});
