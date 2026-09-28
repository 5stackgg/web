import { describe, expect, it } from "vitest";
import {
  applyChatMessageEdit,
  applyChatMessageReactions,
  chatMessageKey,
  insertChatMessage,
  isChatMessageDeleted,
  isChatMessageFrom,
  mergeChatSnapshot,
  newestMessageIdsFrom,
  removeChatMessage,
  removeChatMessagesFrom,
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

describe("removeChatMessagesFrom", () => {
  const DANA = "76561198000000002";
  const EVAN = "76561198000000003";

  const by = (id: string, minute: number, steamId: string): LobbyMessage => ({
    ...line(id, minute),
    from: { steam_id: steamId },
  });

  it("removes every line by the authors and says where each one was", () => {
    const messages = [
      by("a", 0, DANA),
      line("b", 1),
      by("c", 2, DANA),
      by("d", 3, EVAN),
      line("e", 4),
    ];

    const removed = removeChatMessagesFrom(messages, new Set([DANA, EVAN]));

    expect(ids(removed!.messages)).toEqual(["b", "e"]);
    expect(
      removed!.removed.map(({ message, index }) => [message.id, index]),
    ).toEqual([
      ["a", 0],
      ["c", 1],
      ["d", 1],
    ]);
    expect(ids(messages)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("gives the same indexes as deleting the lines one at a time", () => {
    const messages = [line("a", 0), by("b", 1, DANA), by("c", 2, DANA)];
    const removed = removeChatMessagesFrom(messages, new Set([DANA]))!;

    let current = messages;
    for (const { message, index } of removed.removed) {
      const single = removeChatMessage(current, message.id as string)!;
      expect(single.index).toBe(index);
      current = single.messages;
    }

    expect(current).toEqual(removed.messages);
  });

  it("returns null when none of the lines are theirs", () => {
    expect(removeChatMessagesFrom([line("a", 0)], new Set([DANA]))).toBeNull();
    expect(removeChatMessagesFrom([by("a", 0, DANA)], new Set())).toBeNull();
  });

  it("keeps a line that has no author", () => {
    const system: LobbyMessage = { id: "s", message: "x", timestamp: "" };

    const removed = removeChatMessagesFrom(
      [system, by("a", 0, DANA)],
      new Set([DANA]),
    );

    expect(ids(removed!.messages)).toEqual(["s"]);
  });
});

describe("isChatMessageFrom", () => {
  it("compares steam ids as strings", () => {
    const message = {
      ...line("a", 0),
      from: { steam_id: 42 as unknown as string },
    };

    expect(isChatMessageFrom(message, new Set(["42"]))).toBe(true);
    expect(isChatMessageFrom(message, new Set(["43"]))).toBe(false);
    expect(
      isChatMessageFrom({ ...message, from: undefined }, new Set(["42"])),
    ).toBe(false);
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

  it("keeps a newer edit over an older one the snapshot carries", () => {
    const held = {
      ...line("a", 1),
      message: "second",
      edited_at: "2026-09-28T12:06:00.000Z",
    };
    const older = {
      ...line("a", 1),
      message: "first",
      edited_at: "2026-09-28T12:05:00.000Z",
    };

    expect(mergeChatSnapshot([held], [older], new Set())).toEqual([held]);
  });

  it("keeps an edit stamped by this browser through a snapshot with no edit", () => {
    const local = {
      ...line("a", 1),
      message: "fixed",
      edited_at: "2026-09-28T12:05:00.000Z",
      __edited_locally: true,
    };

    expect(mergeChatSnapshot([local], [line("a", 1)], new Set())).toEqual([
      local,
    ]);
  });

  it("takes the server's edit over one stamped by this browser, whatever the clocks say", () => {
    const local = {
      ...line("a", 1),
      message: "fixed",
      edited_at: "2026-09-28T12:07:00.000Z",
      __edited_locally: true,
    };
    const server = {
      ...line("a", 1),
      message: "fixed",
      edited_at: "2026-09-28T12:05:00.000Z",
    };

    expect(mergeChatSnapshot([local], [server], new Set())).toEqual([server]);
  });

  it("keeps reactions that changed live after the snapshot was asked for", () => {
    const live = {
      ...line("a", 1),
      reactions: { fire: ["76561198000000003"] },
    };

    const merged = mergeChatSnapshot(
      [live, line("b", 2)],
      [
        { ...line("a", 1), reactions: {} },
        { ...line("b", 2), reactions: { sad: ["76561198000000003"] } },
      ],
      new Set(),
      new Set(["a"]),
    );

    expect(merged.map((message) => message.reactions)).toEqual([
      { fire: ["76561198000000003"] },
      { sad: ["76561198000000003"] },
    ]);
  });

  it("takes the snapshot's reactions for a message nothing changed live", () => {
    const merged = mergeChatSnapshot(
      [{ ...line("a", 1), reactions: { fire: ["76561198000000003"] } }],
      [{ ...line("a", 1), reactions: {} }],
      new Set(),
      new Set(),
    );

    expect(merged[0].reactions).toEqual({});
  });

  it("takes only the reactions from an unedited line that changed live", () => {
    const merged = mergeChatSnapshot(
      [{ ...line("a", 1), reactions: { fire: ["76561198000000003"] } }],
      [{ ...line("a", 1), reactions: {} }],
      new Set(),
      new Set(["a"]),
    );

    expect(merged).toStrictEqual([
      { ...line("a", 1), reactions: { fire: ["76561198000000003"] } },
    ]);
  });

  it("keeps a live edit and live reactions on the same message", () => {
    const held = {
      ...line("a", 1),
      message: "fixed",
      edited_at: "2026-09-28T12:05:00.000Z",
      reactions: { heart: ["76561198000000003"] },
    };

    const merged = mergeChatSnapshot(
      [held],
      [{ ...line("a", 1), reactions: {} }],
      new Set(),
      new Set(["a"]),
    );

    expect(merged).toEqual([held]);
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

  it("ignores an edit older than the one the line already has", () => {
    const newer = {
      ...line("b", 1),
      message: "newer",
      edited_at: edit.edited_at,
    };

    expect(
      applyChatMessageEdit(
        [newer],
        { ...edit, message: "older", edited_at: "2026-09-28T12:04:59.999Z" },
        new Set(),
      ),
    ).toBeNull();
  });

  it("applies an edit stamped at the same time as the one held", () => {
    const held = {
      ...line("b", 1),
      message: "held",
      edited_at: edit.edited_at,
    };

    expect(applyChatMessageEdit([held], edit, new Set())![0].message).toBe(
      "fixed",
    );
  });

  it("stamps this browser's clock on an edit with no time, and marks it", () => {
    const edited = applyChatMessageEdit(
      [line("b", 1)],
      { id: "b", message: "fixed" },
      new Set(),
    );

    expect(edited![0].edited_at).toEqual(expect.any(String));
    expect(edited![0].__edited_locally).toBe(true);
  });

  it("replaces an edit stamped by this browser with the server's, even an earlier one", () => {
    const local = {
      ...line("b", 1),
      message: "fixed",
      edited_at: "2026-09-28T12:07:00.000Z",
      __edited_locally: true,
    };

    const edited = applyChatMessageEdit([local], edit, new Set());

    expect(edited![0]).toEqual({
      ...line("b", 1),
      message: "fixed",
      edited_at: edit.edited_at,
    });
    expect("__edited_locally" in edited![0]).toBe(false);
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

describe("applyChatMessageReactions", () => {
  const update = {
    id: "b",
    reactions: { thumbsup: ["76561198000000003"], sad: ["76561198000000004"] },
  };

  it("replaces the message's reactions with the whole new state", () => {
    const messages = [
      line("a", 0),
      { ...line("b", 1), reactions: { heart: ["76561198000000003"] } },
    ];

    const reacted = applyChatMessageReactions(messages, update, new Set());

    expect(reacted).not.toBeNull();
    expect(reacted![1]).toEqual({
      ...line("b", 1),
      reactions: update.reactions,
    });
    expect(reacted![0]).toBe(messages[0]);
    expect(messages[1].reactions).toEqual({ heart: ["76561198000000003"] });
  });

  it("clears the reactions when nobody holds one any more", () => {
    const reacted = applyChatMessageReactions(
      [{ ...line("b", 1), reactions: { heart: ["76561198000000003"] } }],
      { id: "b", reactions: {} },
      new Set(),
    );

    expect(reacted![0].reactions).toEqual({});
  });

  it("ignores reactions for a line it doesn't hold rather than creating it", () => {
    expect(
      applyChatMessageReactions([line("a", 0)], update, new Set()),
    ).toBeNull();
  });

  it("ignores reactions that land after the line was deleted", () => {
    expect(
      applyChatMessageReactions([line("b", 1)], update, new Set(["b"])),
    ).toBeNull();
  });

  it.each([
    ["no id", { reactions: {} }],
    ["an empty id", { id: "", reactions: {} }],
    ["no reactions", { id: "b" }],
    ["reactions that aren't an object", { id: "b", reactions: [] as any }],
  ])("ignores an update with %s", (_, malformed) => {
    expect(
      applyChatMessageReactions([line("b", 1)], malformed, new Set()),
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
