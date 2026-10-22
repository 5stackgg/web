import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import GpuNodePanel from "~/components/gpu-nodes/GpuNodePanel.vue";
import GpuShaderCache from "~/components/gpu-nodes/GpuShaderCache.vue";

describe("GpuNodePanel", () => {
  it("hands the shader cache's log request up to the page", async () => {
    const wrapper = await mountSuspended(GpuNodePanel, {
      shallow: true,
      props: {
        node: { id: "gpu-1", enabled: true, status: "Online" },
        session: null,
        bake: null,
        state: null,
        stateLabel: "Idle",
      },
    });

    wrapper.findComponent(GpuShaderCache).vm.$emit("update:logsOpen", true);

    expect(wrapper.emitted("update:logsOpen")).toEqual([[true]]);
  });
});
