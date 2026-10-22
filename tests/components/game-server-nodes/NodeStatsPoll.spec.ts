import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import NodeStatsPoll from "~/components/game-server-nodes/NodeStatsPoll.vue";
import { SLIM_GPU_QUERY } from "~/components/game-server-nodes/nodeStatsQuery";

describe("NodeStatsPoll", () => {
  it("polls a GPU node for its GPU load", async () => {
    const query = vi.fn(async () => ({ data: { getNodeStats: { gpu: [] } } }));
    const wrapper = mount(NodeStatsPoll, {
      props: { nodeId: "node", gpu: true },
      global: { mocks: { $apollo: { query } } },
    });

    await vi.waitFor(() => expect(wrapper.emitted("stats")).toBeTruthy());
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: SLIM_GPU_QUERY,
        variables: { node: "node" },
      }),
    );
    wrapper.unmount();
  });
});
