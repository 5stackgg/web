import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useChatTabs } from "~/composables/useChatTabs";
import { useChatTabSetup } from "~/composables/useChatTabSetup";
import {
  useIncomingDirectMessages,
} from "~/composables/useIncomingDirectMessages";
import { directTabId } from "~/composables/useDirectMessages";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import {
  resetChatRoomSettings,
  syncChatRoomSettings,
} from "~/composables/useChatRoomSettings";
import { chatThreadKey } from "~/utilities/chatThread";
import socket, { type LobbyMessage } from "~/web-sockets/Socket";
import { fakeRoomSettingsClient, room } from "../helpers/fakeRoomSettings";

const { signalChat, fake } = vi.hoisted(() => ({
  signalChat: vi.fn(),
  fake: { api: null as any },
}));

vi.mock("~/composables/useTabFlash", () => ({
  useTabFlash: () => ({ signalChat, signal: vi.fn(), clear: vi.fn() }),
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => fake.api.client,
}));

const ME = "76561198000000001";
const OTHER = "76561198000000002";
const DIRECT_ROOM = `${ME}:${OTHER}`;

let counter = 0;
let tournamentId = "";
let unmount: (() => void) | undefined;

const at = (minute: number) =>
  new Date(Date.UTC(2026, 9, 15, 12, minute)).toISOString();

const line = (id: string, tagged = false): LobbyMessage => ({
  id: `${tournamentId}-${id}`,
  message: tagged ? "@someone line" : `line ${id}`,
  timestamp: at(5),
  from: { steam_id: OTHER },
  ...(tagged ? { mentions: [{ steam_id: ME, name: "someone" }] } : {}),
});

const tournamentTab = () => `tournament:${tournamentId}`;
const live = (message: LobbyMessage) =>
  socket.emit(`lobby:tournament:${tournamentId}:chat`, message);

beforeEach(async () => {
  tournamentId = `tournament-mute-${++counter}`;
  fake.api = fakeRoomSettingsClient();
  signalChat.mockClear();
  vi.spyOn(console, "info").mockImplementation(() => {});
  useChatTabs().clearAll();
  useMatchLobbyStore().chatTournaments = [{ id: tournamentId, name: "Cup" }];
  useRightSidebar().setRightSidebarOpen(false);
  useAuthStore().me = { steam_id: ME, role: "user" } as any;
  vi.stubGlobal(
    "$fetch",
    vi.fn().mockResolvedValue({
      threads: [
        {
          thread: chatThreadKey("tournament", tournamentId),
          lastReadAt: at(1),
        },
      ],
      conversations: [],
    }),
  );
  await syncChatRoomSettings(ME);

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
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  resetChatRoomSettings();
  useAuthStore().me = undefined;
  useMatchLobbyStore().chatTournaments = [];
  useChatTabs().clearAll();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useChatTabSetup in a room the player quieted", () => {
  it("flashes the tab for a room left alone", () => {
    live(line("a"));

    expect(signalChat).toHaveBeenCalledTimes(1);
  });

  it("still counts a muted room's chatter, without flashing the tab for it", () => {
    fake.api.rooms([
      room(chatThreadKey("tournament", tournamentId), { muted: true }),
    ]);

    live(line("a"));
    live(line("b"));

    expect(signalChat).not.toHaveBeenCalled();
    expect(useChatTabs().unreadCounts.value[tournamentTab()]).toBe(2);
  });

  it("flashes the tab for a tag in a muted room", () => {
    fake.api.rooms([
      room(chatThreadKey("tournament", tournamentId), { muted: true }),
    ]);

    live(line("a", true));

    expect(signalChat).toHaveBeenCalledTimes(1);
    expect(useChatTabs().mentionCounts.value[tournamentTab()]).toBe(1);
  });

  it("flashes for nothing in a room set to nothing, tags included", () => {
    fake.api.rooms([
      room(chatThreadKey("tournament", tournamentId), { notify: "nothing" }),
    ]);

    live(line("a"));
    live(line("b", true));

    expect(signalChat).not.toHaveBeenCalled();
  });

  it("keeps a muted conversation's first message from flashing the tab", async () => {
    fake.api.rooms([
      room(chatThreadKey("direct", DIRECT_ROOM), { muted: true }),
    ]);

    socket.emit("direct:incoming", {
      roomId: DIRECT_ROOM,
      from: { steam_id: OTHER },
      message: { ...line("dm"), id: "dm-1" },
    });
    await flushPromises();

    expect(signalChat).not.toHaveBeenCalled();
    expect(useChatTabs().unreadCounts.value[directTabId(DIRECT_ROOM)]).toBe(1);
  });
});
