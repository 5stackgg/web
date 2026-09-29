import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useChatBlocks } from "~/composables/useChatBlocks";
import { useChatTabs } from "~/composables/useChatTabs";
import { useChatTabSetup } from "~/composables/useChatTabSetup";
import { directRoomId, directTabId } from "~/composables/useDirectMessages";
import { useIncomingDirectMessages } from "~/composables/useIncomingDirectMessages";
import { setActiveHub } from "~/composables/useHubState";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { chatThreadKey } from "~/utilities/chatThread";
import socket, { type LobbyMessage } from "~/web-sockets/Socket";

const graphql = vi.hoisted(() => ({
  observers: [] as Array<{ observer: any; closed: boolean }>,
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    mutate: vi.fn(),
    subscribe: () => ({
      subscribe(observer: any) {
        const entry = { observer, closed: false };
        graphql.observers.push(entry);
        return {
          unsubscribe() {
            entry.closed = true;
          },
        };
      },
    }),
  }),
}));

const ME = "76561198000000001";
const DANA = "76561198000000002";
const EVAN = "76561198000000003";

const at = (minute: number) =>
  new Date(Date.UTC(2026, 8, 28, 12, minute)).toISOString();

const line = (id: string, minute: number, from: string): LobbyMessage => ({
  id,
  message: `line ${id}`,
  timestamp: at(minute),
  from: { steam_id: from },
});

const ids = (messages: readonly LobbyMessage[]) =>
  messages.map((message) => message.id);

function setBlocks(...steamIds: string[]) {
  const open = graphql.observers.filter((entry) => !entry.closed);
  expect(open).toHaveLength(1);
  open[0].observer.next({
    data: {
      player_blocks: steamIds.map((steamId) => ({
        blocked_steam_id: steamId,
        created_at: at(0),
        blocked: { steam_id: steamId, name: steamId, avatar_url: null },
      })),
    },
  });
}

function connect() {
  const send = vi.fn();
  (socket as any).connected = true;
  (socket as any).connection = { send };
  return send;
}

function disconnect() {
  (socket as any).connected = false;
  (socket as any).connection = undefined;
}

function sentJoins(send: ReturnType<typeof vi.fn>) {
  return send.mock.calls
    .map(([payload]) => JSON.parse(payload))
    .filter(({ event }) => event === "lobby:join")
    .map(({ data }) => `${data.type}:${data.id}`);
}

let counter = 0;
let lobbyId = "";
let groupTab = "";
let groupRoom = "";
let dmRoomId = "";
let dmTab = "";
let unmount: (() => void) | undefined;

const unread = (tabId: string) => useChatTabs().unreadCounts.value[tabId];
const hasTab = (tabId: string) =>
  useChatTabs().tabs.value.some((tab) => tab.id === tabId);
const groupMessages = () => socket.lobbyMessages("matchmaking", lobbyId);

async function mount(setup: () => void) {
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        setup();
        return () => h("div");
      },
    }),
  );
  unmount = () => wrapper.unmount();
  await flushPromises();
}

beforeEach(async () => {
  lobbyId = `chat-blocks-${++counter}`;
  groupTab = `matchmaking:${lobbyId}`;
  groupRoom = `lobby:matchmaking:${lobbyId}`;
  dmRoomId = directRoomId(ME, DANA);
  dmTab = directTabId(dmRoomId);

  vi.spyOn(console, "info").mockImplementation(() => {});
  useChatTabs().clearAll();
  useMatchLobbyStore().chatTournaments = [];
  useMatchLobbyStore().myMatches = [];
  useRightSidebar().setRightSidebarOpen(false);
  vi.stubGlobal(
    "$fetch",
    vi.fn().mockResolvedValue({
      threads: [
        { thread: chatThreadKey("matchmaking", lobbyId), lastReadAt: at(1) },
      ],
      conversations: [],
    }),
  );
  useAuthStore().me = {
    steam_id: ME,
    current_lobby_id: lobbyId,
    role: "user",
  } as any;

  await mount(() => {
    useChatTabSetup();
    useIncomingDirectMessages();
    useChatBlocks();
  });

  setBlocks();

  useChatTabs().openTab({
    id: dmTab,
    label: "Dana",
    instance: "direct",
    type: "direct",
    lobbyId: dmRoomId,
    steamId: DANA,
    activate: false,
  });
  useChatTabs().setUnread(dmTab, 2);
  await flushPromises();

  socket.emit(`${groupRoom}:messages`, {
    messages: [
      line("read", 0, EVAN),
      line("dana-1", 2, DANA),
      line("dana-2", 3, DANA),
      line("evan", 4, EVAN),
    ],
  });
  socket.emit(`lobby:direct:${dmRoomId}:messages`, {
    messages: [
      line("dm-1", 2, DANA),
      line("dm-2", 3, DANA),
      line("dm-mine", 4, ME),
    ],
  });
});

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  await flushPromises();
  socket.setHiddenAuthors([]);
  disconnect();
  useChatTabs().clearAll();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useChatBlocks", () => {
  it("hides a newly blocked player's lines, uncounts them and closes the conversation", async () => {
    expect(unread(groupTab)).toBe(3);
    expect(unread(dmTab)).toBe(2);

    setBlocks(DANA);
    await flushPromises();

    expect(ids(groupMessages())).toEqual(["read", "evan"]);
    expect(unread(groupTab)).toBe(1);
    expect(hasTab(dmTab)).toBe(false);
    expect(unread(dmTab)).toBeUndefined();
  });

  it("drops a blocked player's live line without counting it", async () => {
    setBlocks(DANA);
    await flushPromises();

    socket.emit(`${groupRoom}:chat`, line("dana-3", 5, DANA));
    socket.emit(`${groupRoom}:chat`, line("evan-2", 6, EVAN));

    expect(ids(groupMessages())).toEqual(["read", "evan", "evan-2"]);
    expect(unread(groupTab)).toBe(2);
  });

  it("ignores a reaction to a line it hid, and hides their reactions", async () => {
    setBlocks(DANA);
    await flushPromises();

    socket.emit(`${groupRoom}:reaction`, {
      id: "dana-1",
      reactions: { heart: [EVAN] },
    });
    socket.emit(`${groupRoom}:reaction`, {
      id: "evan",
      reactions: { heart: [DANA], fire: [DANA, ME] },
    });

    expect(ids(groupMessages())).toEqual(["read", "evan"]);
    expect(groupMessages().map((message) => message.reactions)).toEqual([
      undefined,
      { fire: [ME] },
    ]);
  });

  it("never reopens the conversation from a message already on its way", async () => {
    setBlocks(DANA);
    await flushPromises();

    socket.emit("direct:incoming", {
      roomId: dmRoomId,
      from: { steam_id: DANA, name: "Dana" },
    });

    expect(hasTab(dmTab)).toBe(false);
  });

  it("asks the open rooms for their history again on an unblock", async () => {
    setBlocks(DANA);
    await flushPromises();
    const send = connect();

    setBlocks();
    await flushPromises();

    expect(sentJoins(send)).toContain(`matchmaking:${lobbyId}`);
    expect(hasTab(dmTab)).toBe(false);

    socket.emit(`${groupRoom}:messages`, {
      messages: [
        line("read", 0, EVAN),
        line("dana-1", 2, DANA),
        line("dana-2", 3, DANA),
        line("evan", 4, EVAN),
      ],
    });
    expect(ids(groupMessages())).toEqual(["read", "dana-1", "dana-2", "evan"]);
  });

  it("hides a second player blocked on top of the first", async () => {
    setBlocks(EVAN);
    await flushPromises();

    setBlocks(EVAN, DANA);
    await flushPromises();

    expect(ids(groupMessages())).toEqual([]);
    expect(unread(groupTab)).toBe(0);
    expect(hasTab(dmTab)).toBe(false);
  });

  it("leaves the badge of the room on screen clear when an unblock brings lines back", async () => {
    useChatTabs().setActiveTab(groupTab);
    useRightSidebar().setRightSidebarOpen(true);
    setActiveHub("chat");
    await flushPromises();
    useChatTabs().resetUnread(groupTab);

    setBlocks(DANA);
    await flushPromises();
    setBlocks();
    await flushPromises();

    socket.emit(`${groupRoom}:messages`, {
      messages: [
        line("read", 0, EVAN),
        line("dana-1", 2, DANA),
        line("dana-2", 3, DANA),
        line("evan", 4, EVAN),
      ],
    });

    expect(unread(groupTab)).toBe(0);
  });

  it("still hears an unblock made while it was unmounted", async () => {
    setBlocks(DANA);
    await flushPromises();
    unmount?.();

    setBlocks();
    await flushPromises();
    expect(socket.hidesAuthor(DANA)).toBe(true);

    await mount(() => {
      useChatBlocks();
    });

    expect(socket.hidesAuthor(DANA)).toBe(false);
  });

  it("does not read signing out as unblocking everyone", async () => {
    setBlocks(DANA);
    await flushPromises();
    const send = connect();

    useAuthStore().me = undefined;
    await flushPromises();

    expect(sentJoins(send)).toEqual([]);
    expect(socket.hidesAuthor(DANA)).toBe(true);
  });
});

describe("useChatBlocks for a moderator", () => {
  function signInAs(role: string) {
    useAuthStore().me = {
      steam_id: ME,
      current_lobby_id: lobbyId,
      role,
    } as any;
  }

  const dmMessages = () => socket.lobbyMessages("direct", dmRoomId);

  it("keeps a blocked player's lines, live lines and reactions in group rooms", async () => {
    signInAs("moderator");
    const popout = socket.joinLobby("popout", "direct", dmRoomId);
    await flushPromises();

    setBlocks(DANA);
    await flushPromises();

    expect(ids(groupMessages())).toEqual(["read", "dana-1", "dana-2", "evan"]);
    expect(unread(groupTab)).toBe(3);

    socket.emit(`${groupRoom}:chat`, line("dana-3", 5, DANA));
    socket.emit(`${groupRoom}:reaction`, {
      id: "evan",
      reactions: { heart: [DANA], fire: [DANA, ME] },
    });

    expect(ids(groupMessages())).toEqual([
      "read",
      "dana-1",
      "dana-2",
      "evan",
      "dana-3",
    ]);
    expect(groupMessages()[3].reactions).toEqual({
      heart: [DANA],
      fire: [DANA, ME],
    });

    expect(hasTab(dmTab)).toBe(false);
    expect(ids(dmMessages())).toEqual(["dm-mine"]);
    popout.leave();
  });

  it("still closes the conversation and ignores a message on its way", async () => {
    signInAs("administrator");
    await flushPromises();

    setBlocks(DANA);
    await flushPromises();

    socket.emit("direct:incoming", {
      roomId: dmRoomId,
      from: { steam_id: DANA, name: "Dana" },
    });

    expect(hasTab(dmTab)).toBe(false);
    expect(socket.hidesAuthor(DANA)).toBe(true);
  });

  it("hides the lines once the viewer is no longer a moderator", async () => {
    signInAs("moderator");
    setBlocks(DANA);
    await flushPromises();
    expect(ids(groupMessages())).toEqual(["read", "dana-1", "dana-2", "evan"]);

    signInAs("user");
    await flushPromises();

    expect(ids(groupMessages())).toEqual(["read", "evan"]);
  });

  it("asks the group rooms for their history again on becoming a moderator", async () => {
    setBlocks(DANA);
    await flushPromises();
    expect(ids(groupMessages())).toEqual(["read", "evan"]);
    const send = connect();

    signInAs("moderator");
    await flushPromises();

    expect(sentJoins(send)).toContain(`matchmaking:${lobbyId}`);
    socket.emit(`${groupRoom}:messages`, {
      messages: [
        line("read", 0, EVAN),
        line("dana-1", 2, DANA),
        line("evan", 4, EVAN),
      ],
    });
    expect(ids(groupMessages())).toEqual(["read", "dana-1", "evan"]);
  });
});
