import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";

const state = vi.hoisted(() => ({ data: null as any }));

vi.mock("@vue/apollo-composable", async (importOriginal) => {
  const { ref } = await import("vue");
  return {
    ...(await importOriginal<object>()),
    useQuery: () => ({ result: ref(state.data), refetch: vi.fn(async () => {}) }),
    useApolloClient: () => ({
      client: { query: vi.fn(async () => ({ data: { events: [] } })) },
    }),
  };
});

import ServerSettings from "~/components/servers/ServerSettings.vue";

// One fixture answers every section's query: each reads only its own fields.
function fixture() {
  return {
    servers_by_pk: {
      id: "server-1",
      map_rotation_shuffle: true,
      map_rotation: [],
      plugin_overrides: [],
      map_rotation_aggregate: { aggregate: { count: 0 } },
      game_mode: null,
      access_restricted: false,
      access_min_role: null,
      player_management_seen_at: new Date().toISOString(),
      access_players: [],
      access_events: [],
    },
    maps: [],
    game_plugin_installs: [],
  };
}

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.restoreAllMocks();
});

async function mountConsole(nodeId: string | null, route = "/") {
  state.data = fixture();

  const wrapper = await mountSuspended(ServerSettings, {
    route,
    props: {
      server: { id: "server-1", enabled: true, game_server_node_id: nodeId },
    },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

describe("ServerSettings", () => {
  it("offers rotation, plugins and access on a node server", async () => {
    const wrapper = await mountConsole("node-a");

    expect(wrapper.text()).toContain("Map Rotation");
    expect(wrapper.text()).toContain("Plugins");
    expect(wrapper.text()).toContain("Access");
    expect(wrapper.text()).toContain("Player Management");
  });

  // The install steps moved out of the roster's popover into their own
  // section, mounted only while it is the open one.
  it("opens the Player Management section from its deep link", async () => {
    const wrapper = await mountConsole(
      null,
      "/?settings=player-management",
    );

    expect(
      wrapper.find('[data-testid="player-management-plugin"]').exists(),
    ).toBe(true);
    expect(wrapper.find("#server-access-restricted").isVisible()).toBe(false);
  });

  // Rotation and plugins reach the server in its pod spec; an external server
  // has none, but its Player Management plugin still enforces access.
  it("offers only access on an external server", async () => {
    const wrapper = await mountConsole(null);

    expect(wrapper.find("#server-rotation-maps").exists()).toBe(false);
    expect(wrapper.find("#server-plugins").exists()).toBe(false);
    expect(wrapper.find("#server-access-restricted").exists()).toBe(true);
  });

  it("saves only the edited section, without a restart for access", async () => {
    const wrapper = await mountConsole("node-a");
    const mutate = vi
      .spyOn(useNuxtApp().$apollo.defaultClient, "mutate")
      .mockResolvedValue({ data: { setServerSettings: { success: true } } } as any);

    await wrapper
      .find("#server-access-restricted [role='switch']")
      .trigger("click");
    await flushPromises();

    expect(document.body.textContent).toContain("Restricted. Applies within seconds.");

    const save = [...document.body.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Save"),
    );
    save?.click();
    await flushPromises();

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0].variables).toEqual({
      serverId: "server-1",
      mapRotation: null,
      plugins: null,
      access: {
        restricted: true,
        min_role: null,
        steam_ids: [],
        event_ids: [],
      },
    });
  });
});
