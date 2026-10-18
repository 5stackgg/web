import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import NodeSpark from "~/components/game-server-nodes/NodeSpark.vue";

const T0 = Date.parse("2026-10-17T12:00:00Z");
const S = 30_000;
const at = (i: number) => T0 + i * S;

// The viewBox is 200 x 30: a value at the max sits at y 1, zero at y 29.
const mountSpark = (props: Record<string, unknown>) =>
  mountSuspended(NodeSpark, {
    props: { from: at(0), to: at(4), ...props } as any,
  });

describe("NodeSpark max line", () => {
  it("scales to the max, so a full sample touches the dashed line", async () => {
    const wrapper = await mountSpark({
      points: [
        { t: at(0), v: 50 },
        { t: at(4), v: 100 },
      ],
      max: 100,
      ceiling: true,
    });

    const ceiling = wrapper.get(".gsn-spark-max");
    expect(ceiling.attributes("y1")).toBe("1");
    expect(wrapper.get(".gsn-spark-line").attributes("d")).toBe(
      "M0.0,15.0L200.0,1.0",
    );
  });

  it("keeps a sample over the max on the line rather than off the tile", async () => {
    const wrapper = await mountSpark({
      points: [
        { t: at(0), v: 140 },
        { t: at(4), v: 0 },
      ],
      max: 100,
      ceiling: true,
    });

    expect(wrapper.get(".gsn-spark-line").attributes("d")).toBe(
      "M0.0,1.0L200.0,29.0",
    );
  });

  it("draws no max line unless asked", async () => {
    const wrapper = await mountSpark({ points: [{ t: at(0), v: 5 }] });

    expect(wrapper.find(".gsn-spark-max").exists()).toBe(false);
  });
});

describe("NodeSpark crosshair", () => {
  const points = [
    { t: at(0), v: 0 },
    { t: at(2), v: 50 },
    { t: at(4), v: 100 },
  ];

  it("draws the crosshair and the sample at the time it is given", async () => {
    const wrapper = await mountSpark({ points, crosshair: at(2) });

    expect(wrapper.get(".gsn-spark-cross").attributes("style")).toContain(
      "left: 50%",
    );
    const dot = wrapper.get(".gsn-spark-dot").attributes("style");
    expect(dot).toContain("left: 50%");
    expect(dot).toContain("top: 50%");
  });

  it("reports the time under the pointer and clears it on leave", async () => {
    const wrapper = await mountSpark({ points, crosshair: null });
    (wrapper.element as HTMLElement).getBoundingClientRect = () =>
      ({ left: 100, width: 200 }) as DOMRect;

    await wrapper.trigger("pointermove", { clientX: 150 });
    await wrapper.trigger("pointerleave");

    expect(wrapper.emitted("hover")).toEqual([[at(1)], [null]]);
    expect(wrapper.find(".gsn-spark-cross").exists()).toBe(false);
  });

  it("stays still where no crosshair is wanted", async () => {
    const wrapper = await mountSpark({ points });
    (wrapper.element as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, width: 200 }) as DOMRect;

    await wrapper.trigger("pointermove", { clientX: 50 });

    expect(wrapper.emitted("hover")).toBeUndefined();
  });
});
