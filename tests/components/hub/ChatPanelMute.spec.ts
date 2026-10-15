import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatPanel from "~/components/hub/ChatPanel.vue";
import { useChatTabs } from "~/composables/useChatTabs";
import { directTabId } from "~/composables/useDirectMessages";
import {
  resetChatRoomSettings,
  syncChatRoomSettings,
} from "~/composables/useChatRoomSettings";
import { fakeRoomSettingsClient, room } from "../../helpers/fakeRoomSettings";

const fake = vi.hoisted(() => ({ api: null as any }));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => fake.api.client,
}));

vi.mock("~/web-sockets/Socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/web-sockets/Socket")>()),
  default: {
    listen: () => ({ stop() {} }),
    joinLobby: () => ({ messages: [], on() {}, leave() {} }),
    hidesAuthor: () => false,
    markLobbyRead: vi.fn(),
    lobbyMessages: () => [],
  },
}));

const ME = "76561198000000001";
const FRIEND = "76561198000000002";
const DIRECT_ROOM = `${ME}:${FRIEND}`;
const DIRECT = directTabId(DIRECT_ROOM);

let unmount: (() => void) | undefined;

async function settle() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 50));
  await flushPromises();
}

async function mountPanel(open = false) {
  const wrapper = await mountSuspended(ChatPanel, {
    props: { isSidebarOpen: open, isTabActive: open },
    global: { stubs: { ChatLobby: true, ChatParticipants: true } },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

const menu = () => document.body.querySelector<HTMLElement>('[role="menu"]');

async function rightClick(
  wrapper: Awaited<ReturnType<typeof mountPanel>>,
  tabId: string,
) {
  wrapper.get(`[data-chat-tab="${tabId}"]`).element.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 600,
      clientY: 300,
    }),
  );
  await settle();
}

async function click(selector: string) {
  const element = document.body.querySelector<HTMLElement>(selector);
  expect(element, selector).not.toBeNull();
  element!.click();
  await settle();
}

beforeEach(async () => {
  fake.api = fakeRoomSettingsClient();
  useChatTabs().clearAll();
  useAuthStore().me = { steam_id: ME } as any;
  vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({ conversations: [] }));
  await syncChatRoomSettings(ME);
  await flushPromises();

  const { openTab } = useChatTabs();
  openTab({
    id: "tournament:t-1",
    label: "Autumn Cup",
    instance: "tournament",
    type: "tournament",
    lobbyId: "t-1",
    pinned: true,
    activate: false,
  });
  openTab({
    id: "matchmaking:lobby-1",
    label: "Lobby",
    instance: "matchmaking",
    type: "matchmaking",
    lobbyId: "lobby-1",
    pinned: true,
    activate: false,
  });
  openTab({
    id: DIRECT,
    label: "Dana",
    instance: "direct",
    type: "direct",
    lobbyId: DIRECT_ROOM,
    avatarUrl: "https://example.com/dana.png",
    activate: false,
  });
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  resetChatRoomSettings();
  useAuthStore().me = undefined;
  useChatTabs().clearAll();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ChatPanel with rooms the player quieted", () => {
  it("greys a muted room's count and marks it, keeping a tag that broke through red", async () => {
    fake.api.rooms([
      room("chat:tournament:t-1", { muted: true }),
      room("chat:matchmaking:lobby-1", { muted: true }),
      room(`chat:direct:${DIRECT_ROOM}`, { muted: true }),
    ]);
    const { setUnread, incrementMention } = useChatTabs();
    setUnread("tournament:t-1", 9);
    incrementMention("tournament:t-1", "m-1");
    setUnread("matchmaking:lobby-1", 3);
    setUnread(DIRECT, 2);

    const wrapper = await mountPanel();
    const badgeOf = (tabId: string) =>
      wrapper.get(`[data-chat-tab="${tabId}"] [data-chat-rail-badge]`);

    expect(badgeOf("tournament:t-1").attributes("data-tone")).toBe("red");
    expect(badgeOf("matchmaking:lobby-1").attributes("data-tone")).toBe(
      "muted",
    );
    expect(badgeOf(DIRECT).attributes("data-tone")).toBe("muted");
    expect(
      wrapper
        .find('[data-chat-tab="matchmaking:lobby-1"] [data-chat-rail-muted]')
        .exists(),
    ).toBe(true);
  });

  it("offers a mute and what to be told about on any room's menu", async () => {
    const wrapper = await mountPanel();

    await rightClick(wrapper, "tournament:t-1");

    expect(menu()?.textContent).toContain("Mute channel");
    expect(menu()?.textContent).toContain("Notify me about");
    expect(menu()?.textContent).toContain("All messages");

    await click("[data-chat-room-mute]");
    await click('[data-chat-room-mute-for="60"]');

    expect(fake.api.writes()).toEqual([
      expect.objectContaining({
        thread: "chat:tournament:t-1",
        muted: true,
        notify: "all",
      }),
    ]);
    const until = Date.parse(fake.api.writes()[0].muted_until);
    expect(until - Date.now()).toBeGreaterThan(59 * 60_000);
    expect(until - Date.now()).toBeLessThanOrEqual(60 * 60_000);
  });

  it("sets a room to only tags from its menu", async () => {
    const wrapper = await mountPanel();

    await rightClick(wrapper, "tournament:t-1");
    await click("[data-chat-room-notify]");
    await click('[data-chat-room-notify-level="mentions"]');

    expect(fake.api.writes()).toEqual([
      {
        thread: "chat:tournament:t-1",
        muted: false,
        muted_until: null,
        notify: "mentions",
      },
    ]);
  });

  it("mutes a conversation, with no level to pick", async () => {
    const wrapper = await mountPanel();

    await rightClick(wrapper, DIRECT);

    expect(menu()?.textContent).toContain("Mute conversation");
    expect(menu()?.textContent).not.toContain("Notify me about");
    expect(menu()?.textContent).toContain("Remove");
  });

  it("unmutes from the room header, saying how long the mute had left", async () => {
    const until = new Date(Date.now() + 30 * 60_000).toISOString();
    fake.api.rooms([
      room("chat:tournament:t-1", { muted: true, muted_until: until }),
    ]);
    useChatTabs().setActiveTab("tournament:t-1");

    const wrapper = await mountPanel(true);

    expect(wrapper.find("[data-chat-header-muted]").exists()).toBe(true);

    await wrapper
      .get('button[aria-label="Conversation options"]')
      .trigger("keydown", { key: "Enter" });
    await settle();

    expect(menu()?.textContent).toContain("Unmute channel");
    expect(menu()?.textContent).toMatch(/Muted until /);

    await click("[data-chat-room-unmute]");

    expect(fake.api.writes()).toEqual([
      {
        thread: "chat:tournament:t-1",
        muted: false,
        muted_until: null,
        notify: "all",
      },
    ]);
  });

  it("offers no room menu against an api without the setting", async () => {
    resetChatRoomSettings();
    const wrapper = await mountPanel();

    await rightClick(wrapper, "tournament:t-1");

    expect(menu()?.textContent ?? "").not.toContain("Mute channel");
    expect(menu()?.textContent ?? "").not.toContain("Notify me about");
  });
});
