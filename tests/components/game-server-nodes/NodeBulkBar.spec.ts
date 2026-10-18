import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import NodeBulkBar from "~/components/game-server-nodes/NodeBulkBar.vue";

const { mutate, toastMock } = vi.hoisted(() => ({
  mutate: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { mutate } }),
}));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  toast: toastMock,
}));

const node = (id: string, fields: Record<string, unknown> = {}) => ({
  id,
  status: "Online",
  enabled: true,
  enabled_for_match_making: true,
  build_id: 100,
  ...fields,
});

const mountBar = (nodes: Array<Record<string, unknown>>) =>
  mountSuspended(NodeBulkBar, {
    props: { nodes: nodes as any, regions: [], currentBuildId: 120 },
  });

// Matches the label or, before the locale merge, the key it falls back to.
const button = (wrapper: Awaited<ReturnType<typeof mountBar>>, label: string) =>
  wrapper
    .findAll("button")
    .find((item) => item.text().toLowerCase().includes(label.toLowerCase()))!;

const sent = () =>
  mutate.mock.calls.map(([options]) => print(options.mutation));

describe("NodeBulkBar", () => {
  beforeEach(() => {
    toastMock.mockReset();
    mutate.mockReset().mockResolvedValue({ data: {} });
  });

  it("enables only the selected nodes that are off, one mutation each", async () => {
    const wrapper = await mountBar([
      node("a", { enabled: false }),
      node("b", { enabled: false }),
      node("c"),
    ]);

    await button(wrapper, "enable").trigger("click");
    await flushPromises();

    expect(sent()).toHaveLength(2);
    expect(sent().every((query) => query.includes("enabled: true"))).toBe(true);
    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it("updates CS2 where there is something to update and counts the failures", async () => {
    mutate
      .mockResolvedValueOnce({ data: {} })
      .mockRejectedValueOnce(new Error("offline"));
    const wrapper = await mountBar([
      node("a"),
      node("b"),
      node("c", { build_id: 120 }),
      node("d", { status: "Offline" }),
    ]);

    await button(wrapper, "Update CS2").trigger("click");
    await flushPromises();

    expect(sent()).toHaveLength(2);
    expect(sent()[0]).toContain("updateCs");
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  it("offers nothing to update when every node is current", async () => {
    const wrapper = await mountBar([node("a", { build_id: 120 })]);

    expect(button(wrapper, "Update CS2").attributes("disabled")).toBeDefined();
  });
});
