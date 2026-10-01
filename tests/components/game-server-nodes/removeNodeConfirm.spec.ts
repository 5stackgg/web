import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print, type DocumentNode } from "graphql";
import GameServerNodeRow from "~/components/game-server-nodes/GameServerNodeRow.vue";

const node = {
  id: "node-a",
  label: "EU West",
  status: "Offline",
  region: "eu-west",
  enabled: true,
  start_port_range: 30000,
  end_port_range: 30100,
  total_server_count: 0,
  available_server_count: 0,
};

let mutate: ReturnType<typeof vi.fn>;
let unmount: (() => void) | undefined;

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  vi.restoreAllMocks();
  await flushPromises();
});

async function mountRow() {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  vi.spyOn(client, "subscribe").mockImplementation(() => ({
    subscribe: () => ({ unsubscribe() {}, closed: false }),
  }));
  mutate = vi.fn(async () => ({ data: {} }));
  vi.spyOn(client, "mutate").mockImplementation(mutate);

  const wrapper = await mountSuspended(GameServerNodeRow, {
    props: { gameServerNode: node },
    attachTo: document.body,
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
      stubs: {
        NodeControlMenu: true,
        NodeMetrics: true,
        ServiceLogs: true,
        UpdateGameServerLabel: true,
        EditCs2Options: true,
      },
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountRow>>;

const dialog = () =>
  document.body.querySelector<HTMLElement>('[role="alertdialog"]');

function button(root: ParentNode | null | undefined, label: string) {
  return Array.from(
    root?.querySelectorAll<HTMLElement>("button, [role='menuitem']") ?? [],
  ).find((element) => element.textContent?.trim() === label);
}

// The row renders the same menu twice: first for desktop, then for mobile.
async function chooseRemoveNode(wrapper: Wrapper, menu: number) {
  const triggers = wrapper
    .findAll("button[aria-haspopup='menu']")
    .filter((candidate) =>
      candidate.find(".lucide-ellipsis-vertical").exists(),
    );
  expect(triggers).toHaveLength(2);
  await triggers[menu].trigger("keydown", { key: "Enter" });
  await flushPromises();

  const item = button(document.body, "Remove Node");
  expect(item, "Remove Node menu item").toBeDefined();
  item!.click();
  await flushPromises();
}

describe.each([
  ["desktop", 0],
  ["mobile", 1],
])("game server node removal from the %s menu", (_, menu) => {
  it("asks first and removes nothing when cancelled", async () => {
    const wrapper = await mountRow();

    await chooseRemoveNode(wrapper, menu);

    expect(dialog()?.textContent).toContain("Remove EU West?");
    expect(dialog()?.textContent).toContain(
      "Once Kubernetes has reported it as not ready for 10 minutes",
    );
    expect(mutate).not.toHaveBeenCalled();

    button(dialog(), "Cancel")!.click();
    await flushPromises();

    expect(dialog()).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("deletes the node once confirmed", async () => {
    const wrapper = await mountRow();

    await chooseRemoveNode(wrapper, menu);
    button(dialog(), "Remove Node")!.click();
    await flushPromises();

    expect(dialog()).toBeNull();
    expect(mutate).toHaveBeenCalledTimes(1);
    const sent = print(mutate.mock.calls[0][0].mutation as DocumentNode);
    expect(sent).toContain('delete_game_server_nodes_by_pk(id: "node-a")');
  });
});
