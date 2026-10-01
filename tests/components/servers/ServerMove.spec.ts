import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ServerMoveDialog from "~/components/servers/ServerMoveDialog.vue";
import ServerMigrationPanel from "~/components/servers/ServerMigrationPanel.vue";
import type {
  MigratingServer,
  ServerMigrationRow,
  ServerMoveNode,
} from "~/types/serverMigration";

const { toast, moveNodes } = vi.hoisted(() => ({
  toast: vi.fn(),
  moveNodes: { value: [] as Array<ServerMoveNode>, loaded: true },
}));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

vi.mock("~/composables/useServerMigration", async () => {
  const { ref } = await import("vue");
  return {
    useServerMoveNodes: () => ({
      nodes: ref(moveNodes.value),
      loaded: ref(moveNodes.loaded),
    }),
  };
});

const node = (overrides: Partial<ServerMoveNode>): ServerMoveNode => ({
  id: "node-b",
  label: "Node B",
  status: "Online",
  node_ip: "100.64.0.2",
  enabled: true,
  build_id: 100,
  csgo_build_id: null,
  update_status: null,
  region: "EU",
  e_region: { description: "Europe" },
  disk_available_gb: 100,
  available_dedicated_slot_count: 2,
  pin_plugin_runtime: null,
  ...overrides,
});

const server: MigratingServer = {
  id: "server-1",
  game: "cs2",
  region: "EU",
  plugin_runtime: "swiftlys2",
  game_server_node_id: "node-a",
  game_server_node: {
    id: "node-a",
    label: "Node A",
    status: "Online",
    node_ip: "100.64.0.1",
    offline_at: null,
    pin_plugin_runtime: null,
  },
  migrations: [],
};

let mutate: ReturnType<typeof vi.fn>;
let unmount: (() => void) | null = null;

afterEach(() => {
  moveNodes.loaded = true;
  unmount?.();
  unmount = null;
  vi.restoreAllMocks();
  toast.mockReset();
});

async function mount(component: any, props: Record<string, unknown>) {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  mutate = vi.fn().mockResolvedValue({ data: {} });
  vi.spyOn(client, "mutate").mockImplementation(mutate);

  const wrapper = await mountSuspended(component, {
    props,
    attachTo: document.body,
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

const radios = () =>
  Array.from(
    document.body.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
  );

const buttonNamed = (name: string) =>
  Array.from(document.body.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === name,
  );

describe("ServerMoveDialog", () => {
  it("greys out the nodes a server cannot move to and says why", async () => {
    moveNodes.value = [
      node({ id: "node-a", label: "Node A" }),
      node({ id: "node-b", label: "Node B" }),
      node({ id: "node-c", label: "Node C", available_dedicated_slot_count: 0 }),
    ];

    await mount(ServerMoveDialog, {
      open: true,
      server,
      serverLabel: "Community",
      sourceReachable: true,
    });

    const [first, ...rest] = radios();
    expect(first.textContent).toContain("Node B");
    expect(first.disabled).toBe(false);
    expect(
      rest.map((radio) => [radio.textContent?.trim(), radio.disabled]),
    ).toEqual([
      [expect.stringContaining("Current node"), true],
      [expect.stringContaining("No free server slots"), true],
    ]);
  });

  it("names why an unreachable node cannot take the server", async () => {
    moveNodes.value = [
      node({ id: "node-b", label: "Node B", node_ip: null }),
      node({ id: "node-c", label: "Node C", status: "Offline" }),
    ];

    await mount(ServerMoveDialog, {
      open: true,
      server,
      serverLabel: "Community",
      sourceReachable: true,
    });

    expect(radios().map((radio) => radio.textContent?.trim())).toEqual([
      expect.stringContaining("Unreachable"),
      expect.stringContaining("Offline"),
    ]);
  });

  it("says it is loading rather than that there are no nodes", async () => {
    moveNodes.value = [];
    moveNodes.loaded = false;

    await mount(ServerMoveDialog, {
      open: true,
      server,
      serverLabel: "Community",
      sourceReachable: true,
    });

    expect(document.body.textContent).toContain("Loading...");
    expect(document.body.textContent).not.toContain(
      "There are no other game server nodes",
    );
  });

  it("moves the server to the chosen node with its files", async () => {
    moveNodes.value = [node({ id: "node-b" })];

    const wrapper = await mount(ServerMoveDialog, {
      open: true,
      server,
      serverLabel: "Community",
      sourceReachable: true,
    });

    expect(buttonNamed("Move Server")!.disabled).toBe(true);

    radios()[0].click();
    await flushPromises();
    buttonNamed("Move Server")!.click();
    await flushPromises();

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0].variables).toEqual({
      server_id: "server-1",
      game_server_node_id: "node-b",
      without_files: false,
    });
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("only moves off an offline node once told to leave the files behind", async () => {
    moveNodes.value = [node({ id: "node-b" })];

    await mount(ServerMoveDialog, {
      open: true,
      server,
      serverLabel: "Community",
      sourceReachable: false,
    });

    radios()[0].click();
    await flushPromises();
    expect(buttonNamed("Move Server")!.disabled).toBe(true);

    document.body.querySelector<HTMLButtonElement>('[role="checkbox"]')!.click();
    await flushPromises();
    buttonNamed("Move Server")!.click();
    await flushPromises();

    expect(mutate.mock.calls[0][0].variables).toMatchObject({
      without_files: true,
    });
  });

  it("keeps the dialog open and reports why the api refused", async () => {
    moveNodes.value = [node({ id: "node-b" })];

    const wrapper = await mount(ServerMoveDialog, {
      open: true,
      server,
      serverLabel: "Community",
      sourceReachable: true,
    });
    mutate.mockRejectedValue({
      graphQLErrors: [{ message: "Node B has no free server slots" }],
    });

    radios()[0].click();
    await flushPromises();
    buttonNamed("Move Server")!.click();
    await flushPromises();

    expect(wrapper.emitted("update:open")).toBeUndefined();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: "Node B has no free server slots",
      }),
    );
  });
});

describe("ServerMigrationPanel", () => {
  const migration = (
    overrides: Partial<ServerMigrationRow>,
  ): ServerMigrationRow => ({
    id: "migration-1",
    status: "Transferring",
    with_files: true,
    bytes_total: 1000,
    bytes_done: 500,
    error: null,
    warnings: [],
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    finished_at: null,
    from_game_server_node: { id: "node-a", label: "Node A" },
    to_game_server_node: { id: "node-b", label: "Node B" },
    ...overrides,
  });

  it("shows how much has been copied and lets the move be canceled", async () => {
    const wrapper = await mount(ServerMigrationPanel, {
      serverId: "server-1",
      migration: migration({}),
    });

    expect(wrapper.text()).toContain("Moving to Node B");
    expect(wrapper.text()).toContain("(50%)");

    buttonNamed("Cancel Move")!.click();
    await flushPromises();

    expect(mutate.mock.calls[0][0].variables).toEqual({
      server_id: "server-1",
    });
  });

  it("shows no copy progress for a server with no files", async () => {
    const wrapper = await mount(ServerMigrationPanel, {
      serverId: "server-1",
      migration: migration({ bytes_total: "0", bytes_done: "0" }),
    });

    expect(wrapper.text()).not.toContain("0 B of 0 B");
  });

  it("reads the byte counts Hasura sends as strings", async () => {
    const wrapper = await mount(ServerMigrationPanel, {
      serverId: "server-1",
      migration: migration({ bytes_total: "1000", bytes_done: "250" }),
    });

    expect(wrapper.text()).toContain("(25%)");
  });

  it("never claims the copy is done before the server has switched", async () => {
    const wrapper = await mount(ServerMigrationPanel, {
      serverId: "server-1",
      migration: migration({ bytes_done: 1200 }),
    });

    expect(wrapper.text()).toContain("(99%)");
  });

  it("explains a failed move and that the server is back where it was", async () => {
    const wrapper = await mount(ServerMigrationPanel, {
      serverId: "server-1",
      migration: migration({
        status: "Failed",
        error: "The transfer stalled",
        finished_at: new Date().toISOString(),
      }),
    });

    expect(wrapper.text()).toContain("Move to Node B failed");
    expect(wrapper.text()).toContain("The transfer stalled");
    expect(wrapper.text()).toContain("The server is back on Node A.");
    expect(buttonNamed("Cancel Move")).toBeUndefined();

    document.body
      .querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')!
      .click();
    expect(wrapper.emitted("dismiss")).toHaveLength(1);
  });
});
