import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import GameServerNodeRow from "~/components/game-server-nodes/GameServerNodeRow.vue";

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      mutate: vi.fn(async () => ({ data: {} })),
      query: vi.fn(async () => ({ data: {} })),
    },
  }),
}));

vi.mock("~/components/ui/dropdown-menu", async (importOriginal) => {
  const { defineComponent, h } = await import("vue");
  const passthrough = defineComponent({
    setup: (_, { slots }) => () => h("div", slots.default?.()),
  });
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    DropdownMenu: passthrough,
    DropdownMenuTrigger: passthrough,
    DropdownMenuContent: passthrough,
    DropdownMenuItem: defineComponent({
      setup: (_, { slots }) => () =>
        h("div", { "data-menu-item": "" }, slots.default?.()),
    }),
  };
});

const node = {
  id: "node-1",
  label: "Frankfurt 1",
  status: "Online",
  enabled: true,
  enabled_for_match_making: true,
  gpu: false,
  region: "eu",
  start_port_range: 27015,
  end_port_range: 27025,
  available_server_count: 0,
  total_server_count: 0,
  servers: [],
};

let mutate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  mutate = vi.fn().mockResolvedValue({ data: {} });
  vi.spyOn(client, "mutate").mockImplementation(mutate);
  vi.spyOn(client, "query").mockResolvedValue({ data: {} });
  vi.spyOn(client, "subscribe").mockReturnValue({
    subscribe: () => ({ unsubscribe() {} }),
  } as any);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

async function removeNodeItem() {
  const wrapper = await mountSuspended(GameServerNodeRow, {
    attachTo: document.body,
    props: { gameServerNode: node as any },
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  await flushPromises();
  return wrapper
    .findAll("[data-menu-item]")
    .find((item) => item.text().includes("Remove Node"))!;
}

const deletes = () =>
  mutate.mock.calls.filter(([options]) =>
    print(options.mutation).includes("delete_game_server_nodes_by_pk"),
  );

describe("GameServerNodeRow remove node", () => {
  it("asks before removing a node instead of deleting it on the first click", async () => {
    const item = await removeNodeItem();

    await item.trigger("click");
    await flushPromises();

    expect(deletes()).toEqual([]);
    expect(document.body.textContent).toContain("Remove this node?");
  });

  it("removes the node once the dialog is confirmed", async () => {
    const item = await removeNodeItem();
    await item.trigger("click");
    await flushPromises();

    const confirm = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="confirm-remove-node"]',
    );
    confirm!.click();
    await flushPromises();

    expect(deletes()).toHaveLength(1);
  });
});
