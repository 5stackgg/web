import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useChatTabs } from "~/composables/useChatTabs";
import { useChatTabSetup } from "~/composables/useChatTabSetup";
import { useIncomingDirectMessages } from "~/composables/useIncomingDirectMessages";
import { directTabId } from "~/composables/useDirectMessages";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { setActiveHub } from "~/composables/useHubState";

const socketMock = vi.hoisted(() => {
  const handlers = new Map<string, Set<(data: any) => void>>();
  const lobbies = new Map<string, Map<string, Set<(data: any) => void>>>();

  return {
    handlers,
    lobbies,
    emit(event: string, data: unknown) {
      for (const handler of handlers.get(event) ?? []) {
        handler(data);
      }
    },
    emitLobby(room: string, event: string, data: unknown) {
      for (const handler of lobbies.get(room)?.get(event) ?? []) {
        handler(data);
      }
    },
  };
});

vi.mock("~/web-sockets/Socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/web-sockets/Socket")>()),
  default: {
    listen(event: string, callback: (data: any) => void) {
      if (!socketMock.handlers.has(event)) {
        socketMock.handlers.set(event, new Set());
      }
      socketMock.handlers.get(event)!.add(callback);

      return {
        stop() {
          socketMock.handlers.get(event)?.delete(callback);
        },
      };
    },
    joinLobby(_instance: string, type: string, id: string) {
      const room = `${type}:${id}`;
      const events = new Map<string, Set<(data: any) => void>>();
      socketMock.lobbies.set(room, events);

      return {
        messages: [],
        on(event: string, callback: (data: any) => void) {
          if (!events.has(event)) {
            events.set(event, new Set());
          }
          events.get(event)!.add(callback);
        },
        leave() {
          socketMock.lobbies.delete(room);
        },
      };
    },
    markLobbyRead() {},
  },
}));

const ME = "76561198000000001";
const FRIEND = "76561198000000002";
const ROOM = `${ME}:${FRIEND}`;
const TAB = directTabId(ROOM);

let unmount: (() => void) | undefined;

async function mountChat() {
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        useChatTabSetup();
        useIncomingDirectMessages();
        return () => h("div");
      },
    }),
  );
  unmount = () => wrapper.unmount();
  await flushPromises();
}

function stubApi(conversations: unknown[] = []) {
  vi.stubGlobal(
    "$fetch",
    vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith("/chat/direct/conversations")
          ? { conversations }
          : { threads: [] },
      ),
    ),
  );
}

const line = (id: string) => ({
  id,
  message: `line ${id}`,
  timestamp: new Date().toISOString(),
  from: { steam_id: FRIEND, name: "Dana" },
});

function incoming(id: string) {
  socketMock.emit("direct:incoming", {
    roomId: ROOM,
    from: { steam_id: FRIEND, name: "Dana" },
    message: line(id),
  });
}

function roomChat(id: string) {
  expect(socketMock.lobbies.has(`direct:${ROOM}`)).toBe(true);
  socketMock.emitLobby(`direct:${ROOM}`, "lobby:chat", line(id));
}

function showConversation(onScreen: boolean) {
  useChatTabs().setActiveTab(onScreen ? TAB : null);
  useRightSidebar().setRightSidebarOpen(onScreen);
  setActiveHub(onScreen ? "chat" : "social");
}

const unread = () => useChatTabs().unreadCounts.value[TAB] ?? 0;

beforeEach(() => {
  socketMock.handlers.clear();
  socketMock.lobbies.clear();
  useChatTabs().clearAll();
  useAuthStore().me = { steam_id: ME } as any;
  stubApi();
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  showConversation(false);
  useAuthStore().me = undefined;
  useChatTabs().clearAll();
  vi.unstubAllGlobals();
});

describe("useIncomingDirectMessages", () => {
  it("badges the first message from someone not on the rail", async () => {
    await mountChat();

    incoming("m1");

    const { tabs, activeTabId } = useChatTabs();
    expect(tabs.value.map((tab) => tab.id)).toContain(TAB);
    expect(unread()).toBe(1);
    expect(activeTabId.value).toBeNull();
  });

  it("counts every message in a burst that lands before the room is joined", async () => {
    await mountChat();

    incoming("m1");
    incoming("m2");
    incoming("m3");

    expect(unread()).toBe(3);
  });

  it("counts a message once when the joined room delivers it too", async () => {
    await mountChat();

    incoming("m1");
    await flushPromises();
    roomChat("m1");

    expect(unread()).toBe(1);

    roomChat("m2");
    incoming("m2");

    expect(unread()).toBe(2);
  });

  it("leaves the conversation on screen alone", async () => {
    await mountChat();

    incoming("m1");
    await flushPromises();
    useChatTabs().resetUnread(TAB);

    showConversation(true);
    incoming("m2");
    roomChat("m2");

    expect(unread()).toBe(0);

    showConversation(false);
    incoming("m3");

    expect(unread()).toBe(1);
  });

  it("adds a live message to the count the server hydrated", async () => {
    stubApi([
      {
        roomId: ROOM,
        unread: 4,
        isOpen: true,
        position: 0,
        peer: { steam_id: FRIEND, name: "Dana" },
      },
    ]);
    await mountChat();

    expect(unread()).toBe(4);

    incoming("m5");

    expect(unread()).toBe(5);

    roomChat("m5");

    expect(unread()).toBe(5);
  });
});
