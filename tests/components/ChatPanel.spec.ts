import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatPanel from "~/components/hub/ChatPanel.vue";
import { useChatTabs } from "~/composables/useChatTabs";

vi.mock("~/web-sockets/Socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/web-sockets/Socket")>()),
  default: {
    listen: () => ({ stop() {} }),
    joinLobby: () => ({ messages: [], on() {}, leave() {} }),
    markLobbyRead() {},
  },
}));

const REQUESTED = "direct:76561198000000001:76561198000000002";

let unmount: (() => void) | undefined;

beforeEach(() => {
  useChatTabs().clearAll();
  useAuthStore().me = { steam_id: "76561198000000001" } as any;

  const { openTab } = useChatTabs();
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
    id: REQUESTED,
    label: "Dana",
    instance: "direct",
    type: "direct",
    lobbyId: "76561198000000001:76561198000000002",
  });
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  useChatTabs().clearAll();
});

describe("ChatPanel", () => {
  it("opens on the room already asked for rather than the first one", async () => {
    const wrapper = await mountSuspended(ChatPanel, {
      props: { isSidebarOpen: true, isTabActive: true },
      global: { stubs: { ChatLobby: true, ChatParticipants: true } },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();

    expect(useChatTabs().activeTabId.value).toBe(REQUESTED);
  });
});
