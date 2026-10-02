import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useChatTabs } from "~/composables/useChatTabs";
import { useChatTabSetup } from "~/composables/useChatTabSetup";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { chatThreadKey } from "~/utilities/chatThread";
import { e_player_roles_enum } from "~/generated/zeus";
import socket, { type ChatType, type LobbyMessage } from "~/web-sockets/Socket";

const ME = "76561198000000001";
const OTHER = "76561198000000002";

let counter = 0;
let matchId = "";
let lobbyId = "";
let teamLobbyId = "";
let tournamentId = "";

const at = (minute: number) =>
  new Date(Date.UTC(2026, 9, 2, 12, minute)).toISOString();

const line = (id: string, minute: number): LobbyMessage => ({
  id,
  message: `line ${id}`,
  timestamp: at(minute),
  from: { steam_id: OTHER },
});

const history = () => [
  line("read", 0),
  line("unread-1", 2),
  line("unread-2", 3),
];

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

function room(type: ChatType, id: string) {
  return {
    history: () =>
      socket.emit(`lobby:${type}:${id}:messages`, { messages: history() }),
    live: (messageId: string) =>
      socket.emit(`lobby:${type}:${id}:chat`, line(messageId, 5)),
  };
}

const unread = (tabId: string) =>
  useChatTabs().unreadCounts.value[tabId] ?? 0;

beforeEach(async () => {
  counter++;
  matchId = `match-chat-${counter}`;
  lobbyId = `lobby-chat-${counter}`;
  teamLobbyId = `${matchId}:lineup-1`;
  tournamentId = `tournament-chat-${counter}`;
  vi.spyOn(console, "info").mockImplementation(() => {});
  useChatTabs().clearAll();
  useMatchLobbyStore().chatTournaments = [{ id: tournamentId, name: "Cup" }];
  useMatchLobbyStore().myMatches = [{ id: matchId, label: "A vs B" }] as any;
  useRightSidebar().setRightSidebarOpen(false);
  useAuthStore().me = {
    steam_id: ME,
    current_lobby_id: lobbyId,
    role: e_player_roles_enum.match_organizer,
  } as any;
  vi.stubGlobal(
    "$fetch",
    vi.fn().mockResolvedValue({
      threads: [
        ["match", matchId],
        ["match_team", teamLobbyId],
        ["matchmaking", lobbyId],
        ["organizers", "organizers"],
        ["tournament", tournamentId],
      ].map(([type, id]) => ({
        thread: chatThreadKey(type as ChatType, id),
        lastReadAt: at(1),
      })),
    }),
  );

  useChatTabs().openTab({
    id: `match_team:${teamLobbyId}`,
    label: "Team",
    instance: "match_team",
    type: "match_team",
    lobbyId: teamLobbyId,
    activate: false,
  });

  await mountSetup();
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  useMatchLobbyStore().chatTournaments = [];
  useMatchLobbyStore().myMatches = [];
  useChatTabs().clearAll();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("live match chat and the hub unread badge", () => {
  it("never counts a live match chat line", () => {
    room("match", matchId).live("all-chat");
    room("match_team", teamLobbyId).live("team-chat");

    expect(unread(`match:${matchId}`)).toBe(0);
    expect(unread(`match_team:${teamLobbyId}`)).toBe(0);
    expect(useChatTabs().totalUnread.value).toBe(0);
  });

  it("never counts match chat history past the read cursor", () => {
    room("match", matchId).history();
    room("match_team", teamLobbyId).history();

    expect(unread(`match:${matchId}`)).toBe(0);
    expect(unread(`match_team:${teamLobbyId}`)).toBe(0);
    expect(useChatTabs().totalUnread.value).toBe(0);
  });

  it("still counts lobby, tournament and organizer chat", () => {
    room("matchmaking", lobbyId).history();
    room("matchmaking", lobbyId).live("lobby-live");
    room("tournament", tournamentId).history();
    room("organizers", "organizers").live("organizers-live");

    expect(unread(`matchmaking:${lobbyId}`)).toBe(3);
    expect(unread(`tournament:${tournamentId}`)).toBe(2);
    expect(unread("organizers")).toBe(1);
    expect(useChatTabs().totalUnread.value).toBe(6);
  });
});
