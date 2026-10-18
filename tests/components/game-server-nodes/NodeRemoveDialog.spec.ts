import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import NodeRemoveDialog from "~/components/game-server-nodes/NodeRemoveDialog.vue";

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { mutate } }),
}));

const deletes = () =>
  mutate.mock.calls.filter(([options]) =>
    print(options.mutation).includes("delete_game_server_nodes_by_pk"),
  );

const mountDialog = () =>
  mountSuspended(NodeRemoveDialog, {
    attachTo: document.body,
    props: { node: { id: "node-1", label: "Frankfurt 1" }, open: true },
  });

describe("NodeRemoveDialog", () => {
  beforeEach(() => {
    mutate.mockReset().mockResolvedValue({ data: {} });
    document.body.innerHTML = "";
  });

  it("names the node and deletes nothing until confirmed", async () => {
    await mountDialog();
    await flushPromises();

    expect(document.body.textContent).toContain("Frankfurt 1");
    expect(deletes()).toEqual([]);
  });

  it("removes the node once confirmed and then closes", async () => {
    const wrapper = await mountDialog();
    await flushPromises();

    document.body
      .querySelector<HTMLButtonElement>('[data-testid="confirm-remove-node"]')!
      .click();
    await flushPromises();

    expect(deletes()).toHaveLength(1);
    expect(wrapper.emitted("removed")?.[0]).toEqual(["node-1"]);
    expect(wrapper.emitted("update:open")?.[0]).toEqual([false]);
  });
});
