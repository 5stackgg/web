import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useChatTabs } from "~/composables/useChatTabs";
import { useChatTabSetup } from "~/composables/useChatTabSetup";
import { useIncomingDirectMessages } from "~/composables/useIncomingDirectMessages";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import socket, { type LobbyMessage } from "~/web-sockets/Socket";

const flash = vi.hoisted(() => ({ signalChat: vi.fn() }));

vi.mock("~/composables/useTabFlash", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/composables/useTabFlash")>();

  return {
    ...actual,
    useTabFlash: () => ({
      ...actual.useTabFlash(),
      signalChat: flash.signalChat,
    }),
  };
});

const ME = "76561198000000001";
const OTHER = "76561198000000002";

let lobbyId = "";
let lobbyCounter = 0;
let unmount: (() => void) | undefined;
let incomingBaseline = 0;

const room = () => `lobby:matchmaking:${lobbyId}`;

const line = (id: string): LobbyMessage => ({
  id,
  message: `line ${id}`,
  timestamp: new Date().toISOString(),
  from: { steam_id: OTHER, name: "Dana" },
});

async function mountLayout() {
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

function unmountLayout() {
  unmount?.();
  unmount = undefined;
}

async function remountLayout() {
  await mountLayout();
  unmountLayout();
  await mountLayout();
}

beforeEach(() => {
  lobbyId = `lobby-teardown-${++lobbyCounter}`;
  incomingBaseline = socket.listenerCount("direct:incoming");
  flash.signalChat.mockClear();
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
    vi.fn().mockResolvedValue({ threads: [], conversations: [] }),
  );
});

afterEach(() => {
  unmountLayout();
  useAuthStore().me = undefined;
  useChatTabs().clearAll();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("chat listeners across a layout remount", () => {
  it("handles a room's lobby:chat once", async () => {
    await remountLayout();

    socket.emit(`${room()}:chat`, line("m1"));

    expect(flash.signalChat).toHaveBeenCalledTimes(1);
    expect(flash.signalChat).toHaveBeenCalledWith(
      "matchmaking",
      expect.objectContaining({ id: "m1" }),
    );
    expect(useChatTabs().unreadCounts.value[`matchmaking:${lobbyId}`]).toBe(1);
  });

  it("handles a direct:incoming once", async () => {
    await remountLayout();

    socket.emit("direct:incoming", {
      roomId: `${ME}:${OTHER}`,
      from: { steam_id: OTHER, name: "Dana" },
      message: line("dm-1"),
    });

    expect(flash.signalChat).toHaveBeenCalledTimes(1);
    expect(socket.listenerCount("direct:incoming")).toBe(incomingBaseline + 1);
  });

  it("leaves its rooms and listeners when the layout unmounts", async () => {
    await mountLayout();

    expect(socket.listenerCount(`${room()}:chat`)).toBe(1);
    expect(socket.listenerCount("direct:incoming")).toBe(incomingBaseline + 1);

    unmountLayout();

    expect(socket.listenerCount(`${room()}:chat`)).toBe(0);
    expect(socket.listenerCount("direct:incoming")).toBe(incomingBaseline);

    socket.emit(`${room()}:chat`, line("m2"));
    expect(flash.signalChat).not.toHaveBeenCalled();
  });
});
