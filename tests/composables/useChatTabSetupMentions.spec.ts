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
import { setPageChatFocus } from "~/composables/useChatPresence";
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

  it("clears a room's tags wherever it is marked read, the match page included", () => {
    room("match", matchId).live(line("match-tag", 5, [ME]));
    room("match_team", `${matchId}:lineup-1`).live(line("team-tag", 6, [ME]));
    room("tournament", tournamentId).live(line("cup-tag", 7, [ME]));

    socket.markLobbyRead("match_team", `${matchId}:lineup-1`);
    expect(mentions(`match:${matchId}`)).toBe(1);

    socket.markLobbyRead("match", matchId);
    expect(mentions(`match:${matchId}`)).toBe(0);
    expect(mentions(tournamentTab())).toBe(1);
  });

  it("counts nothing while a page shows the room", () => {
    setPageChatFocus(chatThreadKey("match", matchId));

    try {
      room("match", matchId).live(line("seen-on-page", 5, [ME]));
    } finally {
      setPageChatFocus(null);
    }

    expect(mentions(`match:${matchId}`)).toBe(0);
  });

  it("forgets a recount queued for a tab that has since closed", async () => {
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

    room("tournament", tournamentId).history([line("unread-tag", 8, [ME])]);
    useChatTabs().closeTab(tournamentTab());
    answer({ threads: [] });
    await flushPromises();

    expect(useChatTabs().unreadCounts.value).not.toHaveProperty(
      tournamentTab(),
    );
    expect(useChatTabs().mentionCounts.value).not.toHaveProperty(
      tournamentTab(),
    );
  });

  it("forgets a team room recount queued for a match tab that has since closed", async () => {
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

    room("match_team", `${matchId}:lineup-1`).history([
      line("team-tag", 8, [ME]),
    ]);
    useChatTabs().closeTab(`match:${matchId}`);
    answer({ threads: [] });
    await flushPromises();

    expect(useChatTabs().mentionCounts.value).not.toHaveProperty(
      `match:${matchId}`,
    );
  });

  it("lets the chat hub in front win over a page's claim", () => {
    setPageChatFocus(chatThreadKey("match", matchId));
    useChatTabs().setActiveTab(tournamentTab());
    useRightSidebar().setRightSidebarOpen(true);
    setActiveHub("chat");

    try {
      room("match", matchId).live(line("behind-the-hub", 5, [ME]));
    } finally {
      setPageChatFocus(null);
    }

    expect(mentions(`match:${matchId}`)).toBe(1);
  });

  it("lets a phone's open hub sheet win over a page's claim", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener() {},
        removeEventListener() {},
      })),
    );
    setPageChatFocus(chatThreadKey("match", matchId));
    useRightSidebar().setRightSidebarOpen(true);
    setActiveHub("social");

    try {
      room("match_team", `${matchId}:lineup-1`).live(
        line("under-the-sheet", 5, [ME]),
      );
    } finally {
      setPageChatFocus(null);
    }

    expect(mentions(`match:${matchId}`)).toBe(1);
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

describe("useChatTabSetup with an older page", () => {
  let restore: () => void;
  let sent: () => Array<{ event: string; data: any }>;

  beforeEach(() => {
    const send = vi.fn();
    const held = {
      connected: (socket as any).connected,
      connection: (socket as any).connection,
    };
    (socket as any).connected = true;
    (socket as any).connection = { send };
    sent = () => send.mock.calls.map(([raw]) => JSON.parse(raw));
    restore = () => Object.assign(socket as any, held);
  });

  afterEach(() => {
    restore();
  });

  it("counts nothing in it: an older page is read already, tags and all", async () => {
    socket.emit(`lobby:tournament:${tournamentId}:messages`, {
      messages: [line("new-tag", 5, [ME]), line("chatter", 6)],
      more: true,
      cursor: "cursor-5",
    });
    expect(unread(tournamentTab())).toBe(2);
    expect(mentions(tournamentTab())).toBe(1);

    const handle = socket.joinLobby("spec", "tournament", tournamentId);
    const loaded = handle.loadOlder();
    const [request] = sent().filter(({ event }) => event === "lobby:history");
    socket.emit(`lobby:tournament:${tournamentId}:history`, {
      messages: [line("older-tag", 2, [ME]), line("older", 3)],
      more: false,
      cursor: "cursor-2",
      requestId: request.data.requestId,
    });
    await loaded;
    handle.leave();

    expect(unread(tournamentTab())).toBe(2);
    expect(mentions(tournamentTab())).toBe(1);
  });
});
