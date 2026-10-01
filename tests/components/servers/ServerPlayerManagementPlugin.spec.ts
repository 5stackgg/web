import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ServerPlayerManagementPlugin from "~/components/servers/ServerPlayerManagementPlugin.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const state = vi.hoisted(() => ({
  server: null as Record<string, unknown> | null,
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    subscribe: () => ({
      subscribe: ({ next }: any) => {
        next({ data: { servers_by_pk: state.server } });
        return { unsubscribe() {} };
      },
    }),
  }),
}));

const community = (seenAt: string | null) => ({
  id: "server-1",
  type: "Casual",
  game: "cs2",
  is_dedicated: true,
  player_management_version: seenAt ? "0.0.412" : null,
  player_management_runtime: seenAt ? "swiftlys2" : null,
  player_management_seen_at: seenAt,
});

let unmount: (() => void) | null = null;

async function mountSection(props: Record<string, unknown>) {
  const wrapper = await mountSuspended(ServerPlayerManagementPlugin, {
    props: { serverId: "server-1", ...props },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
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

afterEach(() => {
  unmount?.();
  unmount = null;
  vi.restoreAllMocks();
});

describe("ServerPlayerManagementPlugin", () => {
  it("shows an active plugin's version, framework and last check-in", async () => {
    state.server = community(new Date().toISOString());

    const wrapper = await mountSection({ gameServerNodeId: "node-1" });

    expect(wrapper.text()).toContain("Player Management plugin active");
    expect(wrapper.text()).toContain("v0.0.412");
    expect(wrapper.text()).toContain("SwiftlyS2");
    expect(wrapper.text()).toContain("Last check-in");
    expect(wrapper.text()).not.toContain("Install Steps");
  });

  it("tells a node server to redeploy instead of offering install steps", async () => {
    state.server = community(
      new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    );

    const wrapper = await mountSection({ gameServerNodeId: "node-1" });

    expect(wrapper.text()).toContain("Player Management plugin not detected");
    expect(wrapper.text()).toContain("switch the server off and back on");
    expect(wrapper.text()).not.toContain("Install Steps");
  });

  it("offers an administrator the download and config for a server outside a node", async () => {
    state.server = community(null);

    const wrapper = await mountSection({
      gameServerNodeId: null,
      apiPassword: "secret-password",
    });

    expect(wrapper.text()).toContain(
      "only enforced live once the 5Stack Player Management plugin is installed",
    );
    expect(wrapper.find('a[href*="PlayerManagement"]').attributes("href")).toBe(
      "https://github.com/5stackgg/game-server/releases/download/sw-v0.0.412/PlayerManagement-sw-v0.0.412.zip",
    );
    expect(wrapper.text()).toContain(
      "addons/swiftlys2/configs/plugins/PlayerManagement/config.jsonc",
    );

    // The config carries the api password, so it stays hidden until asked for.
    expect(document.body.innerHTML).not.toContain("secret-password");

    const show = wrapper
      .findAll("button")
      .find((button) => button.text() === "Show Config");
    await show!.trigger("click");

    expect(wrapper.find("pre").text()).toContain('"PlayerManagement"');
    expect(wrapper.find("pre").text()).toContain("secret-password");
  });

  it("never shows install steps to someone who is not an administrator", async () => {
    useAuthStore().me = {
      steam_id: "76561198000000002",
      role: "moderator",
    } as any;
    state.server = community(null);

    const wrapper = await mountSection({ gameServerNodeId: null });

    expect(wrapper.text()).toContain("installed on this server");
    expect(wrapper.text()).not.toContain("Install Steps");
  });
});
