import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import GpuShaderCache from "~/components/gpu-nodes/GpuShaderCache.vue";

const { bakeShaders, cancelBake } = vi.hoisted(() => ({
  bakeShaders: vi.fn(),
  cancelBake: vi.fn(),
}));

vi.mock("~/composables/useGpuNodeActions", () => ({
  useGpuNodeActions: () => ({ bakeBusy: {}, bakeShaders, cancelBake }),
}));

afterEach(() => {
  document.body.innerHTML = "";
  bakeShaders.mockReset();
  cancelBake.mockReset();
});

const mountCache = async (
  node: Record<string, unknown>,
  props: Record<string, unknown> = {},
) => {
  const wrapper = await mountSuspended(GpuShaderCache, {
    attachTo: document.body,
    props: {
      node: { id: "gpu-1", label: "gpu-server", ...node },
      bake: null,
      reachable: true,
      ...props,
    } as any,
  });
  await flushPromises();
  return wrapper;
};

const button = (
  wrapper: Awaited<ReturnType<typeof mountCache>>,
  text: string,
) => wrapper.findAll("button").find((entry) => entry.text().includes(text));

describe("GpuShaderCache", () => {
  it("offers a bake inline when the cache was never baked", async () => {
    const wrapper = await mountCache({ shader_bake_status: null });

    expect(wrapper.text()).toContain("Not baked");
    expect(wrapper.text()).toContain("compiles shaders as it goes");
    await button(wrapper, "Bake shaders")!.trigger("click");
    expect(bakeShaders).toHaveBeenCalledWith("gpu-1");
  });

  it("can't bake a node it can't reach", async () => {
    const wrapper = await mountCache(
      { shader_bake_status: null },
      { reachable: false },
    );

    expect(
      button(wrapper, "Bake shaders")!.attributes("disabled"),
    ).toBeDefined();
  });

  it("offers a retry and the log after a failed bake", async () => {
    const wrapper = await mountCache({ shader_bake_status: "errored" });

    expect(wrapper.text()).toContain("Bake failed");
    await button(wrapper, "Open log")!.trigger("click");
    expect(wrapper.emitted("update:logsOpen")).toEqual([[true]]);
    await button(wrapper, "Retry")!.trigger("click");
    expect(bakeShaders).toHaveBeenCalledWith("gpu-1");
  });

  it("says a warm cache is warm and leaves the rebake to the menu", async () => {
    const wrapper = await mountCache({
      shader_bake_status: "done",
      shader_bake_status_history: [
        {
          status: "done",
          at: new Date(Date.now() - 3 * 86400_000).toISOString(),
        },
      ],
    });

    expect(wrapper.text()).toContain("Warm");
    expect(wrapper.text()).toContain("3 days ago");
    expect(button(wrapper, "Bake shaders")).toBeUndefined();

    await wrapper
      .get('button[aria-haspopup="menu"]')
      .trigger("keydown", { key: "Enter" });
    await flushPromises();
    const rebake = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((item) => item.textContent?.trim() === "Bake shaders");
    rebake!.click();
    expect(bakeShaders).toHaveBeenCalledWith("gpu-1");
  });

  it("gives no time for a failure the history never recorded", async () => {
    const wrapper = await mountCache({
      shader_bake_status: "errored",
      shader_bake_status_history: [
        {
          status: "done",
          at: new Date(Date.now() - 3 * 86400_000).toISOString(),
        },
      ],
    });

    expect(wrapper.text()).toContain("Bake failed");
    expect(wrapper.text()).not.toContain("days ago");
  });

  it("shows a running bake's progress and shader count", async () => {
    const wrapper = await mountCache(
      { shader_bake_status: "baking" },
      {
        bake: {
          kind: "bake",
          booting: false,
          progress: 42.4,
          progressStage: "(26824 / 731082)",
        },
      },
    );

    expect(wrapper.text()).toContain("Baking shaders");
    expect(wrapper.text()).toContain("42%");
    expect(wrapper.text()).toContain("26,824 / 731,082");
    expect(button(wrapper, "Watch log")).toBeDefined();
    expect(wrapper.find(".gsn-meter").exists()).toBe(true);
  });
});
