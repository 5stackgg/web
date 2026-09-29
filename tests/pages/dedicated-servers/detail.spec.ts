import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import DedicatedServerPage from "~/pages/dedicated-servers/[id].vue";
import { useAuthStore } from "~/stores/AuthStore";

const server = {
  type: "Ranked",
  game: "cs2",
  id: "server-1",
  host: "10.0.0.5",
  region: "us-east",
  port: 27015,
  label: "Node Server",
  tv_port: 27020,
  enabled: true,
  connected: true,
  plugin_version: null,
  plugin_runtime: null,
  rcon_status: true,
  game_server_node_id: "node-1",
  game_mode_id: null,
  connection_link: null,
  connection_string: null,
  offline_at: null,
  max_players: 10,
};

let mounted: { unmount: () => void } | null = null;

function rootField(query: any): string | undefined {
  return query.definitions[0]?.selectionSet?.selections[0]?.name?.value;
}

async function mountAs(role: string) {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    role,
  } as any;

  const client = (useNuxtApp() as any).$apollo.defaultClient;
  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: any) {
      if (rootField(options.query) === "servers_by_pk") {
        Promise.resolve().then(() =>
          observer.next({ data: { servers_by_pk: server } }),
        );
      }
      return { unsubscribe() {}, closed: false };
    },
  }));

  const wrapper = await mountSuspended(DedicatedServerPage, {
    route: `/dedicated-servers/${server.id}`,
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
      stubs: {
        QuickServerConnect: true,
        ServerPlayerManagement: true,
        RconCommander: true,
        ServiceLogs: true,
        ServerForm: true,
      },
    },
  });
  mounted = wrapper;
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

describe("dedicated server files button", () => {
  it("is hidden from a tournament organizer who can still manage the server", async () => {
    const wrapper = await mountAs("tournament_organizer");

    expect(wrapper.text()).toContain("Node Server");
    expect(wrapper.find(".lucide-ellipsis-vertical").exists()).toBe(true);
    expect(wrapper.find(".lucide-folder-open").exists()).toBe(false);
  });

  it("is shown to an administrator", async () => {
    const wrapper = await mountAs("administrator");

    expect(wrapper.find(".lucide-folder-open").exists()).toBe(true);
  });
});
