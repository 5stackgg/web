// @vitest-environment node
import { describe, expect, it } from "vitest";
import { chatBadgeFor, chatTabBadge } from "~/utilities/chatBadges";

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
