import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import ChatMessage from "~/components/chat/ChatMessage.vue";
import { useAuthStore } from "~/stores/AuthStore";
import socket, { type LobbyMessage } from "~/web-sockets/Socket";

const { playNotificationSound } = vi.hoisted(() => ({
  playNotificationSound: vi.fn(),
}));

vi.mock("~/composables/useSound", () => ({
  useSound: () => ({ playNotificationSound }),
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

const ME = "76561198000000001";
const OTHER = "76561198000000002";
const GAGGED = "You're gagged and can't send chat messages.";
const TRIGGER = 'button[aria-label="Message actions"]';

const line = (id: string, minute: number, from = OTHER): LobbyMessage => ({
  id,
  message: `line ${id}`,
  timestamp: new Date(Date.UTC(2026, 8, 28, 12, minute)).toISOString(),
  from: { steam_id: from, name: `Player ${from}` },
});

let lobbyCounter = 0;
let unmount: (() => void) | undefined;

function signIn(me: Record<string, unknown>) {
  useAuthStore().me = { steam_id: ME, role: "user", ...me } as any;
}

async function mountLobby(props: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(ChatLobby, {
    props: {
      instance: "chat-lobby-spec",
      type: "match",
      lobbyId: `match-${++lobbyCounter}`,
      playNotificationSound: false,
      ...props,
    },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.restoreAllMocks();
});

describe("ChatLobby gag", () => {
  it("swaps the composer for the gag hint in a group room", async () => {
    signIn({ is_gagged: true });

    const wrapper = await mountLobby();

    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(wrapper.text()).toContain(GAGGED);
  });

  it("leaves a direct conversation alone", async () => {
    signIn({ is_gagged: true });

    const wrapper = await mountLobby({
      type: "direct",
      lobbyId: `${ME}:${OTHER}`,
    });

    expect(wrapper.find("textarea").exists()).toBe(true);
    expect(wrapper.text()).not.toContain(GAGGED);
  });

  it("keeps the room's own reason when the room was read-only anyway", async () => {
    signIn({ is_gagged: true });

    const wrapper = await mountLobby({
      canSend: false,
      readonlyHint: "Only players can chat here.",
    });

    expect(wrapper.text()).toContain("Only players can chat here.");
    expect(wrapper.text()).not.toContain(GAGGED);
  });

  it("offers the composer to a player who isn't gagged", async () => {
    signIn({ is_gagged: false });

    const wrapper = await mountLobby();

    expect(wrapper.find("textarea").exists()).toBe(true);
  });
});

describe("ChatLobby moderation", () => {
  async function mountWithHistory(
    type: string,
    lobbyId: string,
    messages: LobbyMessage[],
    props: Record<string, unknown> = {},
  ) {
    const wrapper = await mountLobby({ type, lobbyId, ...props });
    socket.emit(`lobby:${type}:${lobbyId}:messages`, { messages });
    await flushPromises();
    return wrapper;
  }

  it("offers a moderator message actions in a group room", async () => {
    signIn({ role: "moderator" });

    const wrapper = await mountWithHistory("match", "moderated-match", [
      line("a", 0),
    ]);

    expect(wrapper.find(TRIGGER).exists()).toBe(true);
  });

  async function menuItems(wrapper: Awaited<ReturnType<typeof mountLobby>>) {
    await wrapper.get(TRIGGER).trigger("keydown", { key: "Enter" });
    await flushPromises();

    return Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).map((item) => item.textContent?.trim());
  }

  it("offers a moderator no delete in a direct conversation", async () => {
    signIn({ role: "administrator" });

    const wrapper = await mountWithHistory("direct", `${ME}:${OTHER}`, [
      line("a", 0),
    ]);

    expect(wrapper.text()).toContain("line a");
    expect(await menuItems(wrapper)).toEqual(["Add Reaction"]);
  });

  it("offers a streamer a reaction and nothing else", async () => {
    signIn({ role: "streamer" });

    const wrapper = await mountWithHistory("match", "streamed-match", [
      line("a", 0),
    ]);

    expect(await menuItems(wrapper)).toEqual(["Add Reaction"]);
  });

  it("offers nothing where the room is read-only", async () => {
    signIn({ role: "user" });

    const wrapper = await mountWithHistory(
      "match",
      "read-only-match",
      [line("a", 0)],
      { canSend: false },
    );

    expect(wrapper.text()).toContain("line a");
    expect(wrapper.find(TRIGGER).exists()).toBe(false);
  });

  it("points a team line at the team room on a merged panel", async () => {
    signIn({ role: "moderator" });

    const wrapper = await mountLobby({
      lobbyId: "merged-match",
      teamLobbyId: "merged-match:lineup-1",
    });
    socket.emit("lobby:match:merged-match:messages", {
      messages: [line("everyone-line", 0)],
    });
    socket.emit("lobby:match_team:merged-match:lineup-1:messages", {
      messages: [line("team-line", 1)],
    });
    await flushPromises();

    const rows = wrapper.findAllComponents(ChatMessage);

    expect(
      rows.map((row) => [row.props("message").id, row.props("room")]),
    ).toEqual([
      ["everyone-line", { type: "match", id: "merged-match" }],
      ["team-line", { type: "match_team", id: "merged-match:lineup-1" }],
    ]);
    expect(wrapper.findAll(TRIGGER)).toHaveLength(2);
  });

  it("counts the other room's lines when a merged line above the New line goes", async () => {
    signIn({ role: "user" });

    const wrapper = await mountLobby({
      lobbyId: "merged-divider",
      teamLobbyId: "merged-divider:lineup-1",
    });
    socket.emit("lobby:match:merged-divider:messages", {
      messages: [line("e1", 0), line("e2", 2), line("e3", 4)],
    });
    socket.emit("lobby:match_team:merged-divider:lineup-1:messages", {
      messages: [line("t1", 1), line("t2", 3)],
    });
    await flushPromises();

    const lobby = wrapper.vm as any;
    lobby.lastReadMessageCount = 4;

    socket.emit("lobby:match_team:merged-divider:lineup-1:deleted", {
      id: "t2",
    });
    await flushPromises();

    expect(lobby.lastReadMessageCount).toBe(3);

    socket.emit("lobby:match:merged-divider:deleted", { id: "e3" });
    await flushPromises();

    expect(lobby.lastReadMessageCount).toBe(3);
  });

  it("counts only what the filter shows when a merged line goes", async () => {
    signIn({ role: "user" });

    const wrapper = await mountLobby({
      lobbyId: "filtered-divider",
      teamLobbyId: "filtered-divider:lineup-1",
    });
    socket.emit("lobby:match:filtered-divider:messages", {
      messages: [line("e1", 0), line("e2", 2), line("e3", 4)],
    });
    socket.emit("lobby:match_team:filtered-divider:lineup-1:messages", {
      messages: [line("t1", 1), line("t2", 3)],
    });
    await flushPromises();

    const lobby = wrapper.vm as any;
    lobby.viewFilter = "everyone";
    lobby.lastReadMessageCount = 2;
    await flushPromises();

    socket.emit("lobby:match_team:filtered-divider:lineup-1:deleted", {
      id: "t1",
    });
    await flushPromises();

    expect(lobby.lastReadMessageCount).toBe(2);

    socket.emit("lobby:match:filtered-divider:deleted", { id: "e2" });
    await flushPromises();

    expect(lobby.lastReadMessageCount).toBe(1);
  });

  it("clears a hidden room's mark when the line it stood for goes", async () => {
    signIn({ role: "user" });

    const wrapper = await mountLobby({
      lobbyId: "unseen-match",
      teamLobbyId: "unseen-match:lineup-1",
    });
    const lobby = wrapper.vm as any;
    lobby.viewFilter = "everyone";
    await flushPromises();

    socket.emit("lobby:match_team:unseen-match:lineup-1:chat", line("t1", 1));
    await flushPromises();

    expect(lobby.unseenFor("team")).toBe(1);

    socket.emit("lobby:match_team:unseen-match:lineup-1:deleted", {
      id: "t1",
    });
    await flushPromises();

    expect(lobby.unseenFor("team")).toBe(0);
    expect(lobby.unseenFor("all")).toBe(0);
  });

  it("keeps the New line on the same message when a read line above it goes", async () => {
    signIn({ role: "user" });

    const wrapper = await mountWithHistory(
      "match",
      "divider-match",
      [line("a", 0), line("b", 1), line("c", 2), line("d", 3)],
      { isGlobalContext: true },
    );
    const lobby = wrapper.vm as any;
    lobby.lastReadMessageCount = 2;

    socket.emit("lobby:match:divider-match:deleted", { id: "a" });
    await flushPromises();

    expect(lobby.messages.map((m: LobbyMessage) => m.id)).toEqual([
      "b",
      "c",
      "d",
    ]);
    expect(lobby.lastReadMessageCount).toBe(1);

    socket.emit("lobby:match:divider-match:deleted", { id: "c" });
    await flushPromises();

    expect(lobby.lastReadMessageCount).toBe(1);
  });
});

describe("ChatLobby blocked authors", () => {
  const THIRD = "76561198000000003";

  afterEach(() => {
    socket.setHiddenAuthors([]);
    playNotificationSound.mockClear();
  });

  it("stays silent for a blocked player's live line", async () => {
    signIn({ role: "user" });

    const wrapper = await mountLobby({
      lobbyId: "blocked-live",
      playNotificationSound: true,
    });
    socket.setHiddenAuthors([OTHER]);

    socket.emit("lobby:match:blocked-live:chat", line("hidden", 0));
    await flushPromises();

    expect(playNotificationSound).not.toHaveBeenCalled();
    expect(wrapper.emitted("message-received")).toBeUndefined();
    expect(wrapper.text()).not.toContain("line hidden");

    socket.emit("lobby:match:blocked-live:chat", line("shown", 1, THIRD));
    await flushPromises();

    expect(playNotificationSound).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("message-received")).toHaveLength(1);
    expect(wrapper.text()).toContain("line shown");
  });

  it("keeps the New line on the same message when a blocked player's lines go", async () => {
    signIn({ role: "user" });

    const wrapper = await mountLobby({
      lobbyId: "blocked-divider",
      isGlobalContext: true,
    });
    socket.emit("lobby:match:blocked-divider:messages", {
      messages: [
        line("a", 0),
        line("b", 1, THIRD),
        line("c", 2),
        line("d", 3, THIRD),
        line("e", 4),
      ],
    });
    await flushPromises();

    const lobby = wrapper.vm as any;
    lobby.lastReadMessageCount = 4;

    socket.setHiddenAuthors([OTHER]);
    await flushPromises();

    expect(lobby.messages.map((m: LobbyMessage) => m.id)).toEqual(["b", "d"]);
    expect(lobby.lastReadMessageCount).toBe(2);
    expect(wrapper.text()).not.toContain("line a");
  });

  it("keeps the New line in place when both merged rooms lose their lines", async () => {
    signIn({ role: "user" });

    const wrapper = await mountLobby({
      lobbyId: "blocked-merged",
      teamLobbyId: "blocked-merged:lineup-1",
    });
    socket.emit("lobby:match:blocked-merged:messages", {
      messages: [line("e1", 0), line("e2", 2, THIRD), line("e3", 4)],
    });
    socket.emit("lobby:match_team:blocked-merged:lineup-1:messages", {
      messages: [line("t1", 1, THIRD), line("t2", 3), line("t3", 5, THIRD)],
    });
    await flushPromises();

    const lobby = wrapper.vm as any;
    lobby.lastReadMessageCount = 4;

    socket.setHiddenAuthors([OTHER]);
    await flushPromises();

    expect(lobby.messages.map((m: LobbyMessage) => m.id)).toEqual([
      "t1",
      "e2",
      "t3",
    ]);
    expect(lobby.lastReadMessageCount).toBe(2);
  });
});
