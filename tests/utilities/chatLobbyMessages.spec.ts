import { describe, expect, it } from "vitest";
import {
  chatMessageKey,
  insertChatMessage,
  isChatMessageDeleted,
  mergeChatSnapshot,
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
