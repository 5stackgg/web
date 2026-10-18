import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import InspectorLive from "~/components/game-server-nodes/InspectorLive.vue";

const NOW = Date.now();
const GB = 1024 ** 3;
// Ten samples, 30s apart, ending now. The newest differs from the rest so a
// crosshair reading an older one shows.
const times = Array.from({ length: 10 }, (_, k) =>
  new Date(NOW - k * 30_000).toISOString(),
);

const stats = {
  cpu: times.map((time, k) => ({ time, total: 8, used: k ? 4e9 : 6e9 })),
  memory: times.map((time) => ({ time, total: 32 * GB, used: 16 * GB })),
  network: times.map((time) => ({ time, nics: [{ rx: 125_000, tx: 0 }] })),
  gpu: times.map((time, k) => ({
    time,
    devices: [
      {
        utilization_percent: 40,
        memory_mb: 8192,
        memory_used_mb: k ? 4096 : 2048,
      },
    ],
  })),
};

const mountLive = (gpu: boolean) =>
  mountSuspended(InspectorLive, {
    props: {
      node: { id: "node-1", status: "Online", enabled: true, gpu },
      stats,
      range: "live",
    } as any,
  });

describe("InspectorLive tiles", () => {
  it("adds VRAM on a GPU node and draws the max on every percent tile", async () => {
    const wrapper = await mountLive(true);
    const tiles = wrapper.findAll(".gsn-tiles > div");

    expect(tiles).toHaveLength(5);
    expect(tiles[3].text()).toContain("VRAM");
    expect(tiles[3].text()).toContain("of 8.0 GB");
    expect(tiles[3].text()).toContain("25%");
    expect(tiles.map((tile) => tile.find(".gsn-spark-max").exists())).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(tiles[4].attributes("data-wide")).toBe("true");
  });

  it("leaves VRAM off a node without a GPU", async () => {
    const wrapper = await mountLive(false);

    expect(wrapper.findAll(".gsn-tiles > div")).toHaveLength(3);
    expect(wrapper.text()).not.toContain("VRAM");
  });

  it("shares one crosshair across the tiles and reads that moment", async () => {
    const wrapper = await mountLive(true);
    const tiles = () => wrapper.findAll(".gsn-tiles > div");
    const spark = tiles()[3].get(".gsn-spark");
    (spark.element as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, width: 200 }) as DOMRect;

    // Halfway back through the ten minutes: the oldest sample is nearest.
    await spark.trigger("pointermove", { clientX: 100 });

    expect(wrapper.findAll(".gsn-spark-cross")).toHaveLength(5);
    expect(tiles()[0].text()).toContain("50%");
    expect(tiles()[3].text()).toContain("50%");

    await spark.trigger("pointerleave");

    expect(wrapper.find(".gsn-spark-cross").exists()).toBe(false);
    expect(tiles()[0].text()).toContain("75%");
    expect(tiles()[3].text()).toContain("25%");
  });
});
