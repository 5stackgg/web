import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import GameRemoveDialog from "~/components/game-server-nodes/GameRemoveDialog.vue";

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { mutate } }),
}));

const removals = () =>
  mutate.mock.calls.filter(([options]) =>
    print(options.mutation).includes("removeCs"),
  );

const mountDialog = (
  game: "cs2" | "csgo",
  node: Record<string, unknown> = {},
) =>
  mountSuspended(GameRemoveDialog, {
    attachTo: document.body,
    props: {
      node: { id: "node-1", label: "Frankfurt 1", ...node },
      game,
      open: true,
    },
  });

const confirm = async () => {
  document.body
    .querySelector<HTMLButtonElement>('[data-testid="confirm-remove-game"]')!
    .click();
  await flushPromises();
};

describe("GameRemoveDialog", () => {
  beforeEach(() => {
    mutate.mockReset().mockResolvedValue({ data: {} });
    document.body.innerHTML = "";
  });

  it("names the game and the node, and removes nothing until confirmed", async () => {
    await mountDialog("csgo");
    await flushPromises();

    expect(document.body.textContent).toContain("Remove CS:GO from this node?");
    expect(document.body.textContent).toContain("Frankfurt 1");
    expect(document.body.textContent).not.toContain("next CS2 update");
    expect(removals()).toEqual([]);
  });

  it("says CS2 comes back with the next CS2 update", async () => {
    await mountDialog("cs2");
    await flushPromises();

    expect(document.body.textContent).toContain("next CS2 update");
  });

  it("doesn't say CS2 comes back on a GPU-only node that doesn't render", async () => {
    await mountDialog("cs2", {
      gpu: true,
      enabled_for_match_making: false,
      gpu_rendering_enabled: false,
    });
    await flushPromises();

    expect(document.body.textContent).toContain("Remove CS2 from this node?");
    expect(document.body.textContent).not.toContain("next CS2 update");
  });

  it("removes the game once confirmed and then closes", async () => {
    const wrapper = await mountDialog("csgo");
    await flushPromises();

    await confirm();

    expect(removals()).toHaveLength(1);
    expect(removals()[0][0].variables).toEqual({
      game_server_node_id: "node-1",
      game: "csgo",
    });
    expect(wrapper.emitted("update:open")?.[0]).toEqual([false]);
  });

  it("stays open when the removal is refused", async () => {
    mutate.mockRejectedValue(new Error("CS2 is in use on node-1: m-1"));
    const wrapper = await mountDialog("cs2");
    await flushPromises();

    await confirm();

    expect(removals()).toHaveLength(1);
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });
});
