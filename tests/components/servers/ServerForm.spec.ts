import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ServerForm from "~/components/servers/ServerForm.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const nodes = [
  {
    id: "node-1",
    label: "Node One",
    region: "us-east",
    build_id: 100,
    lan_ip: null,
    public_ip: null,
    start_port_range: 30000,
    end_port_range: 30010,
    e_region: { description: "US East" },
  },
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
  vi.restoreAllMocks();
});

function rootField(query: any): string | undefined {
  return query.definitions[0]?.selectionSet?.selections[0]?.name?.value;
}

async function mount() {
  useApplicationSettingsStore().settings = [
    { name: "public.game_plugins_enabled", value: "false" },
  ];

  const client = (useNuxtApp() as any).$apollo.defaultClient;
  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: any) {
      if (rootField(options.query) === "game_server_nodes") {
        Promise.resolve().then(() =>
          observer.next({ data: { game_server_nodes: nodes } }),
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

  it("switches a new server onto a game server node when custom presets are picked", async () => {
    const wrapper = await mount();

    radio("kind-presets").closest<HTMLElement>("div.rounded-lg")!.click();
    await flushPromises();

    const form = (wrapper.vm as any).form;
    expect(form.values.type).toBe(modes[0].id);
    expect(form.values.use_game_server_node).toBe(true);
  });

  it("offers every custom mode before a node is picked", async () => {
    await mount();

    radio("kind-presets").click();
    await flushPromises();

    const trigger = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>(
        'button[role="combobox"]',
      ),
    ).find((button) => button.textContent?.includes(modes[0].name))!;
    trigger.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerType: "mouse",
      }),
    );
    await flushPromises();

    const options = Array.from(
      document.body.querySelectorAll('[role="option"]'),
    );
    expect(options.map((option) => option.textContent?.trim())).toEqual(
      modes.map((mode) => mode.name),
    );
    expect(options.filter((option) => option.hasAttribute("data-disabled")))
      .toEqual([]);
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
});
