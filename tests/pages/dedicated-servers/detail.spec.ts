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

async function mountAs(
  role: string,
  options: { server?: Record<string, unknown>; route?: string } = {},
) {
  const current = { ...server, ...options.server };
  useAuthStore().me = {
    steam_id: "76561198000000001",
    role,
  } as any;

  const client = (useNuxtApp() as any).$apollo.defaultClient;
  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: any) {
      if (rootField(options.query) === "servers_by_pk") {
        Promise.resolve().then(() =>
          observer.next({ data: { servers_by_pk: current } }),
        );
      }
      return { unsubscribe() {}, closed: false };
    },
  }));

  const wrapper = await mountSuspended(DedicatedServerPage, {
    route: options.route ?? `/dedicated-servers/${server.id}`,
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
      stubs: {
        QuickServerConnect: true,
        ServerPlayerManagement: true,
        ServerRecentPlayers: true,
        ServerSettings: true,
        RconCommander: true,
        ServiceLogs: true,
        ServerForm: true,
        ServerCommunityOverview: true,
        PublicServerView: true,
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
    expect(wrapper.find(".lucide-folder-open").exists()).toBe(false);
  });

  it("is shown to an administrator", async () => {
    const wrapper = await mountAs("administrator");

    expect(wrapper.find(".lucide-folder-open").exists()).toBe(true);
  });
});

function tabLabels(wrapper: Awaited<ReturnType<typeof mountAs>>) {
  return wrapper
    .find('[role="tablist"]')
    .findAll('[role="tab"]')
    .map((tab) => tab.text());
}

describe("dedicated server tabs", () => {
  it("gives a moderator the daily tools only", async () => {
    const wrapper = await mountAs("moderator");

    expect(tabLabels(wrapper)).toEqual(["Players", "Console"]);
  });

  it("adds logs and settings for an administrator", async () => {
    const wrapper = await mountAs("administrator");

    expect(tabLabels(wrapper)).toEqual([
      "Players",
      "Console",
      "Logs",
      "Settings",
    ]);
    expect(wrapper.find('[role="tab"][data-state="active"]').text()).toBe(
      "Players",
    );
  });

  it("still opens settings from a link made before the tabs", async () => {
    const wrapper = await mountAs("administrator", {
      server: { type: "Casual" },
      route: `/dedicated-servers/${server.id}?settings=plugins`,
    });

    expect(wrapper.find('[role="tab"][data-state="active"]').text()).toBe(
      "Settings",
    );
    expect(wrapper.find("server-settings-stub").isVisible()).toBe(true);
  });
});

describe("dedicated server overview", () => {
  it("opens a community server on the public stats, ahead of the staff tabs", async () => {
    const wrapper = await mountAs("administrator", {
      server: { type: "Casual" },
    });

    expect(tabLabels(wrapper)).toEqual([
      "Overview",
      "Players",
      "Console",
      "Logs",
      "Settings",
    ]);
    expect(wrapper.find('[role="tab"][data-state="active"]').text()).toBe(
      "Overview",
    );
    expect(wrapper.find("server-community-overview-stub").isVisible()).toBe(
      true,
    );
  });

  it("gives a moderator the overview too", async () => {
    const wrapper = await mountAs("moderator", { server: { type: "Casual" } });

    expect(tabLabels(wrapper)).toEqual(["Overview", "Players", "Console"]);
  });

  it("shows a player the public view and never asks for the staff columns", async () => {
    const client = (useNuxtApp() as any).$apollo.defaultClient;
    const wrapper = await mountAs("user", { server: { type: "Casual" } });

    expect(wrapper.find("public-server-view-stub").exists()).toBe(true);
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
    expect(
      client.subscribe.mock.calls.filter(
        ([options]: any) => rootField(options.query) === "servers_by_pk",
      ),
    ).toHaveLength(0);
  });
});

describe("dedicated server settings", () => {
  // Edit and delete used to sit in a header menu and a side sheet; they live
  // in the Settings tab now, for every kind of server.
  it("keeps edit and delete in Settings rather than a header menu", async () => {
    const wrapper = await mountAs("administrator", {
      route: `/dedicated-servers/${server.id}?tab=settings`,
    });

    expect(wrapper.find(".lucide-ellipsis-vertical").exists()).toBe(false);
    const settings = wrapper.find("server-settings-stub");
    expect(settings.isVisible()).toBe(true);
    expect(settings.attributes("community")).toBe("false");
  });

  it("gives a community server its community sections too", async () => {
    const wrapper = await mountAs("administrator", {
      server: { type: "Casual" },
      route: `/dedicated-servers/${server.id}?tab=settings`,
    });

    expect(wrapper.find("server-settings-stub").attributes("community")).toBe(
      "true",
    );
  });
});

describe("dedicated server header", () => {
  it("puts Join right beside the address it connects to", async () => {
    const wrapper = await mountAs("moderator", {
      server: { connection_string: "connect 10.0.0.5:27015" },
    });

    const join = wrapper.find("quick-server-connect-stub");
    expect(join.exists()).toBe(true);
    expect(join.element.parentElement?.textContent).toContain(
      "10.0.0.5:27015",
    );
  });

  // Online and the week's players live on the Overview tab and the plugin's
  // status in Settings; a second copy above the tabs only repeated them.
  it("keeps stats out of the header", async () => {
    const wrapper = await mountAs("moderator", {
      server: { type: "Casual" },
    });

    expect(wrapper.find("header").text()).not.toContain("Online");
    expect(wrapper.find("header").text()).not.toContain("Player Management");
  });
});
