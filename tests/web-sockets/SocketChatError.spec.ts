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

  it("shows the new text on the ack, before the room hears about it", async () => {
    const send = connect();
    const pending = socket.editMessage("direct", "1:2", "b", "fixed");
    const [{ requestId }] = sentEdits(send);

    socket.emit("chat:ack", { requestId, messageId: "b", action: "edit" });
    await pending;

    expect(text()).toEqual(["line a", "fixed"]);
    expect(lobby.messages[1].edited_at).toEqual(expect.any(String));

    socket.emit("lobby:direct:1:2:edited", {
      id: "b",
      message: "fixed",
      edited_at: EDITED_AT,
    });
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
