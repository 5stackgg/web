import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ServerPlayerManagement from "~/components/servers/ServerPlayerManagement.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const state = vi.hoisted(() => ({
  server: null as Record<string, unknown> | null,
}));

vi.mock("~/graphql/getGraphqlClient", async () => {
  const { print } = await import("graphql");

  return {
    default: () => ({
      query: async () => ({ data: {} }),
      subscribe: ({ query }: any) => ({
        subscribe: ({ next }: any) => {
          const text = typeof query === "string" ? query : print(query);

          next({
            data: text.includes("player_management_seen_at")
              ? { servers_by_pk: state.server }
              : {},
          });

          return { unsubscribe() {} };
        },
      }),
    }),
  };
});

const community = (seenAt: string | null) => ({
  id: "server-1",
  type: "Casual",
  game: "cs2",
  is_dedicated: true,
  player_management_version: seenAt ? "0.0.412" : null,
  player_management_runtime: seenAt ? "swiftlys2" : null,
  player_management_seen_at: seenAt,
});

async function mountCard(props: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(ServerPlayerManagement, {
    props: { serverId: "server-1", ...props },
  });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  state.server = null;
  vi.spyOn(
    useApplicationSettingsStore(),
    "latestPluginVersion",
  ).mockImplementation((runtime: string) =>
    runtime === "swiftlys2" ? "0.0.412" : "0.0.390",
  );
  useAuthStore().me = {
    steam_id: "76561198000000001",
    role: "administrator",
  } as any;
});

describe("ServerPlayerManagement plugin status", () => {
  it("shows a community server whose plugin checked in as active", async () => {
    state.server = community(new Date().toISOString());

    const wrapper = await mountCard({ gameServerNodeId: "node-1" });

    expect(wrapper.text()).toContain("Player Management plugin active");
    expect(wrapper.text()).toContain("v0.0.412");
    expect(wrapper.text()).toContain("SwiftlyS2");
    expect(wrapper.text()).not.toContain("has not checked in");
  });

  it("treats a heartbeat older than a few minutes as the plugin being gone", async () => {
    state.server = community(
      new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    );

    const wrapper = await mountCard({ gameServerNodeId: "node-1" });

    expect(wrapper.text()).toContain("This node loads it automatically");
    expect(wrapper.text()).not.toContain("Install Plugin");
  });

  it("offers an administrator the download and config for a server outside a node", async () => {
    state.server = community(null);

    const wrapper = await mountCard({
      gameServerNodeId: null,
      apiPassword: "secret-password",
    });

    expect(wrapper.text()).toContain(
      "only enforced live once the 5Stack Player Management plugin is installed",
    );

    const install = wrapper
      .findAll("button")
      .find((button) => button.text() === "Install Plugin");
    await install!.trigger("click");

    const download = wrapper.find('a[href*="PlayerManagement"]');
    expect(download.attributes("href")).toBe(
      "https://github.com/5stackgg/game-server/releases/download/sw-v0.0.412/PlayerManagement-sw-v0.0.412.zip",
    );
    expect(wrapper.text()).toContain(
      "addons/swiftlys2/configs/plugins/PlayerManagement/config.jsonc",
    );
    expect(wrapper.find("pre").text()).toContain('"PlayerManagement"');
    expect(wrapper.find("pre").text()).toContain("secret-password");
  });

  it("never shows install steps to someone who is not an administrator", async () => {
    useAuthStore().me = {
      steam_id: "76561198000000002",
      role: "moderator",
    } as any;
    state.server = community(null);

    const wrapper = await mountCard({ gameServerNodeId: null });

    expect(wrapper.text()).toContain("installed on this server");
    expect(wrapper.text()).not.toContain("Install Plugin");
  });

  it("says nothing about the plugin on a Ranked server", async () => {
    state.server = { ...community(null), type: "Ranked" };

    const wrapper = await mountCard({ gameServerNodeId: "node-1" });

    expect(wrapper.text()).not.toContain("Player Management plugin");
    expect(wrapper.text()).not.toContain("has not checked in");
  });
});
