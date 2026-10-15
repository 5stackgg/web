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
import socket, { type ChatType, type LobbyMessage } from "~/web-sockets/Socket";

const ME = "76561198000000001";
const OTHER = "76561198000000002";
const THIRD = "76561198000000003";

let counter = 0;
let tournamentId = "";
let matchId = "";

const at = (minute: number) =>
  new Date(Date.UTC(2026, 9, 14, 12, minute)).toISOString();

const line = (
  id: string,
  minute: number,
  tagged: string[] = [],
  from = OTHER,
): LobbyMessage => ({
  id,
  message: `${tagged.map(() => "@someone").join(" ")} line ${id}`,
  timestamp: at(minute),
  from: { steam_id: from },
  mentions: tagged.map((steam_id) => ({ steam_id, name: "someone" })),
});

const room = (type: ChatType, id: string) => ({
  edited: (messageId: string, message: string) =>
    socket.emit(`lobby:${type}:${id}:edited`, {
      id: messageId,
      message,
      edited_at: at(30),
    }),
  history: (messages: LobbyMessage[]) =>
    socket.emit(`lobby:${type}:${id}:messages`, { messages }),
  live: (message: LobbyMessage) =>
    socket.emit(`lobby:${type}:${id}:chat`, message),
  deleted: (messageId: string) =>
    socket.emit(`lobby:${type}:${id}:deleted`, { id: messageId }),
});

const tournamentTab = () => `tournament:${tournamentId}`;
const mentions = (tabId: string) =>
  useChatTabs().mentionCounts.value[tabId] ?? 0;
const unread = (tabId: string) => useChatTabs().unreadCounts.value[tabId] ?? 0;

let unmount: (() => void) | undefined;

beforeEach(async () => {
  counter++;
  tournamentId = `tournament-mentions-${counter}`;
  matchId = `match-mentions-${counter}`;
  vi.spyOn(console, "info").mockImplementation(() => {});
  useChatTabs().clearAll();
  useMatchLobbyStore().chatTournaments = [{ id: tournamentId, name: "Cup" }];
  useMatchLobbyStore().myMatches = [
    {
      id: matchId,
      label: "A vs B",
      lineup_1: { id: "lineup-1", is_on_lineup: true },
      lineup_2: { id: "lineup-2", is_on_lineup: false },
    },
  ] as any;
  useRightSidebar().setRightSidebarOpen(false);
  useAuthStore().me = { steam_id: ME, role: "user" } as any;
  vi.stubGlobal(
    "$fetch",
    vi.fn().mockResolvedValue({
      threads: [
        { thread: chatThreadKey("tournament", tournamentId), lastReadAt: at(1) },
        { thread: chatThreadKey("match", matchId), lastReadAt: at(1) },
        {
          thread: chatThreadKey("match_team", `${matchId}:lineup-1`),
          lastReadAt: at(1),
        },
      ],
    }),
  );

  useChatTabs().openTab({
    id: `match:${matchId}`,
    label: "A vs B",
    instance: "match",
    type: "match",
    lobbyId: matchId,
    activate: false,
  });

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

describe("useChatTabSetup mentions", () => {
  it("counts the unread lines that tag me in a room's history", () => {
    room("tournament", tournamentId).history([
      line("read-tag", 0, [ME]),
      line("unread-tag", 2, [ME, THIRD]),
      line("someone-else", 3, [THIRD]),
      line("chatter", 4),
    ]);

    expect(mentions(tournamentTab())).toBe(1);
    expect(unread(tournamentTab())).toBe(3);
  });

  it("counts a live line that tags me, once however often it arrives", () => {
    const tagged = line("live-tag", 5, [ME]);

    room("tournament", tournamentId).live(tagged);
    room("tournament", tournamentId).live({ ...tagged });
    room("tournament", tournamentId).live(line("chatter", 6));

    expect(mentions(tournamentTab())).toBe(1);
  });

  it("counts a tag in a match room, whose chatter is never counted", () => {
    room("match", matchId).live(line("match-tag", 5, [ME]));
    room("match", matchId).live(line("match-chatter", 6));
    room("match", matchId).history([
      line("match-tag", 5, [ME]),
      line("match-history-tag", 7, [ME]),
    ]);

    expect(mentions(`match:${matchId}`)).toBe(2);
    expect(unread(`match:${matchId}`)).toBe(0);
  });

  it("counts a tag in my side's team room on the match tab", () => {
    const team = room("match_team", `${matchId}:lineup-1`);

    team.live(line("team-tag", 5, [ME]));
    team.history([line("team-tag", 5, [ME]), line("old-team-tag", 0, [ME])]);
    room("match", matchId).live(line("match-tag", 6, [ME]));

    expect(mentions(`match:${matchId}`)).toBe(2);

    useChatTabs().resetUnread(`match:${matchId}`);

    expect(mentions(`match:${matchId}`)).toBe(0);
  });

  it("takes a tag off when an edit removes it", () => {
    room("tournament", tournamentId).live(line("tag", 5, [ME, THIRD]));

    room("tournament", tournamentId).edited("tag", "line tag, no one tagged");

    expect(mentions(tournamentTab())).toBe(0);
  });

  it("waits for the read state before counting tags from history", async () => {
    unmount?.();
    let answer: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "$fetch",
      vi.fn(() => new Promise((resolve) => (answer = resolve))),
    );
    const wrapper = await mountSuspended(
      defineComponent({
        setup() {
          useChatTabSetup();
          return () => h("div");
        },
      }),
    );
    unmount = () => wrapper.unmount();

    room("tournament", tournamentId).history([
      line("read-tag", 2, [ME]),
      line("unread-tag", 8, [ME]),
    ]);

    expect(mentions(tournamentTab())).toBe(0);

    answer({
      threads: [
        { thread: chatThreadKey("tournament", tournamentId), lastReadAt: at(5) },
      ],
    });
    await flushPromises();

    expect(mentions(tournamentTab())).toBe(1);
  });

  it("never counts a line of my own", () => {
    room("tournament", tournamentId).live(line("mine", 5, [ME], ME));

    expect(mentions(tournamentTab())).toBe(0);
  });

  it("takes a deleted line's tag off", () => {
    room("tournament", tournamentId).live(line("tag", 5, [ME]));
    room("tournament", tournamentId).deleted("tag");

    expect(mentions(tournamentTab())).toBe(0);
  });

  it("clears the tags with the unread when the room is read", () => {
    room("tournament", tournamentId).live(line("tag", 5, [ME]));

    useChatTabs().resetUnread(tournamentTab());

    expect(mentions(tournamentTab())).toBe(0);
  });

  it("counts nothing for a room on screen", () => {
    useChatTabs().setActiveTab(tournamentTab());
    useRightSidebar().setRightSidebarOpen(true);
    setActiveHub("chat");

    room("tournament", tournamentId).live(line("tag", 5, [ME]));
    room("tournament", tournamentId).history([line("old-tag", 2, [ME])]);

    expect(mentions(tournamentTab())).toBe(0);
  });
});
