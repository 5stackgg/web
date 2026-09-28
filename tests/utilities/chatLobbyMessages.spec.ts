import { describe, expect, it } from "vitest";
import {
  applyChatMessageEdit,
  chatMessageKey,
  insertChatMessage,
  isChatMessageDeleted,
  mergeChatSnapshot,
  newestMessageIdsFrom,
  removeChatMessage,
} from "~/utilities/chatLobbyMessages";
import type { LobbyMessage } from "~/web-sockets/Socket";

const line = (id: string | undefined, minute: number): LobbyMessage => ({
  id,
  message: `line ${id ?? minute}`,
  timestamp: new Date(Date.UTC(2026, 8, 28, 12, minute)).toISOString(),
  from: { steam_id: "76561198000000001" },
});

const ids = (messages: LobbyMessage[]) => messages.map((message) => message.id);

describe("removeChatMessage", () => {
  it("removes the line and says where it was", () => {
    const messages = [line("a", 0), line("b", 1), line("c", 2)];

    const removed = removeChatMessage(messages, "b");

    expect(removed).not.toBeNull();
    expect(ids(removed!.messages)).toEqual(["a", "c"]);
    expect(removed!.message.id).toBe("b");
    expect(removed!.index).toBe(1);
    expect(ids(messages)).toEqual(["a", "b", "c"]);
  });

  it("returns null for a line it does not hold", () => {
    expect(removeChatMessage([line("a", 0)], "gone")).toBeNull();
  });

  it("never matches a line that has no id", () => {
    expect(removeChatMessage([line(undefined, 0)], "")).toBeNull();
  });
});

describe("insertChatMessage", () => {
  it("places a late line by its time", () => {
    const messages = insertChatMessage(
      [line("a", 0), line("c", 2)],
      line("b", 1),
    );

    expect(ids(messages)).toEqual(["a", "b", "c"]);
  });

  it("keeps arrival order between lines with the same time", () => {
    const messages = insertChatMessage([line("a", 1)], line("b", 1));

    expect(ids(messages)).toEqual(["a", "b"]);
  });
});

describe("isChatMessageDeleted", () => {
  it("matches only a tombstoned id", () => {
    const deleted = new Set(["b"]);

    expect(isChatMessageDeleted(line("b", 0), deleted)).toBe(true);
    expect(isChatMessageDeleted(line("a", 0), deleted)).toBe(false);
    expect(isChatMessageDeleted(line(undefined, 0), deleted)).toBe(false);
  });
});

describe("mergeChatSnapshot", () => {
  it("replaces what is held with the server's history", () => {
    const merged = mergeChatSnapshot(
      [line("expired", 0), line("a", 1)],
      [line("a", 1), line("b", 2)],
      new Set(),
    );

    expect(ids(merged)).toEqual(["a", "b"]);
  });

  it("keeps a live line newer than the snapshot", () => {
    const merged = mergeChatSnapshot(
      [line("a", 1), line("live", 3)],
      [line("a", 1), line("b", 2)],
      new Set(),
    );

    expect(ids(merged)).toEqual(["a", "b", "live"]);
  });

  it("drops a deleted line a stale snapshot still carries", () => {
    const merged = mergeChatSnapshot(
      [line("a", 1)],
      [line("a", 1), line("deleted", 2), line("b", 3)],
      new Set(["deleted"]),
    );

    expect(ids(merged)).toEqual(["a", "b"]);
  });

  it("drops a deleted line from the newer tail it keeps", () => {
    const merged = mergeChatSnapshot(
      [line("a", 1), line("deleted", 3), line("live", 4)],
      [line("a", 1)],
      new Set(["deleted"]),
    );

    expect(ids(merged)).toEqual(["a", "live"]);
  });

  it("keeps an edit a stale snapshot doesn't know about yet", () => {
    const edited = {
      ...line("a", 1),
      message: "fixed",
      edited_at: "2026-09-28T12:05:00.000Z",
    };

    const merged = mergeChatSnapshot(
      [edited],
      [line("a", 1), line("b", 2)],
      new Set(),
    );

    expect(merged[0]).toEqual(edited);
    expect(ids(merged)).toEqual(["a", "b"]);
  });

  it("takes a later edit from the snapshot over the one held", () => {
    const held = {
      ...line("a", 1),
      message: "fixed",
      edited_at: "2026-09-28T12:05:00.000Z",
    };
    const newer = {
      ...line("a", 1),
      message: "fixed again",
      edited_at: "2026-09-28T12:06:00.000Z",
    };

    const merged = mergeChatSnapshot([held], [newer], new Set());

    expect(merged).toEqual([newer]);
  });

  it("treats a missing snapshot as an empty room", () => {
    expect(mergeChatSnapshot([line("a", 1)], null, new Set())).toEqual([
      line("a", 1),
    ]);
  });
});

describe("chatMessageKey", () => {
  it("falls back to a composite key for a line with no id", () => {
    const message = line(undefined, 0);

    expect(chatMessageKey(message)).toBe(
      `76561198000000001|${message.timestamp}|${message.message}`,
    );
  });
});

describe("applyChatMessageEdit", () => {
  const edit = {
    id: "b",
    message: "fixed",
    edited_at: "2026-09-28T12:05:00.000Z",
  };

  it("changes the text and stamps the edit, and nothing else", () => {
    const messages = [line("a", 0), line("b", 1)];

    const edited = applyChatMessageEdit(messages, edit, new Set());

    expect(edited).not.toBeNull();
    expect(edited![1]).toEqual({
      ...line("b", 1),
      message: "fixed",
      edited_at: edit.edited_at,
    });
    expect(edited![0]).toBe(messages[0]);
    expect(messages[1].message).toBe("line b");
  });

  it("ignores an edit for a line it doesn't hold, rather than creating it", () => {
    expect(
      applyChatMessageEdit([line("a", 0)], { ...edit, id: "b" }, new Set()),
    ).toBeNull();
  });

  it("ignores an edit that lands after the line was deleted", () => {
    expect(
      applyChatMessageEdit([line("b", 1)], edit, new Set(["b"])),
    ).toBeNull();
  });

  it.each([
    ["no id", { message: "fixed" }],
    ["an empty id", { id: "", message: "fixed" }],
    ["no text", { id: "b" }],
  ])("ignores an edit with %s", (_, malformed) => {
    expect(
      applyChatMessageEdit([line("b", 1)], malformed, new Set()),
    ).toBeNull();
  });
});

describe("newestMessageIdsFrom", () => {
  const ME = "76561198000000009";

  it("names the newest lines from the other party, as many as counted", () => {
    const messages = [
      line("old", 0),
      line("newer", 1),
      { ...line("mine", 2), from: { steam_id: ME } },
      line("newest", 3),
    ];

    expect(newestMessageIdsFrom(messages, 2, ME)).toEqual([
      "newer",
      "newest",
    ]);
  });

  it("names nothing for a count of zero", () => {
    expect(newestMessageIdsFrom([line("a", 0)], 0, ME)).toEqual([]);
  });

  it("skips lines with no id", () => {
    expect(
      newestMessageIdsFrom([line("a", 0), line(undefined, 1)], 2, ME),
    ).toEqual(["a"]);
  });
});
