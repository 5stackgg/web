import { afterEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";

const state = vi.hoisted(() => ({ data: null as any }));

vi.mock("@vue/apollo-composable", async (importOriginal) => {
  const { ref } = await import("vue");
  return {
    ...(await importOriginal<object>()),
    useQuery: () => ({ result: ref(state.data), refetch: vi.fn(async () => {}) }),
  };
});

import ServerPlugins from "~/components/servers/ServerPlugins.vue";

const install = (slug: string, extra: Record<string, unknown> = {}) => ({
  plugin_slug: slug,
  load_custom: false,
  load_tournaments: false,
  plugin: { name: slug, map_rotation: null },
  ...extra,
});

const server = (extra: Record<string, unknown> = {}) => ({
  id: "server-1",
  game_mode: null,
  plugin_overrides: [],
  map_rotation_aggregate: { aggregate: { count: 0 } },
  ...extra,
});

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

async function mountCard() {
  const wrapper = await mountSuspended(ServerPlugins, {
    props: { serverId: "server-1" },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

const rows = (wrapper: Awaited<ReturnType<typeof mountCard>>) =>
  wrapper.findAll("li").map((li) => li.text());

describe("ServerPlugins", () => {
  // It read the plugin list before declaring it, so the page 500'd on load.
  it("mounts with installed plugins and saved overrides", async () => {
    state.data = {
      servers_by_pk: server({
        plugin_overrides: [{ plugin_slug: "csroll", enabled: true }],
      }),
      game_plugin_installs: [install("csroll"), install("retakes")],
    };

    const wrapper = await mountCard();

    expect(rows(wrapper)).toHaveLength(2);
    expect(rows(wrapper)[0]).toContain("Loads");
    expect(rows(wrapper)[0]).toContain("Switched on for this server");
    expect(rows(wrapper)[1]).toContain("Not Loaded");
  });

  it("shows the rotation plugin loading for a server with a rotation", async () => {
    state.data = {
      servers_by_pk: server({
        map_rotation_aggregate: { aggregate: { count: 3 } },
      }),
      game_plugin_installs: [
        install("map-chooser", {
          plugin: { name: "MapChooser", map_rotation: { files: {} } },
        }),
      ],
    };

    const wrapper = await mountCard();

    expect(rows(wrapper)[0]).toContain("Loads to play the map rotation");
  });

  it("locks a plugin the server's game mode loads", async () => {
    state.data = {
      servers_by_pk: server({
        game_mode: {
          id: "mode-1",
          name: "Prophunt",
          plugins: [{ plugin_slug: "csroll" }],
        },
      }),
      game_plugin_installs: [install("csroll")],
    };

    const wrapper = await mountCard();

    expect(rows(wrapper)[0]).toContain("From Prophunt");
    expect(wrapper.find("li button").exists()).toBe(false);
  });
});

describe("ServerPlugins per-server plugin settings", () => {
  const configurable = (slug: string, extra: Record<string, unknown> = {}) =>
    install(slug, {
      cfg: "dm_replenish_health 10",
      config: null,
      plugin: {
        name: "Deathmatch",
        map_rotation: null,
        cvars: ["dm_replenish_health"],
        config_path: "addons/swiftlys2/configs/plugins/Deathmatch/modes.json",
      },
      ...extra,
    });

  it("offers settings only for a plugin that has some", async () => {
    state.data = {
      servers_by_pk: server({ plugin_configs: [] }),
      game_plugin_installs: [configurable("deathmatch"), install("csroll")],
    };

    const wrapper = await mountCard();
    const configure = wrapper.findAll(
      'button[aria-label="Configure for This Server"]',
    );

    expect(configure).toHaveLength(1);
  });

  it("marks a plugin this server has its own settings for", async () => {
    state.data = {
      servers_by_pk: server({
        plugin_configs: [
          {
            plugin_slug: "deathmatch",
            cfg: "dm_replenish_health 50",
            config: null,
          },
        ],
      }),
      game_plugin_installs: [configurable("deathmatch")],
    };

    const wrapper = await mountCard();

    expect(wrapper.find('[title="Customized for this server"]').exists()).toBe(
      true,
    );
    expect((wrapper.vm as any).configPayload()).toBeNull();
  });

  // Staged, not saved: the server's settings save together with one restart.
  it("stages a plugin's settings until the server's settings are saved", async () => {
    state.data = {
      servers_by_pk: server({ plugin_configs: [] }),
      game_plugin_installs: [configurable("deathmatch")],
    };

    const wrapper = await mountCard();
    await wrapper
      .find('button[aria-label="Configure for This Server"]')
      .trigger("click");

    const { default: PluginConfigPanel } =
      await import("~/components/game-plugins/PluginConfigPanel.vue");
    wrapper.findComponent(PluginConfigPanel).vm.$emit("apply", {
      cfg: "dm_replenish_health 50",
      config: [{ name: "Pistols", weapons: ["deagle"], duration: 60 }],
    });
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as any;
    expect(vm.changes).toEqual([
      { text: "Deathmatch: settings", restart: true },
    ]);
    expect(vm.configPayload()).toEqual([
      {
        slug: "deathmatch",
        cfg: "dm_replenish_health 50",
        config: [{ name: "Pistols", weapons: ["deagle"], duration: 60 }],
      },
    ]);

    vm.reset();
    expect(vm.configPayload()).toBeNull();
  });
});
