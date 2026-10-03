import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import DemoSeekBar from "~/components/match/DemoSeekBar.vue";
import { useDemoPlaybackStore } from "~/stores/DemoPlaybackStore";
import socket from "~/web-sockets/Socket";

// 100s at 64 tick; round 2 starts halfway along a 1000px track.
const TOTAL = 6_400;
const ROUND_2 = 3_200;
const TRACK_PX = 1_000;

let unmount: (() => void) | undefined;
let events: ReturnType<typeof vi.spyOn>;

function seekTicks(): number[] {
  return events.mock.calls
    .filter(
      ([name, data]) =>
        name === "demo-session:control" && (data as any).action === "seek",
    )
    .map(([, data]) => (data as any).payload.tick);
}

async function mountBar() {
  const wrapper = await mountSuspended(DemoSeekBar);
  unmount = () => wrapper.unmount();
  const track = wrapper.get('[role="slider"]').element as HTMLElement;
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: TRACK_PX, height: 24 }) as DOMRect;
  return { wrapper, track };
}

function pointer(track: HTMLElement, type: string, clientX: number) {
  track.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX,
      pointerId: 1,
      pointerType: "mouse",
    }),
  );
}

beforeEach(() => {
  events = vi.spyOn(socket, "event").mockImplementation(() => {});
  const store = useDemoPlaybackStore();
  store.reset();
  store.matchMapId = "map-1";
  store.totalTicks = TOTAL;
  store.tickRate = 64;
  store.roundTicks = [
    { round: 1, start_tick: 0, end_tick: ROUND_2 - 100 },
    { round: 2, start_tick: ROUND_2, end_tick: TOTAL },
  ];
  // Parked mid-demo so the estimate is stable.
  store.syncFromControl({ tick: 1_600, paused: true });
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.restoreAllMocks();
});

describe("DemoSeekBar", () => {
  it("paints the playhead and clock straight to the DOM", async () => {
    const { wrapper } = await mountBar();

    expect(wrapper.text()).toContain("0:25");
    expect(wrapper.text()).toContain("1:40");
    const fill = wrapper.get(".origin-left").element as HTMLElement;
    expect(fill.style.transform).toBe("scaleX(0.25)");
  });

  it("lands a click next to a round marker on the round start", async () => {
    const { track } = await mountBar();

    pointer(track, "pointerdown", 504);
    pointer(track, "pointerup", 504);

    expect(seekTicks()).toEqual([ROUND_2]);
  });

  it("seeks to where a drag is released, without snapping", async () => {
    const { track } = await mountBar();

    pointer(track, "pointerdown", 100);
    pointer(track, "pointermove", 503);
    pointer(track, "pointerup", 503);

    expect(seekTicks()).toEqual([Math.round(0.503 * TOTAL)]);
  });
});
