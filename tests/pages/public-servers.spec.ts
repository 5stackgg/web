import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PublicServers from "~/pages/public-servers/index.vue";
import { useAuthStore } from "~/stores/AuthStore";

const server = {
  id: "server-1",
  label: "Public DM",
  type: "Deathmatch",
  game: "cs2",
  region: "us-east",
  connected: true,
  connection_link: null,
  connection_string: "connect 127.0.0.1:27015",
  max_players: 10,
  game_mode: null,
  server_region: { is_lan: false },
};

let mounted: { unmount: () => void } | null = null;

function rootField(query: any): string | undefined {
  return query.definitions[0]?.selectionSet?.selections[0]?.name?.value;
}

async function mountAs(role: string, servers: any[]) {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    role,
  } as any;

  const client = (useNuxtApp() as any).$apollo.defaultClient;
  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: any) {
      if (rootField(options.query) === "servers") {
        Promise.resolve().then(() => observer.next({ data: { servers } }));
      }
      return { unsubscribe() {}, closed: false };
    },
  }));

  const wrapper = await mountSuspended(PublicServers, {
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  mounted = wrapper;
  await flushPromises();
  return wrapper;
}

function setupLinks(wrapper: any) {
  return wrapper.findAll('a[href="/dedicated-servers/create"]');
}

function manageLinks(wrapper: any, tab: string) {
  return wrapper.findAll(`a[href="/dedicated-servers/${server.id}?tab=${tab}"]`);
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

describe("public servers setup gating", () => {
  it("does not offer a moderator the setup CTA on an empty list", async () => {
    const wrapper = await mountAs("moderator", []);

    expect(wrapper.text()).toContain("No Servers Available");
    expect(setupLinks(wrapper)).toHaveLength(0);
    expect(wrapper.text()).toContain(
      "No public servers available at the moment.",
    );
  });

  it("offers an administrator the setup CTA on an empty list", async () => {
    const wrapper = await mountAs("administrator", []);

    expect(setupLinks(wrapper)).toHaveLength(1);
    expect(wrapper.text()).toContain(
      "Set up a public server from the Dedicated Servers page",
    );
  });

  it("keeps a moderator's manage link but not the header CTA", async () => {
    const wrapper = await mountAs("moderator", [server]);

    expect(manageLinks(wrapper, "players")).toHaveLength(1);
    expect(setupLinks(wrapper)).toHaveLength(0);
  });

  it("links each server card to its stats page and keeps the connect controls", async () => {
    const wrapper = await mountAs("user", [
      { ...server, connection_link: "steam://connect/127.0.0.1:27015" },
    ]);

    expect(
      wrapper.findAll(`a[href="/dedicated-servers/${server.id}"]`),
    ).toHaveLength(1);
    expect(
      wrapper.find('a[href="steam://connect/127.0.0.1:27015"]').exists(),
    ).toBe(true);
  });

  it("gives an administrator the header CTA", async () => {
    const wrapper = await mountAs("administrator", [server]);

    expect(manageLinks(wrapper, "settings")).toHaveLength(1);
    expect(setupLinks(wrapper)).toHaveLength(1);
  });
});
