import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

let unmount: (() => void) | null = null;

async function mountCard(props: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(ServerPlayerManagement, {
    props: { serverId: "server-1", ...props },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

function statusButton(wrapper: Awaited<ReturnType<typeof mountCard>>) {
  return wrapper.find('button[aria-label^="Player Management plugin"]');
}

// The popover portals out of the card, so its content is read off the body.
async function openStatus(wrapper: Awaited<ReturnType<typeof mountCard>>) {
  await statusButton(wrapper).trigger("click");
  await flushPromises();
  return document.body.querySelector<HTMLElement>('[role="dialog"]')!;
}

function buttonIn(root: HTMLElement, text: string) {
  return Array.from(root.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === text,
  );
}

// A browser can't focus reka's popper wrapper (a plain div), but happy-dom
// can, and the focusin it fires lands outside the popover and dismisses one
// with nothing focusable inside the moment it opens.
const focus = HTMLElement.prototype.focus;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
    this: HTMLElement,
    options?: FocusOptions,
  ) {
    if (!this.hasAttribute("data-reka-popper-content-wrapper")) {
      focus.call(this, options);
    }
  });
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
});

describe("ServerPlayerManagement plugin status", () => {
  it("shows a community server whose plugin checked in as active", async () => {
    state.server = community(new Date().toISOString());

    const wrapper = await mountCard({ gameServerNodeId: "node-1" });

    expect(statusButton(wrapper).attributes("aria-label")).toBe(
      "Player Management plugin active",
    );
    expect(statusButton(wrapper).text()).toContain("v0.0.412");

    const popover = await openStatus(wrapper);

    expect(popover.textContent).toContain("v0.0.412");
    expect(popover.textContent).toContain("SwiftlyS2");
    expect(popover.textContent).toContain("Last check-in");
    expect(popover.textContent).not.toContain("has not checked in");
  });

  it("treats a heartbeat older than a few minutes as the plugin being gone", async () => {
    state.server = community(
      new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    );

    const wrapper = await mountCard({
      gameServerNodeId: "node-1",
      online: true,
    });

    expect(statusButton(wrapper).attributes("aria-label")).toBe(
      "Player Management plugin not detected",
    );

    const popover = await openStatus(wrapper);

    expect(popover.textContent).toContain("switch the server off and back on");
    expect(popover.textContent).not.toContain("Install Steps");
  });

  it("stays quiet about a missing plugin while the server is offline", async () => {
    state.server = community(null);

    const wrapper = await mountCard({ gameServerNodeId: "node-1" });

    expect(statusButton(wrapper).exists()).toBe(false);
    expect(wrapper.text()).not.toContain("has not checked in");
  });

  it("offers an administrator the download and config for a server outside a node", async () => {
    state.server = community(null);

    const wrapper = await mountCard({
      gameServerNodeId: null,
      apiPassword: "secret-password",
      online: true,
    });

    let popover = await openStatus(wrapper);

    expect(popover.textContent).toContain(
      "only enforced live once the 5Stack Player Management plugin is installed",
    );

    const download = popover.querySelector('a[href*="PlayerManagement"]');
    expect(download?.getAttribute("href")).toBe(
      "https://github.com/5stackgg/game-server/releases/download/sw-v0.0.412/PlayerManagement-sw-v0.0.412.zip",
    );
    expect(popover.textContent).toContain(
      "addons/swiftlys2/configs/plugins/PlayerManagement/config.jsonc",
    );

    // The config carries the api password, so it stays hidden like the
    // page's own plugin config until asked for.
    expect(document.body.innerHTML).not.toContain("secret-password");

    buttonIn(popover, "Show Config")!.click();
    await flushPromises();

    expect(popover.querySelector("pre")?.textContent).toContain(
      '"PlayerManagement"',
    );
    expect(popover.querySelector("pre")?.textContent).toContain(
      "secret-password",
    );

    // Closing the popover hides it again rather than leaving it on screen.
    await statusButton(wrapper).trigger("click");
    await flushPromises();
    popover = await openStatus(wrapper);

    expect(popover.querySelector("pre")).toBeNull();
    expect(document.body.innerHTML).not.toContain("secret-password");
  });

  it("never shows install steps to someone who is not an administrator", async () => {
    useAuthStore().me = {
      steam_id: "76561198000000002",
      role: "moderator",
    } as any;
    state.server = community(null);

    const wrapper = await mountCard({ gameServerNodeId: null, online: true });

    const popover = await openStatus(wrapper);

    expect(popover.textContent).toContain("installed on this server");
    expect(popover.textContent).not.toContain("Install Steps");
  });

  it("says nothing about the plugin on a Ranked server", async () => {
    state.server = { ...community(null), type: "Ranked" };

    const wrapper = await mountCard({
      gameServerNodeId: "node-1",
      online: true,
    });

    expect(statusButton(wrapper).exists()).toBe(false);
  });
});
