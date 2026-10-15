// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  chatRoomTakesMentions,
  hasMention,
  insertMention,
  MAX_CHAT_MENTIONS,
  mentionedSteamIds,
  mentionQuery,
  mentionSegments,
  mentionsStillIn,
  mentionsViewer,
  rankMentionCandidates,
} from "~/utilities/chatMentions";

const ME = "76561198000000001";
const KAIRO = { steam_id: "76561198000000002", name: "kairo" };
const KASPR = { steam_id: "76561198000000003", name: "kaspr" };
const KAI = { steam_id: "76561198000000004", name: "kai" };
const KALANI = { steam_id: "76561198000000005", name: "Kalani" };
const BIG_BOB = { steam_id: "76561198000000006", name: "Big Bob" };

describe("chatMentions", () => {
  it("allows ten tags, as the api does", () => {
    expect(MAX_CHAT_MENTIONS).toBe(10);
  });

  it("offers tags in every group room and never in a conversation", () => {
    for (const type of [
      "match",
      "match_team",
      "matchmaking",
      "organizers",
      "tournament",
      "draft",
    ]) {
      expect(chatRoomTakesMentions(type)).toBe(true);
    }

    expect(chatRoomTakesMentions("direct")).toBe(false);
  });

  describe("hasMention, which must agree with ChatService.mentionIn", () => {
    it.each([
      ["@kairo hi", true],
      ["hi @kairo", true],
      ["hi @kairo, you up?", true],
      ["(@kairo)", true],
      ["@kairo's turn", true],
      ["@kairos", false],
      ["@kairo_2", false],
      ["mail@kairo", false],
      ["kairo", false],
      ["@Kairo", false],
    ])("%s", (text, found) => {
      expect(hasMention(text, "kairo")).toBe(found);
    });

    it("finds a name with spaces in it", () => {
      expect(hasMention("gg @Big Bob", "Big Bob")).toBe(true);
    });

    it("never finds an empty name", () => {
      expect(hasMention("@ hi", "")).toBe(false);
    });
  });

  describe("mentionSegments", () => {
    it("is one plain segment without any tags", () => {
      expect(mentionSegments("hello", undefined, ME)).toEqual([
        { text: "hello", mention: null, self: false },
      ]);
    });

    it("splits out every tag the server accepted and marks the viewer's", () => {
      expect(
        mentionSegments(
          "@kairo and @kaspr, check in",
          [KAIRO, { ...KASPR, steam_id: ME }],
          ME,
        ),
      ).toEqual([
        { text: "@kairo", mention: KAIRO, self: false },
        { text: " and ", mention: null, self: false },
        { text: "@kaspr", mention: { ...KASPR, steam_id: ME }, self: true },
        { text: ", check in", mention: null, self: false },
      ]);
    });

    it("prefers the longer of two names that start alike", () => {
      expect(mentionSegments("@kairo @kai", [KAI, KAIRO], ME)).toEqual([
        { text: "@kairo", mention: KAIRO, self: false },
        { text: " ", mention: null, self: false },
        { text: "@kai", mention: KAI, self: false },
      ]);
    });

    it("leaves an @name the server did not accept as text", () => {
      expect(mentionSegments("@zed @kairos hi", [KAIRO], ME)).toEqual([
        { text: "@zed @kairos hi", mention: null, self: false },
      ]);
    });
  });

  it("knows when a message tags the viewer", () => {
    expect(mentionsViewer({ mentions: [KAIRO] }, KAIRO.steam_id)).toBe(true);
    expect(mentionsViewer({ mentions: [KAIRO] }, ME)).toBe(false);
    expect(mentionsViewer({}, ME)).toBe(false);
    expect(mentionsViewer({ mentions: [KAIRO] }, null)).toBe(false);
  });

  it("keeps only the tags an edit left in the text", () => {
    expect(mentionsStillIn("@kaspr check-in", [KAIRO, KASPR])).toEqual([
      KASPR,
    ]);
    expect(mentionsStillIn("check-in", [KAIRO])).toBeUndefined();
    expect(mentionsStillIn("check-in", undefined)).toBeUndefined();
  });

  describe("mentionQuery", () => {
    it("opens on an @ at the start or after a space", () => {
      expect(mentionQuery("@", 1)).toEqual({ start: 0, query: "" });
      expect(mentionQuery("nice one @ka", 12)).toEqual({
        start: 9,
        query: "ka",
      });
    });

    it("reads only up to the caret", () => {
      expect(mentionQuery("@ka rest", 3)).toEqual({ start: 0, query: "ka" });
    });

    it("stays shut inside a word or an address", () => {
      expect(mentionQuery("mail@ka", 7)).toBeNull();
      expect(mentionQuery("no tag here", 11)).toBeNull();
    });

    it("keeps a space in the query so a name with one can be found", () => {
      expect(mentionQuery("gg @Big B", 9)).toEqual({
        start: 3,
        query: "Big B",
      });
    });

    it("gives up at a line break", () => {
      expect(mentionQuery("@ka\nnext", 8)).toBeNull();
    });
  });

  describe("rankMentionCandidates", () => {
    const people = [KASPR, KALANI, KAIRO, BIG_BOB, KAI];

    it("puts names that start with the query first, then any that contain it", () => {
      expect(
        rankMentionCandidates(
          [...people, { steam_id: "7", name: "Okami" }],
          "ka",
        ).map(({ candidate }) => candidate.name),
      ).toEqual(["kai", "kairo", "Kalani", "kaspr", "Okami"]);
    });

    it("marks where the query matched, for the bold part", () => {
      const [first] = rankMentionCandidates([KALANI], "la");

      expect(first).toEqual({ candidate: KALANI, start: 2, length: 2 });
    });

    it("lists the first five when nothing has been typed", () => {
      expect(rankMentionCandidates(people, "")).toHaveLength(5);
      expect(
        rankMentionCandidates([...people, { steam_id: "8", name: "zed" }], ""),
      ).toHaveLength(5);
    });

    it("finds a name with a space in it", () => {
      expect(
        rankMentionCandidates(people, "big b").map(
          ({ candidate }) => candidate,
        ),
      ).toEqual([BIG_BOB]);
    });
  });

  it("writes the picked name over what was typed, with a space after", () => {
    expect(insertMention("nice one @ka", 9, 12, "kaspr")).toEqual({
      text: "nice one @kaspr ",
      caret: 16,
    });
  });

  it("reuses a space that is already there", () => {
    expect(insertMention("@ka later", 0, 3, "kaspr")).toEqual({
      text: "@kaspr later",
      caret: 7,
    });
  });

  describe("mentionedSteamIds", () => {
    it("sends the picks whose names are still in the text", () => {
      expect(
        mentionedSteamIds("@kairo hi", [KAIRO, KASPR], []),
      ).toEqual([KAIRO.steam_id]);
    });

    it("takes a member whose name was typed out by hand", () => {
      expect(mentionedSteamIds("@kaspr hi", [], [KAIRO, KASPR])).toEqual([
        KASPR.steam_id,
      ]);
    });

    it("lets a pick settle two members with the same name", () => {
      const twin = { steam_id: "76561198000000009", name: "kairo" };

      expect(mentionedSteamIds("@kairo hi", [twin], [KAIRO, twin])).toEqual([
        twin.steam_id,
      ]);
    });

    it("counts each player once", () => {
      expect(
        mentionedSteamIds("@kairo @kairo", [KAIRO, KAIRO], [KAIRO]),
      ).toEqual([KAIRO.steam_id]);
    });
  });
});
