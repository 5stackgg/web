import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useChatTabs } from "~/composables/useChatTabs";
import { useChatTabSetup } from "~/composables/useChatTabSetup";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { setActiveHub } from "~/composables/useHubState";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { chatThreadKey } from "~/utilities/chatThread";
import socket, { type LobbyMessage } from "~/web-sockets/Socket";

const ME = "76561198000000001";
const OTHER = "76561198000000002";

// A fresh lobby per test: the socket is a singleton and keeps a room's state,
// tombstones included, for as long as anything holds it.
let lobbyId = "";
let tabId = "";
let room = "";
let lobbyCounter = 0;

const at = (minute: number) =>
  new Date(Date.UTC(2026, 8, 28, 12, minute)).toISOString();

const line = (id: string, minute: number, from = OTHER): LobbyMessage => ({
  id,
  message: `line ${id}`,
  timestamp: at(minute),
  from: { steam_id: from },
});

let unmount: (() => void) | undefined;

async function mountSetup() {
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        useChatTabSetup();
        return () => h("div");
      },
    }),
  );
  unmount = () => wrapper.unmount();
  await flushPromises();
}

const unread = () => useChatTabs().unreadCounts.value[tabId];

beforeEach(async () => {
  lobbyId = `lobby-deletes-${++lobbyCounter}`;
  tabId = `matchmaking:${lobbyId}`;
  room = `lobby:matchmaking:${lobbyId}`;
  vi.spyOn(console, "info").mockImplementation(() => {});
  useChatTabs().clearAll();
  useMatchLobbyStore().chatTournaments = [];
  useMatchLobbyStore().myMatches = [];
  useRightSidebar().setRightSidebarOpen(false);
  useAuthStore().me = {
    steam_id: ME,
    current_lobby_id: lobbyId,
    role: "user",
  } as any;
  vi.stubGlobal(
    "$fetch",
    vi.fn().mockResolvedValue({
      threads: [
        {
          thread: chatThreadKey("matchmaking", lobbyId),
          lastReadAt: at(1),
        },
      ],
    }),
  );

  await mountSetup();

  socket.emit(`${room}:messages`, {
    messages: [line("read", 0), line("unread", 2), line("mine", 3, ME)],
  });
  socket.emit(`${room}:chat`, line("live", 4));
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  useChatTabs().clearAll();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useChatTabSetup deletes", () => {
  it("takes an unread line out of the badge", () => {
    expect(unread()).toBe(2);

    socket.emit(`${room}:deleted`, { id: "unread" });
    expect(unread()).toBe(1);

    socket.emit(`${room}:deleted`, { id: "live" });
    expect(unread()).toBe(0);
  });

  it("leaves the badge alone for a line it never counted", () => {
    socket.emit(`${room}:deleted`, { id: "read" });
    socket.emit(`${room}:deleted`, { id: "mine" });

    expect(unread()).toBe(2);
  });

  it("goes by the latest recount, not what it counted before", () => {
    useChatTabs().setUnread(tabId, 0);

    socket.emit(`${room}:deleted`, { id: "unread" });

    expect(unread()).toBe(0);
  });

  it("leaves the badge alone for a line read on screen and deleted later", () => {
    useChatTabs().resetUnread(tabId);
    useChatTabs().setActiveTab(tabId);
    useRightSidebar().setRightSidebarOpen(true);
    setActiveHub("chat");

    socket.emit(`${room}:chat`, line("spam", 5));
    expect(unread()).toBe(0);

    useRightSidebar().setRightSidebarOpen(false);
    socket.emit(`${room}:chat`, line("teammate", 6));
    expect(unread()).toBe(1);

    socket.emit(`${room}:deleted`, { id: "spam" });
    expect(unread()).toBe(1);

    socket.emit(`${room}:deleted`, { id: "teammate" });
    expect(unread()).toBe(0);
  });

  it("forgets what it counted once the room has been read", () => {
    useChatTabs().resetUnread(tabId);
    socket.emit(`${room}:chat`, line("after", 5));
    expect(unread()).toBe(1);

    socket.emit(`${room}:deleted`, { id: "unread" });

    expect(unread()).toBe(1);
  });
});
