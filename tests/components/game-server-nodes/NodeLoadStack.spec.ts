import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import NodeLoadStack from "~/components/game-server-nodes/NodeLoadStack.vue";

const disk = (percent: number) => ({
  percent,
  freeGb: 100,
  totalGb: 400,
  usedGb: 300,
});

const mountStack = (props: Record<string, unknown>) =>
  mountSuspended(NodeLoadStack, { props });

const has = (wrapper: Awaited<ReturnType<typeof mountStack>>, key: string) =>
  wrapper.find(`[data-line="${key}"]`).exists();

const line = (wrapper: Awaited<ReturnType<typeof mountStack>>, key: string) => {
  const row = wrapper.get(`[data-line="${key}"]`);
  return {
    metric: row.get(".gsn-meter-fill").attributes("data-metric"),
    tone: row.get(".gsn-meter-fill").attributes("data-tone"),
    value: row.get("b"),
  };
};

describe("NodeLoadStack", () => {
  it("colours each meter by its metric and leaves calm values untinted", async () => {
    const wrapper = await mountStack({ cpu: 20, memory: 30, disk: disk(40) });

    expect(line(wrapper, "cpu").metric).toBe("cpu");
    expect(line(wrapper, "memory").metric).toBe("mem");
    expect(line(wrapper, "disk").metric).toBe("disk");
    expect(line(wrapper, "cpu").value.classes()).not.toContain(
      "text-destructive",
    );
  });

  it("tints the value at warn and turns the meter critical at 85%", async () => {
    const wrapper = await mountStack({ cpu: 72, memory: 90 });

    expect(line(wrapper, "cpu").tone).toBe("warn");
    expect(line(wrapper, "cpu").value.classes()).toContain("text-warning");
    expect(line(wrapper, "memory").tone).toBe("bad");
    expect(line(wrapper, "memory").value.classes()).toContain(
      "text-destructive",
    );
  });

  it("reads the disk against the thresholds it is given", async () => {
    const thresholds = { warning: 50, critical: 60 };
    const warn = await mountStack({
      disk: disk(55),
      diskThresholds: thresholds,
    });
    const bad = await mountStack({
      disk: disk(65),
      diskThresholds: thresholds,
    });

    expect(line(warn, "disk").tone).toBe("warn");
    expect(line(bad, "disk").tone).toBe("bad");
  });

  it("takes tone overrides for CPU and memory", async () => {
    const wrapper = await mountStack({
      cpu: 72,
      memory: 5,
      cpuTone: "ok",
      memoryTone: "bad",
    });

    expect(line(wrapper, "cpu").tone).toBe("ok");
    expect(line(wrapper, "memory").tone).toBe("bad");
  });

  it("shows only the disk off live, and a dash with nothing to show", async () => {
    const offline = await mountStack({
      live: false,
      cpu: 50,
      memory: 50,
      disk: disk(40),
    });
    expect(has(offline, "cpu")).toBe(false);
    expect(has(offline, "disk")).toBe(true);

    const empty = await mountStack({ live: false });
    expect(empty.text()).toBe("—");
  });

  it("shows a GPU line only for a live node with a GPU", async () => {
    const withGpu = await mountStack({
      cpu: 20,
      memory: 30,
      hasGpu: true,
      gpu: 90,
      disk: disk(40),
    });
    expect(line(withGpu, "gpu").metric).toBe("gpu");
    expect(line(withGpu, "gpu").tone).toBe("bad");
    expect(line(withGpu, "gpu").value.text()).toBe("90%");
    expect(
      withGpu.findAll("[data-line]").map((row) => row.attributes("data-line")),
    ).toEqual(["cpu", "memory", "gpu", "disk"]);
    expect(withGpu.get(".nls-stack").attributes("data-dense")).toBe("true");

    const noGpu = await mountStack({ cpu: 20, memory: 30, gpu: 90 });
    expect(has(noGpu, "gpu")).toBe(false);
    expect(noGpu.get(".nls-stack").attributes("data-dense")).toBe("false");

    const offline = await mountStack({
      live: false,
      hasGpu: true,
      gpu: 90,
      disk: disk(40),
    });
    expect(has(offline, "gpu")).toBe(false);
  });

  it("shows a decimal under 10% when precise", async () => {
    const wrapper = await mountStack({
      cpu: 4.26,
      memory: 42.4,
      precise: true,
    });

    expect(line(wrapper, "cpu").value.text()).toBe("4.3%");
    expect(line(wrapper, "memory").value.text()).toBe("42%");
  });
});
