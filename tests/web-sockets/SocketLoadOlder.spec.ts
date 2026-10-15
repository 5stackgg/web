// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { Socket, type LobbyMessage } from "~/web-sockets/Socket";

const OTHER = "76561198000000002";

const line = (id: string, minute: number): LobbyMessage => ({
  id,
  message: `line ${id}`,
  timestamp: new Date(Date.UTC(2026, 9, 15, 12, minute)).toISOString(),
  from: { steam_id: OTHER },
});

function connected() {
  const socket = new Socket();
  const send = vi.fn();
  (socket as any).connected = true;
  (socket as any).connection = { send };

  const lobby = socket.joinLobby("spec", "team", "team-1");
  const seen = { chat: 0, messages: 0, older: [] as LobbyMessage[][] };
  lobby.on("lobby:chat", () => seen.chat++);
  lobby.on("lobby:messages", () => seen.messages++);
  lobby.on("lobby:older", (older: LobbyMessage[]) => seen.older.push(older));

  const sent = () => send.mock.calls.map(([raw]) => JSON.parse(raw));
  const requests = () =>
    sent().filter(({ event }) => event === "lobby:history");

  return {
    socket,
    lobby,
    seen,
    requests,
    snapshot: (page: Record<string, unknown>) =>
      socket.emit("lobby:team:team-1:messages", { id: "team-1", ...page }),
    answer: (page: Record<string, unknown>) =>
      socket.emit("lobby:team:team-1:history", {
        id: "team-1",
        requestId: requests().at(-1)?.data.requestId,
        ...page,
      }),
  };
}

const ids = (messages: readonly LobbyMessage[]) =>
  messages.map(({ id }) => id);

describe("Socket paging back", () => {
  it("asks for the page before the cursor the newest page handed out", async () => {
    const { lobby, snapshot, requests } = connected();
    snapshot({ messages: [line("c", 3)], more: true, cursor: "cursor-c" });

    expect(lobby.history).toEqual({ more: true, loading: false });

    void lobby.loadOlder();

    expect(requests()).toEqual([
      {
        event: "lobby:history",
        data: {
          type: "team",
          id: "team-1",
          before: "cursor-c",
          requestId: expect.any(String),
        },
      },
    ]);
    expect(lobby.history).toEqual({ more: true, loading: true });

    void lobby.loadOlder();
    expect(requests()).toHaveLength(1);
  });

  it("puts the page above what is held, once, and says when the room ends", async () => {
    const { lobby, snapshot, answer } = connected();
    snapshot({
      messages: [line("c", 3), line("d", 4)],
      more: true,
      cursor: "cursor-c",
    });

    const loaded = lobby.loadOlder();
    answer({
      messages: [line("a", 1), line("b", 2), line("c", 3)],
      more: false,
      cursor: "cursor-a",
    });
    await loaded;

    expect(ids(lobby.messages)).toEqual(["a", "b", "c", "d"]);
    expect(lobby.history).toEqual({ more: false, loading: false });
  });

  it("hands older lines to nothing that counts unread or tags", async () => {
    const { lobby, seen, snapshot, answer } = connected();
    snapshot({ messages: [line("c", 3)], more: true, cursor: "cursor-c" });

    const loaded = lobby.loadOlder();
    answer({ messages: [line("b", 2)], more: true, cursor: "cursor-b" });
    await loaded;

    expect(seen.chat).toBe(0);
    expect(seen.messages).toBe(1);
    expect(seen.older.map(ids)).toEqual([["b"]]);
  });

  it("pages on from the cursor the last page handed out, past a page with nothing to show", async () => {
    const { lobby, snapshot, answer, requests } = connected();
    snapshot({ messages: [line("c", 3)], more: true, cursor: "cursor-c" });

    let loaded = lobby.loadOlder();
    answer({ messages: [], more: true, cursor: "cursor-hidden" });
    await loaded;

    loaded = lobby.loadOlder();
    answer({ messages: [line("a", 1)], more: false, cursor: "cursor-a" });
    await loaded;

    expect(requests().map(({ data }) => data.before)).toEqual([
      "cursor-c",
      "cursor-hidden",
    ]);
    expect(ids(lobby.messages)).toEqual(["a", "c"]);
  });

  it("keeps what was scrolled back to across a newer snapshot, until one says the room is all there is", async () => {
    const { lobby, snapshot, answer } = connected();
    snapshot({ messages: [line("c", 3)], more: true, cursor: "cursor-c" });

    const loaded = lobby.loadOlder();
    answer({ messages: [line("b", 2)], more: true, cursor: "cursor-b" });
    await loaded;

    snapshot({
      messages: [line("c", 3), line("d", 4)],
      more: true,
      cursor: "cursor-c",
    });
    expect(ids(lobby.messages)).toEqual(["b", "c", "d"]);
    expect(lobby.history).toEqual({ more: true, loading: false });

    snapshot({ messages: [line("d", 4)], more: false, cursor: "cursor-d" });
    expect(ids(lobby.messages)).toEqual(["d"]);
    expect(lobby.history).toEqual({ more: false, loading: false });
  });

  it("drops a page that was asked for before a snapshot replaced the list", async () => {
    const { lobby, snapshot, answer } = connected();
    snapshot({ messages: [line("c", 3)], more: true, cursor: "cursor-c" });

    const loaded = lobby.loadOlder();
    snapshot({ messages: [line("e", 5)], more: true, cursor: "cursor-e" });
    answer({ messages: [line("b", 2)], more: true, cursor: "cursor-b" });
    await loaded;

    expect(ids(lobby.messages)).toEqual(["e"]);
    expect(lobby.history).toEqual({ more: true, loading: false });
  });

  it("leaves a refused page quietly, ready to ask again", async () => {
    const { socket, lobby, snapshot, requests } = connected();
    snapshot({ messages: [line("c", 3)], more: true, cursor: "cursor-c" });

    const loaded = lobby.loadOlder();
    socket.rejectChatRequest({
      code: "not_allowed",
      action: "history",
      requestId: requests()[0].data.requestId,
    });
    await loaded;

    expect(lobby.history).toEqual({ more: true, loading: false });

    void lobby.loadOlder();
    expect(requests()).toHaveLength(2);
  });

  it("asks nothing of an api that predates paging back", async () => {
    const { lobby, snapshot, requests } = connected();
    snapshot({ messages: [line("c", 3)] });

    expect(lobby.history).toBeNull();
    await lobby.loadOlder();

    expect(requests()).toEqual([]);
  });

  it("leaves out an older line from someone hidden", async () => {
    const { socket, lobby, snapshot, answer } = connected();
    socket.setHiddenAuthors([OTHER]);
    snapshot({ messages: [], more: true, cursor: "cursor-c" });

    const loaded = lobby.loadOlder();
    answer({ messages: [line("b", 2)], more: false, cursor: "cursor-b" });
    await loaded;

    expect(lobby.messages).toEqual([]);
  });
});
