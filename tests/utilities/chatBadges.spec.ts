// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  chatBadgeClass,
  chatBadgeFor,
  chatTabBadge,
} from "~/utilities/chatBadges";

const room = (id: string, type = "tournament") => ({ id, type });
const person = (id: string) => ({ id, type: "direct" });

describe("chatTabBadge", () => {
  it("is red for an unread direct message", () => {
    expect(chatTabBadge(person("direct:a"), 2, 0)).toEqual({
      tone: "red",
      count: 2,
      mention: false,
    });
  });

  it("is red with the number of tags for a room that tagged you", () => {
    expect(chatTabBadge(room("tournament:t"), 7, 2)).toEqual({
      tone: "red",
      count: 2,
      mention: true,
    });
  });

  it("uses the dock's white tone for room chatter", () => {
    expect(chatTabBadge(room("matchmaking:l", "matchmaking"), 3, 0)).toEqual({
      tone: "fresh",
      count: 3,
      mention: false,
    });
  });

  it("still shows a tag in a match room, whose chatter is never counted", () => {
    expect(chatTabBadge(room("match:m", "match"), 0, 1)).toEqual({
      tone: "red",
      count: 1,
      mention: true,
    });
  });

  it("shows nothing when nothing is waiting", () => {
    expect(chatTabBadge(room("organizers", "organizers"), 0, 0)).toBeNull();
  });
});

describe("chatBadgeFor", () => {
  const tabs = [
    room("tournament:t"),
    room("matchmaking:l", "matchmaking"),
    person("direct:ka"),
  ];

  it("counts what needs you in red: direct messages and tags", () => {
    expect(
      chatBadgeFor(
        tabs,
        { "tournament:t": 9, "matchmaking:l": 3, "direct:ka": 1 },
        { "tournament:t": 2 },
      ),
    ).toEqual({ tone: "red", count: 3, mention: false });
  });

  it("shows the @ when everything red is a tag", () => {
    expect(
      chatBadgeFor(tabs, { "tournament:t": 9 }, { "tournament:t": 2 }),
    ).toEqual({ tone: "red", count: 2, mention: true });
  });

  it("is white for chatter alone", () => {
    expect(
      chatBadgeFor(tabs, { "tournament:t": 7, "matchmaking:l": 3 }, {}),
    ).toEqual({ tone: "fresh", count: 10, mention: false });
  });

  it("is nothing when every room is read", () => {
    expect(chatBadgeFor(tabs, {}, {})).toBeNull();
  });
});

describe("a room the player quieted", () => {
  const muted = { muted: true, mutedUntil: null, notify: "all" as const };
  const tagsOnly = {
    muted: false,
    mutedUntil: null,
    notify: "mentions" as const,
  };
  const nothing = {
    muted: false,
    mutedUntil: null,
    notify: "nothing" as const,
  };

  it("shows a muted room's chatter as a quiet grey count", () => {
    expect(chatTabBadge(room("tournament:t"), 4, 0, muted)).toEqual({
      tone: "muted",
      count: 4,
      mention: false,
    });
  });

  it("greys a muted conversation too", () => {
    expect(chatTabBadge(person("direct:a"), 2, 0, muted)).toEqual({
      tone: "muted",
      count: 2,
      mention: false,
    });
  });

  it("lets a tag break through a mute in red", () => {
    expect(chatTabBadge(room("tournament:t"), 4, 1, muted)).toEqual({
      tone: "red",
      count: 1,
      mention: true,
    });
  });

  it("keeps chatter white in a room that only rings for tags", () => {
    expect(chatTabBadge(room("tournament:t"), 4, 0, tagsOnly)).toEqual({
      tone: "fresh",
      count: 4,
      mention: false,
    });
  });

  it("treats a tag as chatter in a room set to nothing", () => {
    expect(chatTabBadge(room("tournament:t"), 4, 1, nothing)).toEqual({
      tone: "fresh",
      count: 4,
      mention: false,
    });
    expect(chatTabBadge(room("match:m", "match"), 0, 2, nothing)).toEqual({
      tone: "fresh",
      count: 2,
      mention: false,
    });
    expect(
      chatTabBadge(room("match:m", "match"), 0, 2, { ...nothing, muted: true }),
    ).toEqual({ tone: "muted", count: 2, mention: false });
  });

  describe("in the totals", () => {
    const tabs = [
      room("tournament:t"),
      room("matchmaking:l", "matchmaking"),
      person("direct:ka"),
    ];
    const loud = { muted: false, mutedUntil: null, notify: "all" as const };
    const quietFor =
      (quiet: Record<string, typeof muted>) => (tab: { id: string }) =>
        quiet[tab.id] ?? loud;

    it("leaves a muted room's chatter out of the red and the white", () => {
      expect(
        chatBadgeFor(
          tabs,
          { "tournament:t": 9, "direct:ka": 2 },
          {},
          quietFor({ "direct:ka": muted, "tournament:t": muted }),
        ),
      ).toBeNull();
      expect(
        chatBadgeFor(
          tabs,
          { "tournament:t": 9, "matchmaking:l": 3 },
          {},
          quietFor({ "tournament:t": muted }),
        ),
      ).toEqual({ tone: "fresh", count: 3, mention: false });
    });

    it("still counts a tag in a muted room in red", () => {
      expect(
        chatBadgeFor(
          tabs,
          { "tournament:t": 9 },
          { "tournament:t": 2 },
          quietFor({ "tournament:t": muted }),
        ),
      ).toEqual({ tone: "red", count: 2, mention: true });
    });

    it("counts no tag from a room set to nothing in red", () => {
      expect(
        chatBadgeFor(
          tabs,
          { "tournament:t": 9 },
          { "tournament:t": 2 },
          quietFor({ "tournament:t": nothing }),
        ),
      ).toEqual({ tone: "fresh", count: 9, mention: false });
    });
  });
});

describe("chatBadgeClass", () => {
  it("paints each tone its own way", () => {
    const classes = (["red", "fresh", "muted"] as const).map(chatBadgeClass);

    expect(new Set(classes).size).toBe(3);
    expect(chatBadgeClass("red")).toContain("bg-red-500");
    expect(chatBadgeClass("muted")).not.toContain("bg-red-500");
  });
});
