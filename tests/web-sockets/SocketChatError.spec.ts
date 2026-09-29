import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import socket, { type LobbyMessage } from "~/web-sockets/Socket";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

const line = (id: string, minute: number): LobbyMessage => ({
  id,
  message: `line ${id}`,
  timestamp: new Date(Date.UTC(2026, 8, 28, 12, minute)).toISOString(),
  from: { steam_id: "76561198000000002" },
});

const ids = (messages: readonly LobbyMessage[]) =>
  messages.map((message) => message.id);

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

function sentDeletes(send: ReturnType<typeof vi.fn>) {
  return send.mock.calls
    .map(([payload]) => JSON.parse(payload))
    .filter(({ event }) => event === "lobby:delete")
    .map(({ data }) => data);
}

function sentEdits(send: ReturnType<typeof vi.fn>) {
  return send.mock.calls
    .map(([payload]) => JSON.parse(payload))
    .filter(({ event }) => event === "lobby:edit")
    .map(({ data }) => data);
}

function sentReacts(send: ReturnType<typeof vi.fn>) {
  return send.mock.calls
    .map(([payload]) => JSON.parse(payload))
    .filter(({ event }) => event === "lobby:react")
    .map(({ data }) => data);
}

async function settled(promise: Promise<unknown>) {
  let state = "pending";
  promise.then(
    () => {
      state = "resolved";
    },
    () => {
      state = "rejected";
    },
  );
  await Promise.resolve();
  await Promise.resolve();
  return state;
}

describe("Socket chat:error", () => {
  beforeEach(() => {
    toast.mockClear();
  });

  it("toasts the limit for a message that is too long", () => {
    socket.emit("chat:error", { code: "too_long", max: 2000, requestId: "r" });

    expect(toast).toHaveBeenCalledWith({
      title: "Failed to send message",
      description: "Messages can be up to 2000 characters.",
      variant: "destructive",
    });
  });

  it.each(["not_allowed", "invalid"])("toasts a failed send for %s", (code) => {
    socket.emit("chat:error", { code });

    expect(toast).toHaveBeenCalledWith({
      title: "Failed to send message",
      description: undefined,
      variant: "destructive",
    });
  });

  it("tells a gagged player why their send was refused", () => {
    socket.emit("chat:error", { code: "gagged", action: "send" });

    expect(toast).toHaveBeenCalledWith({
      title: "Failed to send message",
      description: "You're gagged and can't send chat messages.",
      variant: "destructive",
    });
  });

  it("titles a delete nobody is waiting on as a failed delete", () => {
    socket.emit("chat:error", {
      code: "not_allowed",
      action: "delete",
      requestId: "nobody-asked",
    });

    expect(toast).toHaveBeenCalledWith({
      title: "Failed to delete message",
      description: undefined,
      variant: "destructive",
    });
  });

  it("reports a message that was already gone without calling it a failure", () => {
    socket.emit("chat:error", { code: "not_found", action: "delete" });

    expect(toast).toHaveBeenCalledWith({ title: "Message already removed" });
  });
});

describe("Socket deleteMessage", () => {
  let send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toast.mockClear();
    send = connect();
  });

  afterEach(() => {
    vi.useRealTimers();
    disconnect();
  });

  it("asks the api to delete the message with a request id", () => {
    void socket.deleteMessage("match", "match-1", "message-1").catch(() => {});

    const [request] = sentDeletes(send);
    expect(request).toMatchObject({
      type: "match",
      id: "match-1",
      messageId: "message-1",
    });
    expect(typeof request.requestId).toBe("string");
  });

  it("resolves on the ack for its own request", async () => {
    const pending = socket.deleteMessage("match", "match-1", "message-1");
    const [{ requestId }] = sentDeletes(send);

    socket.emit("chat:ack", { requestId: "someone-else", action: "delete" });
    expect(await settled(pending)).toBe("pending");

    socket.emit("chat:ack", {
      requestId,
      messageId: "message-1",
      action: "send",
    });
    expect(await settled(pending)).toBe("pending");

    socket.emit("chat:ack", {
      requestId,
      messageId: "message-1",
      action: "delete",
    });
    await expect(pending).resolves.toBeUndefined();
  });

  it("rejects on the error for its own request without a global toast", async () => {
    const pending = socket.deleteMessage("match", "match-1", "message-1");
    const [{ requestId }] = sentDeletes(send);

    socket.emit("chat:error", {
      code: "not_allowed",
      action: "delete",
      requestId,
    });

    await expect(pending).rejects.toMatchObject({
      code: "not_allowed",
      action: "delete",
    });
    expect(toast).not.toHaveBeenCalled();
  });

  it("gives up when the api never answers", async () => {
    vi.useFakeTimers();
    const pending = socket.deleteMessage("match", "match-1", "message-1");

    vi.advanceTimersByTime(7999);
    expect(await settled(pending)).toBe("pending");

    vi.advanceTimersByTime(1);
    await expect(pending).rejects.toMatchObject({
      code: "timeout",
      action: "delete",
    });
  });

  it("takes a late answer quietly instead of reporting it twice", async () => {
    vi.useFakeTimers();
    const pending = socket.deleteMessage("match", "match-1", "message-1");
    const [{ requestId }] = sentDeletes(send);
    pending.catch(() => {});

    vi.advanceTimersByTime(8000);
    socket.emit("chat:error", {
      code: "not_allowed",
      action: "delete",
      requestId,
    });

    expect(toast).not.toHaveBeenCalled();
  });

  it("stops recognising a late answer after a minute", async () => {
    vi.useFakeTimers();
    const pending = socket.deleteMessage("match", "match-1", "message-1");
    const [{ requestId }] = sentDeletes(send);
    pending.catch(() => {});

    vi.advanceTimersByTime(8000 + 60000);
    socket.emit("chat:error", {
      code: "not_allowed",
      action: "delete",
      requestId,
    });

    expect(toast).toHaveBeenCalledTimes(1);
    expect((socket as any).pendingRequests.has(requestId)).toBe(false);
  });

  it("refuses straight away while offline and sends nothing", async () => {
    disconnect();

    await expect(
      socket.deleteMessage("match", "match-1", "message-1"),
    ).rejects.toMatchObject({ code: "offline", action: "delete" });
    expect(sentDeletes(send)).toEqual([]);
    expect((socket as any).offlineQueue).not.toContainEqual(
      expect.objectContaining({ event: "lobby:delete" }),
    );
  });
});

describe("Socket lobby deletes", () => {
  let lobby: ReturnType<typeof socket.joinLobby>;
  let deleted: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    lobby = socket.joinLobby("socket-spec", "match", "match-1");
    deleted = vi.fn();
    lobby.on("lobby:deleted", deleted);
    socket.emit("lobby:match:match-1:messages", {
      messages: [line("a", 0), line("b", 1), line("c", 2)],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    lobby.leave();
    disconnect();
    vi.restoreAllMocks();
  });

  it("removes the message and tells the lobby where it was", () => {
    socket.emit("lobby:match:match-1:deleted", { id: "b" });

    expect(ids(lobby.messages)).toEqual(["a", "c"]);
    expect(deleted).toHaveBeenCalledWith({ message: line("b", 1), index: 1 });
  });

  it("keeps a deleted message out of a stale snapshot and a replayed chat", () => {
    socket.emit("lobby:match:match-1:deleted", { id: "b" });

    socket.emit("lobby:match:match-1:messages", {
      messages: [line("a", 0), line("b", 1), line("c", 2)],
    });
    socket.emit("lobby:match:match-1:chat", line("b", 1));

    expect(ids(lobby.messages)).toEqual(["a", "c"]);
  });

  it("drops a message deleted before it ever arrived", () => {
    socket.emit("lobby:match:match-1:deleted", { id: "d" });
    socket.emit("lobby:match:match-1:chat", line("d", 3));

    expect(ids(lobby.messages)).toEqual(["a", "b", "c"]);
    expect(deleted).not.toHaveBeenCalled();
  });

  it("ignores a delete with no id", () => {
    socket.emit("lobby:match:match-1:deleted", {});

    expect(ids(lobby.messages)).toEqual(["a", "b", "c"]);
  });

  it("removes the message on the ack, before the room hears about it", async () => {
    const send = connect();
    const pending = socket.deleteMessage("match", "match-1", "b");
    const [{ requestId }] = sentDeletes(send);

    socket.emit("chat:ack", { requestId, messageId: "b", action: "delete" });
    await pending;

    expect(ids(lobby.messages)).toEqual(["a", "c"]);

    socket.emit("lobby:match:match-1:deleted", { id: "b" });
    expect(deleted).toHaveBeenCalledTimes(1);
  });

  it("applies an ack that lands after the timeout", async () => {
    vi.useFakeTimers();
    const send = connect();
    const pending = socket.deleteMessage("match", "match-1", "b");
    const [{ requestId }] = sentDeletes(send);
    pending.catch(() => {});

    vi.advanceTimersByTime(8000);
    await expect(pending).rejects.toMatchObject({ code: "timeout" });

    socket.emit("chat:ack", { requestId, messageId: "b", action: "delete" });

    expect(ids(lobby.messages)).toEqual(["a", "c"]);
  });

  it("removes a message the api says is already gone", async () => {
    const send = connect();
    const pending = socket.deleteMessage("match", "match-1", "b");
    const [{ requestId }] = sentDeletes(send);

    socket.emit("chat:error", {
      code: "not_found",
      action: "delete",
      requestId,
    });

    await expect(pending).rejects.toMatchObject({ code: "not_found" });
    expect(ids(lobby.messages)).toEqual(["a", "c"]);
  });
});

describe("Socket editMessage", () => {
  let send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toast.mockClear();
    send = connect();
  });

  afterEach(() => {
    vi.useRealTimers();
    disconnect();
  });

  it("asks the api to edit the message with a request id", () => {
    void socket
      .editMessage("direct", "1:2", "message-1", "fixed")
      .catch(() => {});

    const [request] = sentEdits(send);
    expect(request).toMatchObject({
      type: "direct",
      id: "1:2",
      messageId: "message-1",
      message: "fixed",
    });
    expect(typeof request.requestId).toBe("string");
  });

  it("resolves only on the edit ack for its own request", async () => {
    const pending = socket.editMessage("match", "match-1", "message-1", "x");
    const [{ requestId }] = sentEdits(send);

    socket.emit("chat:ack", { requestId, action: "delete" });
    expect(await settled(pending)).toBe("pending");

    socket.emit("chat:ack", { requestId: "someone-else", action: "edit" });
    expect(await settled(pending)).toBe("pending");

    socket.emit("chat:ack", {
      requestId,
      messageId: "message-1",
      action: "edit",
    });
    await expect(pending).resolves.toBeUndefined();
  });

  it("rejects on its own error without a global toast", async () => {
    const pending = socket.editMessage("match", "match-1", "message-1", "x");
    const [{ requestId }] = sentEdits(send);

    socket.emit("chat:error", {
      code: "window_closed",
      action: "edit",
      requestId,
    });

    await expect(pending).rejects.toMatchObject({
      code: "window_closed",
      action: "edit",
    });
    expect(toast).not.toHaveBeenCalled();
  });

  it("gives up when the api never answers", async () => {
    vi.useFakeTimers();
    const pending = socket.editMessage("match", "match-1", "message-1", "x");

    vi.advanceTimersByTime(7999);
    expect(await settled(pending)).toBe("pending");

    vi.advanceTimersByTime(1);
    await expect(pending).rejects.toMatchObject({
      code: "timeout",
      action: "edit",
    });
  });

  it("refuses straight away while offline and sends nothing", async () => {
    disconnect();

    await expect(
      socket.editMessage("match", "match-1", "message-1", "x"),
    ).rejects.toMatchObject({ code: "offline", action: "edit" });
    expect(sentEdits(send)).toEqual([]);
    expect((socket as any).offlineQueue).not.toContainEqual(
      expect.objectContaining({ event: "lobby:edit" }),
    );
  });

  it("titles an edit error nobody is waiting on as a failed edit", () => {
    socket.emit("chat:error", {
      code: "window_closed",
      action: "edit",
      requestId: "nobody-asked",
    });

    expect(toast).toHaveBeenCalledWith({
      title: "Failed to edit message",
      description: "You can only edit a message for 10 minutes.",
      variant: "destructive",
    });
  });
});

describe("Socket lobby edits", () => {
  let lobby: ReturnType<typeof socket.joinLobby>;
  const EDITED_AT = "2026-09-28T12:05:00.000Z";

  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    lobby = socket.joinLobby("socket-spec", "direct", "1:2");
    socket.emit("lobby:direct:1:2:messages", {
      messages: [line("a", 0), line("b", 1)],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    lobby.leave();
    disconnect();
    vi.restoreAllMocks();
  });

  const text = () => lobby.messages.map((message) => message.message);

  it("applies an edit to the message it names", () => {
    socket.emit("lobby:direct:1:2:edited", {
      id: "b",
      message: "fixed",
      edited_at: EDITED_AT,
    });

    expect(text()).toEqual(["line a", "fixed"]);
    expect(lobby.messages[1].edited_at).toBe(EDITED_AT);
  });

  it("never creates a message from an edit for an id it doesn't hold", () => {
    socket.emit("lobby:direct:1:2:edited", {
      id: "c",
      message: "ghost",
      edited_at: EDITED_AT,
    });

    expect(ids(lobby.messages)).toEqual(["a", "b"]);
  });

  it("ignores an edit that arrives after the delete it raced", () => {
    socket.emit("lobby:direct:1:2:deleted", { id: "b" });
    socket.emit("lobby:direct:1:2:edited", {
      id: "b",
      message: "fixed",
      edited_at: EDITED_AT,
    });
    socket.emit("lobby:direct:1:2:messages", {
      messages: [line("a", 0), line("b", 1)],
    });

    expect(ids(lobby.messages)).toEqual(["a"]);
  });

  it("keeps an edit through a snapshot built before it", () => {
    socket.emit("lobby:direct:1:2:edited", {
      id: "b",
      message: "fixed",
      edited_at: EDITED_AT,
    });
    socket.emit("lobby:direct:1:2:messages", {
      messages: [line("a", 0), line("b", 1)],
    });

    expect(text()).toEqual(["line a", "fixed"]);
  });

  it("shows what the server stored on the ack, before the room hears about it", async () => {
    const send = connect();
    const pending = socket.editMessage("direct", "1:2", "b", "fixed");
    const [{ requestId }] = sentEdits(send);

    socket.emit("chat:ack", {
      requestId,
      messageId: "b",
      action: "edit",
      message: "fixed as stored",
      edited_at: EDITED_AT,
    });
    await pending;

    expect(text()).toEqual(["line a", "fixed as stored"]);
    expect(lobby.messages[1].edited_at).toBe(EDITED_AT);
    expect(lobby.messages[1].__edited_locally).toBeUndefined();
  });

  it("stamps this browser's clock on an ack from an older api, until the server's arrives", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T12:05:30.000Z"));
    const send = connect();
    const pending = socket.editMessage("direct", "1:2", "b", "fixed");
    const [{ requestId }] = sentEdits(send);

    socket.emit("chat:ack", { requestId, messageId: "b", action: "edit" });
    await pending;

    expect(text()).toEqual(["line a", "fixed"]);
    expect(lobby.messages[1].edited_at).toBe("2026-09-28T12:05:30.000Z");

    socket.emit("lobby:direct:1:2:edited", {
      id: "b",
      message: "fixed",
      edited_at: EDITED_AT,
    });
    expect(lobby.messages[1].edited_at).toBe(EDITED_AT);
    expect(lobby.messages[1].__edited_locally).toBeUndefined();
  });

  it("ignores an older edit's ack that lands after a newer edit's broadcast", async () => {
    const send = connect();
    const pending = socket.editMessage("direct", "1:2", "b", "mine");
    const [{ requestId }] = sentEdits(send);

    socket.emit("lobby:direct:1:2:edited", {
      id: "b",
      message: "other tab",
      edited_at: "2026-09-28T12:06:00.000Z",
    });
    socket.emit("chat:ack", {
      requestId,
      messageId: "b",
      action: "edit",
      message: "mine",
      edited_at: EDITED_AT,
    });
    await pending;

    expect(text()).toEqual(["line a", "other tab"]);
    expect(lobby.messages[1].edited_at).toBe("2026-09-28T12:06:00.000Z");
  });

  it("ignores an older edit's broadcast that lands after a newer edit's ack", async () => {
    const send = connect();
    const pending = socket.editMessage("direct", "1:2", "b", "mine");
    const [{ requestId }] = sentEdits(send);

    socket.emit("chat:ack", {
      requestId,
      messageId: "b",
      action: "edit",
      message: "mine",
      edited_at: "2026-09-28T12:06:00.000Z",
    });
    await pending;
    socket.emit("lobby:direct:1:2:edited", {
      id: "b",
      message: "other tab",
      edited_at: EDITED_AT,
    });

    expect(text()).toEqual(["line a", "mine"]);
    expect(lobby.messages[1].edited_at).toBe("2026-09-28T12:06:00.000Z");
  });

  it("keeps the server's edit time when the broadcast beats the ack", async () => {
    const send = connect();
    const pending = socket.editMessage("direct", "1:2", "b", "fixed");
    const [{ requestId }] = sentEdits(send);

    socket.emit("lobby:direct:1:2:edited", {
      id: "b",
      message: "fixed",
      edited_at: EDITED_AT,
    });
    socket.emit("chat:ack", { requestId, messageId: "b", action: "edit" });
    await pending;

    expect(text()).toEqual(["line a", "fixed"]);
    expect(lobby.messages[1].edited_at).toBe(EDITED_AT);
  });

  it("drops the line when the api says it is already gone", async () => {
    const send = connect();
    const pending = socket.editMessage("direct", "1:2", "b", "fixed");
    const [{ requestId }] = sentEdits(send);

    socket.emit("chat:error", {
      code: "not_found",
      action: "edit",
      requestId,
    });

    await expect(pending).rejects.toMatchObject({ code: "not_found" });
    expect(ids(lobby.messages)).toEqual(["a"]);
  });

  it("leaves the line alone when the edit is refused", async () => {
    const send = connect();
    const pending = socket.editMessage("direct", "1:2", "b", "fixed");
    const [{ requestId }] = sentEdits(send);

    socket.emit("chat:error", {
      code: "window_closed",
      action: "edit",
      requestId,
    });

    await expect(pending).rejects.toMatchObject({ code: "window_closed" });
    expect(text()).toEqual(["line a", "line b"]);
  });
});

describe("Socket react", () => {
  let send: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toast.mockClear();
    send = connect();
  });

  afterEach(() => {
    vi.useRealTimers();
    disconnect();
  });

  it("asks the api to toggle the reaction with a request id", () => {
    void socket.react("match", "match-1", "message-1", "fire").catch(() => {});

    const [request] = sentReacts(send);
    expect(request).toMatchObject({
      type: "match",
      id: "match-1",
      messageId: "message-1",
      reaction: "fire",
    });
    expect(typeof request.requestId).toBe("string");
  });

  it("resolves only on the react ack for its own request", async () => {
    const pending = socket.react("match", "match-1", "message-1", "heart");
    const [{ requestId }] = sentReacts(send);

    socket.emit("chat:ack", { requestId, action: "edit" });
    expect(await settled(pending)).toBe("pending");

    socket.emit("chat:ack", { requestId: "someone-else", action: "react" });
    expect(await settled(pending)).toBe("pending");

    socket.emit("chat:ack", {
      requestId,
      messageId: "message-1",
      action: "react",
    });
    await expect(pending).resolves.toBeUndefined();
  });

  it("rejects on its own error without a global toast", async () => {
    const pending = socket.react("match", "match-1", "message-1", "heart");
    const [{ requestId }] = sentReacts(send);

    socket.emit("chat:error", {
      code: "rate_limited",
      action: "react",
      requestId,
    });

    await expect(pending).rejects.toMatchObject({
      code: "rate_limited",
      action: "react",
    });
    expect(toast).not.toHaveBeenCalled();
  });

  it("gives up when the api never answers", async () => {
    vi.useFakeTimers();
    const pending = socket.react("match", "match-1", "message-1", "heart");

    vi.advanceTimersByTime(7999);
    expect(await settled(pending)).toBe("pending");

    vi.advanceTimersByTime(1);
    await expect(pending).rejects.toMatchObject({
      code: "timeout",
      action: "react",
    });
  });

  it("refuses straight away while offline and sends nothing", async () => {
    disconnect();

    await expect(
      socket.react("match", "match-1", "message-1", "heart"),
    ).rejects.toMatchObject({ code: "offline", action: "react" });
    expect(sentReacts(send)).toEqual([]);
    expect((socket as any).offlineQueue).not.toContainEqual(
      expect.objectContaining({ event: "lobby:react" }),
    );
  });

  it("sends a toggle once while the same one is on its way", async () => {
    const first = socket.react("match", "match-1", "message-2", "heart");
    const again = socket.react("match", "match-1", "message-2", "heart");
    void socket.react("match", "match-1", "message-2", "fire").catch(() => {});

    expect(
      sentReacts(send).map(({ messageId, reaction }) => [messageId, reaction]),
    ).toEqual([
      ["message-2", "heart"],
      ["message-2", "fire"],
    ]);
    await expect(again).resolves.toBeUndefined();

    const [{ requestId }] = sentReacts(send);
    socket.emit("chat:ack", {
      requestId,
      messageId: "message-2",
      action: "react",
    });
    await first;

    void socket.react("match", "match-1", "message-2", "heart").catch(() => {});
    expect(sentReacts(send)).toHaveLength(3);
  });

  it("sends a toggle again once the last one failed", async () => {
    const first = socket.react("match", "match-1", "message-2", "sad");
    const [{ requestId }] = sentReacts(send);

    socket.emit("chat:error", {
      code: "rate_limited",
      action: "react",
      requestId,
    });
    await expect(first).rejects.toMatchObject({ code: "rate_limited" });

    void socket.react("match", "match-1", "message-2", "sad").catch(() => {});
    expect(sentReacts(send)).toHaveLength(2);
  });

  it("titles a react error nobody is waiting on as a failed reaction", () => {
    socket.emit("chat:error", {
      code: "rate_limited",
      action: "react",
      requestId: "nobody-asked",
    });

    expect(toast).toHaveBeenCalledWith({
      title: "Failed to react",
      description: "You're reacting too fast.",
      variant: "destructive",
    });
  });
});

describe("Socket lobby reactions", () => {
  let lobby: ReturnType<typeof socket.joinLobby>;
  const DANA = "76561198000000003";
  const ELI = "76561198000000004";

  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    lobby = socket.joinLobby("socket-spec", "direct", "1:2");
    socket.emit("lobby:direct:1:2:messages", {
      messages: [line("a", 0), { ...line("b", 1), reactions: {} }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    lobby.leave();
    disconnect();
    vi.restoreAllMocks();
  });

  const reactions = () => lobby.messages.map((message) => message.reactions);

  it("replaces the message's reactions with each broadcast", () => {
    socket.emit("lobby:direct:1:2:reaction", {
      id: "b",
      reactions: { heart: [DANA], fire: [ELI] },
    });
    socket.emit("lobby:direct:1:2:reaction", {
      id: "b",
      reactions: { fire: [ELI, DANA] },
    });

    expect(reactions()).toEqual([undefined, { fire: [ELI, DANA] }]);
  });

  it("never creates a message from reactions for an id it doesn't hold", () => {
    socket.emit("lobby:direct:1:2:reaction", {
      id: "c",
      reactions: { heart: [DANA] },
    });

    expect(ids(lobby.messages)).toEqual(["a", "b"]);
  });

  it("ignores reactions that arrive after the delete they raced", () => {
    socket.emit("lobby:direct:1:2:deleted", { id: "b" });
    socket.emit("lobby:direct:1:2:reaction", {
      id: "b",
      reactions: { heart: [DANA] },
    });

    expect(ids(lobby.messages)).toEqual(["a"]);
  });

  it("keeps live reactions through a snapshot built before them", () => {
    socket.emit("lobby:direct:1:2:reaction", {
      id: "b",
      reactions: { heart: [DANA] },
    });
    socket.emit("lobby:direct:1:2:messages", {
      messages: [line("a", 0), { ...line("b", 1), reactions: {} }],
    });

    expect(reactions()).toEqual([undefined, { heart: [DANA] }]);
  });

  it("takes the snapshot that answers a later join", () => {
    socket.emit("lobby:direct:1:2:reaction", {
      id: "b",
      reactions: { heart: [DANA] },
    });

    const send = connect();
    socket.join("lobby", { type: "direct", id: "1:2" });
    expect(
      send.mock.calls.some(
        ([payload]) => JSON.parse(payload).event === "lobby:join",
      ),
    ).toBe(true);

    socket.emit("lobby:direct:1:2:messages", {
      messages: [line("a", 0), { ...line("b", 1), reactions: { sad: [ELI] } }],
    });

    expect(reactions()).toEqual([undefined, { sad: [ELI] }]);
  });

  it("drops the line when the api says it is already gone", async () => {
    const send = connect();
    const pending = socket.react("direct", "1:2", "b", "heart");
    const [{ requestId }] = sentReacts(send);

    socket.emit("chat:error", {
      code: "not_found",
      action: "react",
      requestId,
    });

    await expect(pending).rejects.toMatchObject({ code: "not_found" });
    expect(ids(lobby.messages)).toEqual(["a"]);
  });

  it("leaves the line alone when the reaction is refused", async () => {
    const send = connect();
    const pending = socket.react("direct", "1:2", "b", "heart");
    const [{ requestId }] = sentReacts(send);

    socket.emit("chat:error", {
      code: "gagged",
      action: "react",
      requestId,
    });

    await expect(pending).rejects.toMatchObject({ code: "gagged" });
    expect(ids(lobby.messages)).toEqual(["a", "b"]);
  });
});

describe("Socket live order", () => {
  let lobby: ReturnType<typeof socket.joinLobby>;

  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    lobby = socket.joinLobby("socket-spec", "match", "live-order");
    socket.emit("lobby:match:live-order:messages", {
      messages: [line("a", 0), line("b", 1)],
    });
  });

  afterEach(() => {
    lobby.leave();
    vi.restoreAllMocks();
  });

  it("orders a late live line by its timestamp and keeps one copy", () => {
    socket.emit("lobby:match:live-order:chat", line("d", 3));
    socket.emit("lobby:match:live-order:chat", line("c", 2));
    socket.emit("lobby:match:live-order:chat", line("d", 3));

    expect(ids(lobby.messages)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("Socket hidden authors", () => {
  const DANA = "76561198000000003";
  const ELI = "76561198000000004";
  const FAY = "76561198000000005";

  const by = (id: string, minute: number, steamId: string): LobbyMessage => ({
    ...line(id, minute),
    from: { steam_id: steamId },
  });

  const matchHistory = () => [
    by("m1", 0, DANA),
    { ...line("m2", 1), reactions: { heart: [DANA, FAY], fire: [DANA] } },
    by("m3", 2, DANA),
  ];

  let match: ReturnType<typeof socket.joinLobby>;
  let lobby: ReturnType<typeof socket.joinLobby>;

  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    match = socket.joinLobby("socket-spec", "match", "hidden-match");
    lobby = socket.joinLobby("socket-spec", "matchmaking", "hidden-lobby");
    socket.emit("lobby:match:hidden-match:messages", {
      messages: matchHistory(),
    });
    socket.emit("lobby:matchmaking:hidden-lobby:messages", {
      messages: [line("l1", 0), by("l2", 1, DANA), by("l3", 2, ELI)],
    });
  });

  afterEach(() => {
    socket.setHiddenAuthors([]);
    match.leave();
    lobby.leave();
    disconnect();
    vi.restoreAllMocks();
  });

  function sentJoins(send: ReturnType<typeof vi.fn>) {
    return send.mock.calls
      .map(([payload]) => JSON.parse(payload))
      .filter(({ event }) => event === "lobby:join")
      .map(({ data }) => `${data.type}:${data.id}`);
  }

  it("takes their lines out of every open room", () => {
    const deleted = vi.fn();
    match.on("lobby:deleted", deleted);

    socket.setHiddenAuthors([DANA]);

    expect(ids(match.messages)).toEqual(["m2"]);
    expect(ids(lobby.messages)).toEqual(["l1", "l3"]);
    expect(deleted.mock.calls.map(([event]) => event)).toEqual([
      { message: by("m1", 0, DANA), index: 0 },
      { message: by("m3", 2, DANA), index: 1 },
    ]);
  });

  it("names only the players the set gained or lost", () => {
    expect(socket.setHiddenAuthors([DANA, ELI])).toEqual({
      added: [DANA, ELI],
      removed: [],
    });
    expect(socket.setHiddenAuthors([ELI])).toEqual({
      added: [],
      removed: [DANA],
    });
    expect(socket.hidesAuthor(DANA)).toBe(false);
    expect(socket.hidesAuthor(ELI)).toBe(true);
  });

  it("drops their live lines without telling the room", () => {
    const chat = vi.fn();
    match.on("lobby:chat", chat);
    socket.setHiddenAuthors([DANA]);

    socket.emit("lobby:match:hidden-match:chat", by("m4", 3, DANA));
    socket.emit("lobby:match:hidden-match:chat", line("m5", 4));

    expect(ids(match.messages)).toEqual(["m2", "m5"]);
    expect(chat).toHaveBeenCalledTimes(1);
    expect(chat).toHaveBeenCalledWith(line("m5", 4));
  });

  it("keeps their lines and reactions out of a snapshot built before the block", () => {
    socket.setHiddenAuthors([DANA]);

    socket.emit("lobby:match:hidden-match:messages", {
      messages: matchHistory(),
    });

    expect(ids(match.messages)).toEqual(["m2"]);
    expect(match.messages[0].reactions).toEqual({ heart: [FAY] });
  });

  it("takes their reactions off the lines still shown", () => {
    socket.setHiddenAuthors([DANA]);

    expect(match.messages[0].reactions).toEqual({ heart: [FAY] });

    socket.emit("lobby:match:hidden-match:reaction", {
      id: "m2",
      reactions: { heart: [DANA, FAY], sad: [DANA] },
    });
    expect(match.messages[0].reactions).toEqual({ heart: [FAY] });

    socket.emit("lobby:match:hidden-match:messages", {
      messages: matchHistory(),
    });
    expect(match.messages[0].reactions).toEqual({ heart: [FAY] });
  });

  it("never brings a hidden line back through an edit or a reaction", () => {
    socket.setHiddenAuthors([DANA]);

    socket.emit("lobby:match:hidden-match:edited", {
      id: "m1",
      message: "edited",
      edited_at: new Date(Date.UTC(2026, 8, 28, 13)).toISOString(),
    });
    socket.emit("lobby:match:hidden-match:reaction", {
      id: "m3",
      reactions: { heart: [ELI] },
    });

    expect(ids(match.messages)).toEqual(["m2"]);
  });

  it("asks every open room for its history again on an unblock", () => {
    socket.setHiddenAuthors([DANA]);
    const send = connect();

    socket.setHiddenAuthors([]);

    expect(sentJoins(send)).toEqual(
      expect.arrayContaining([
        "match:hidden-match",
        "matchmaking:hidden-lobby",
      ]),
    );

    socket.emit("lobby:match:hidden-match:messages", {
      messages: matchHistory(),
    });
    expect(ids(match.messages)).toEqual(["m1", "m2", "m3"]);
    expect(match.messages[1].reactions).toEqual({
      heart: [DANA, FAY],
      fire: [DANA],
    });
  });

  it("keeps a line deleted while hidden out of the history that comes back", () => {
    socket.setHiddenAuthors([DANA]);
    socket.emit("lobby:match:hidden-match:deleted", { id: "m3" });
    socket.setHiddenAuthors([]);

    socket.emit("lobby:match:hidden-match:messages", {
      messages: matchHistory(),
    });

    expect(ids(match.messages)).toEqual(["m1", "m2"]);
  });

  it("rejoins nothing when nobody left the set", () => {
    socket.setHiddenAuthors([DANA]);
    const send = connect();

    socket.setHiddenAuthors([DANA, ELI]);
    socket.setHiddenAuthors([DANA, ELI]);

    expect(sentJoins(send)).toEqual([]);
  });
});
