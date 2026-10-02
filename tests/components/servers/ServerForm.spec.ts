import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ServerForm from "~/components/servers/ServerForm.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";

const node = (overrides: Record<string, unknown>) => ({
  label: null,
  region: "us-east",
  status: "Online",
  enabled: true,
  enabled_for_match_making: true,
  gpu: false,
  node_ip: "10.0.0.1",
  public_ip: "203.0.113.10",
  build_id: 100,
  csgo_build_id: null,
  update_status: null,
  start_port_range: 30000,
  end_port_range: 30010,
  disk_available_gb: 120,
  available_dedicated_slot_count: 4,
  e_region: { description: "US East" },
  ...overrides,
});

const lv = { region: "lv", e_region: { description: "LV" } };

const nodes = [
  node({ id: "node-1", label: "Node One" }),
  node({ id: "lv-gs-01", ...lv }),
  node({ id: "lv-gs-02", ...lv, status: "Offline" }),
  // GPU-only: the panel clears its region and ports.
  node({
    id: "lv-gpu-01",
    gpu: true,
    enabled_for_match_making: false,
    region: null,
    e_region: null,
    start_port_range: null,
    end_port_range: null,
    available_dedicated_slot_count: 0,
  }),
];

const modes = [
  {
    id: "6426e1b6-1e09-4f51-95c0-8fd312dc0b82",
    name: "Utility Practice",
    description: null,
    enabled: true,
    supported_runtimes: ["swiftlys2"],
  },
  {
    id: "09e31e82-308b-4193-b970-19c006a83ffc",
    name: "Retakes",
    description: null,
    enabled: true,
    supported_runtimes: ["swiftlys2"],
  },
];

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useApplicationSettingsStore().settings = [];
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

function rootField(query: any): string | undefined {
  return query.definitions[0]?.selectionSet?.selections[0]?.name?.value;
}

async function mount(gameServerNodes = nodes) {
  useApplicationSettingsStore().settings = [
    { name: "public.game_plugins_enabled", value: "false" },
  ];

  const client = (useNuxtApp() as any).$apollo.defaultClient;
  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: any) {
      if (rootField(options.query) === "game_server_nodes") {
        Promise.resolve().then(() =>
          observer.next({ data: { game_server_nodes: gameServerNodes } }),
        );
      }
      return { unsubscribe() {}, closed: false };
    },
  }));

  const wrapper = await mountSuspended(ServerForm, {
    attachTo: document.body,
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
    },
  });
  unmount = () => wrapper.unmount();
  (wrapper.vm as any).gameModes = modes;
  (wrapper.vm as any).server_regions = [
    { value: "us-east", description: "US East" },
    { value: "lv", description: "LV" },
  ];
  await flushPromises();
  return wrapper;
}

const radio = (id: string) =>
  document.body.querySelector<HTMLButtonElement>(`#${id}`)!;

describe("ServerForm server type", () => {
  it("selects a type when its radio button itself is clicked", async () => {
    await mount();

    radio("kind-presets").click();
    await flushPromises();

    expect(radio("kind-presets").getAttribute("data-state")).toBe("checked");
    expect(radio("kind-ranked").getAttribute("data-state")).toBe("unchecked");

    radio("kind-valve").click();
    await flushPromises();

    expect(radio("kind-valve").getAttribute("data-state")).toBe("checked");
  });

  it("starts a new server on a node when one can take it", async () => {
    const wrapper = await mount();

    expect((wrapper.vm as any).form.values.use_game_server_node).toBe(true);
  });

  it("picks the first custom mode when its tile is clicked", async () => {
    const wrapper = await mount();

    radio("kind-presets").closest<HTMLElement>("div.rounded-lg")!.click();
    await flushPromises();

    expect((wrapper.vm as any).form.values.type).toBe(modes[0].id);
  });

  it("offers every custom mode before a node is picked", async () => {
    await mount();

    radio("kind-presets").click();
    await flushPromises();

    const options = Array.from(
      document.body.querySelectorAll('[data-testid="custom-mode-option"]'),
    );
    expect(options.map((option) => option.textContent?.trim())).toEqual(
      modes.map((mode) => mode.name),
    );
    expect(
      options.filter((option) => option.querySelector("button[disabled]")),
    ).toEqual([]);
  });

  it("asks for a region before listing nodes", async () => {
    await mount();

    expect(
      document.body.querySelectorAll('[data-testid="node-option"]'),
    ).toHaveLength(0);
    expect(document.body.textContent).toContain(
      "Pick a region to see its game server nodes.",
    );
  });

  it("shows each region as a tile with the nodes that can take the server", async () => {
    const wrapper = await mount();

    const tiles = Array.from(
      document.body.querySelectorAll<HTMLElement>(
        '[data-testid="region-option"]',
      ),
    );
    // lv-gs-02 is offline and the GPU-only node has no region.
    expect(
      tiles.map((tile) => [
        tile.querySelector("label")?.textContent?.trim(),
        tile.querySelector("span.font-mono")?.textContent?.trim(),
      ]),
    ).toEqual([
      ["US East", "Nodes: 1"],
      ["LV", "Nodes: 1"],
    ]);

    radio("region-lv").click();
    await flushPromises();

    expect((wrapper.vm as any).form.values.region).toBe("lv");
    expect(
      document.body.querySelectorAll('[data-testid="node-option"]'),
    ).toHaveLength(2);
  });

  it("lists only the region's nodes, named by id when unlabeled", async () => {
    const wrapper = await mount();

    (wrapper.vm as any).form.setFieldValue("region", "lv");
    await flushPromises();

    const rows = Array.from(
      document.body.querySelectorAll<HTMLElement>(
        '[data-testid="node-option"]',
      ),
    );
    // The GPU-only node has no region, so no region lists it.
    expect(
      rows.map((row) => row.querySelector("label")?.textContent?.trim()),
    ).toEqual(["lv-gs-01", "lv-gs-02"]);
    expect(rows[1].textContent).toContain("Offline");
    expect(radio("node-lv-gs-02").disabled).toBe(true);
  });

  it("drops a picked node when the region changes", async () => {
    const wrapper = await mount();
    const form = (wrapper.vm as any).form;

    form.setFieldValue("region", "lv");
    await flushPromises();
    form.setFieldValue("game_server_node_id", "lv-gs-01");
    await flushPromises();
    form.setFieldValue("region", "us-east");
    await flushPromises();

    expect(form.values.game_server_node_id).toBe("");
  });

  it("searches a region with many nodes", async () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      node({ id: `lv-gs-${String(i + 1).padStart(2, "0")}`, ...lv }),
    );
    const wrapper = await mount(many);

    (wrapper.vm as any).form.setFieldValue("region", "lv");
    await flushPromises();
    (wrapper.vm as any).nodeSearch = "07";
    await flushPromises();

    const rows = Array.from(
      document.body.querySelectorAll<HTMLElement>(
        '[data-testid="node-option"]',
      ),
    );
    expect(
      rows.map((row) => row.querySelector("label")?.textContent?.trim()),
    ).toEqual(["lv-gs-07"]);
  });

  it("suggests a label from the region and mode until one is typed", async () => {
    const wrapper = await mount();
    const form = (wrapper.vm as any).form;

    form.setFieldValue("region", "lv");
    await flushPromises();
    expect(form.values.label).toBe("LV Ranked Server");

    const label = document.body.querySelector<HTMLInputElement>(
      'input[data-1p-ignore]:not([type="password"])',
    )!;
    label.value = "Vegas 3";
    label.dispatchEvent(new Event("input", { bubbles: true }));
    radio("kind-practice").click();
    await flushPromises();

    expect(form.values.label).toBe("Vegas 3");
  });

  it("fills in default ports and max players", async () => {
    const wrapper = await mount();

    radio("hosting-external").click();
    radio("kind-valve").click();
    await flushPromises();

    const values = (wrapper.vm as any).form.values;
    expect([values.port, values.tv_port, values.max_players]).toEqual([
      27015, 27020, 16,
    ]);
  });

  it("locks custom modes on an external server and offers to run it on a node", async () => {
    const wrapper = await mount();
    const form = (wrapper.vm as any).form;

    radio("hosting-external").click();
    await flushPromises();

    expect(form.values.use_game_server_node).toBe(false);
    expect(radio("kind-presets").disabled).toBe(true);

    const runOnNode = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.trim() === "Run it on a node")!;
    runOnNode.click();
    await flushPromises();

    expect(form.values.use_game_server_node).toBe(true);
    expect(form.values.type).toBe(modes[0].id);
  });

  it("requires a node before creating a server on one", async () => {
    const wrapper = await mount();

    radio("kind-presets").click();
    const form = (wrapper.vm as any).form;
    form.setFieldValue("label", "Community");
    form.setFieldValue("rcon_password", "rcon");
    await flushPromises();

    const { valid, errors } = await form.validate();
    expect(valid).toBe(false);
    expect(errors.game_server_node_id).toBe("Select Game Server Node");
  });

  it("keeps password managers off the server's secrets", async () => {
    await mount();

    radio("kind-valve").click();
    await flushPromises();

    const inputs = Array.from(
      document.body.querySelectorAll<HTMLInputElement>(
        'input[type="password"]',
      ),
    );
    expect(inputs).toHaveLength(2);
    for (const input of inputs) {
      expect(input.getAttribute("data-1p-ignore")).toBe("true");
      expect(input.getAttribute("data-lpignore")).toBe("true");
    }
  });

  it("links an administrator to the picked mode's own editor", async () => {
    useAuthStore().me = { steam_id: "1", role: "administrator" } as any;
    await mount();

    radio("kind-presets").click();
    await flushPromises();

    const link = document.body.querySelector<HTMLAnchorElement>(
      '[data-testid="edit-game-mode"]',
    );
    expect(link?.getAttribute("href")).toBe(
      `/settings/application/game-modes?mode=${modes[0].id}`,
    );
  });

  it("does not offer a moderator the mode editor", async () => {
    useAuthStore().me = { steam_id: "1", role: "moderator" } as any;
    await mount();

    radio("kind-presets").click();
    await flushPromises();

    expect(
      document.body.querySelector('[data-testid="edit-game-mode"]'),
    ).toBeNull();
  });
});
