// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CHAT_MUTE_DURATIONS,
  chatRoomAlerts,
  chatRoomQuietAt,
  muteEndsAt,
  nextMuteExpiry,
  type ChatRoomSetting,
} from "~/utilities/chatRoomSettings";
import { chatRoomSettingsThread } from "~/utilities/chatThread";

const NOW = Date.UTC(2026, 9, 15, 12, 0);
const later = (minutes: number) =>
  new Date(NOW + minutes * 60_000).toISOString();

const setting = (over: Partial<ChatRoomSetting> = {}): ChatRoomSetting => ({
  muted: false,
  muted_until: null,
  notify: "all",
  ...over,
});

describe("chatRoomQuietAt", () => {
  it("is loud for a room never set", () => {
    expect(chatRoomQuietAt(undefined, NOW)).toEqual({
      muted: false,
      mutedUntil: null,
      notify: "all",
    });
  });

  it("is muted until the player unmutes it", () => {
    expect(chatRoomQuietAt(setting({ muted: true }), NOW)).toEqual({
      muted: true,
      mutedUntil: null,
      notify: "all",
    });
  });

  it("holds a timed mute until it runs out, and not a moment past", () => {
    const timed = setting({ muted: true, muted_until: later(15) });

    expect(chatRoomQuietAt(timed, NOW).muted).toBe(true);
    expect(chatRoomQuietAt(timed, NOW).mutedUntil).toBe(later(15));
    expect(chatRoomQuietAt(timed, NOW + 15 * 60_000).muted).toBe(false);
    expect(chatRoomQuietAt(timed, NOW + 15 * 60_000).mutedUntil).toBeNull();
  });

  it("keeps the room's level whether or not it is muted", () => {
    expect(
      chatRoomQuietAt(
        setting({ muted: true, muted_until: later(-1), notify: "mentions" }),
        NOW,
      ),
    ).toEqual({ muted: false, mutedUntil: null, notify: "mentions" });
  });
});

describe("chatRoomAlerts", () => {
  const quiet = (over: Partial<ChatRoomSetting>) =>
    chatRoomQuietAt(setting(over), NOW);

  it("rings for everything in a room left alone", () => {
    expect(chatRoomAlerts(quiet({}), false)).toBe(true);
    expect(chatRoomAlerts(quiet({}), true)).toBe(true);
  });

  it("rings only for a tag in a muted room", () => {
    expect(chatRoomAlerts(quiet({ muted: true }), false)).toBe(false);
    expect(chatRoomAlerts(quiet({ muted: true }), true)).toBe(true);
  });

  it("rings only for a tag in a room set to only tags, muted or not", () => {
    expect(chatRoomAlerts(quiet({ notify: "mentions" }), false)).toBe(false);
    expect(chatRoomAlerts(quiet({ notify: "mentions" }), true)).toBe(true);
  });

  it("never rings in a room set to nothing, tags included", () => {
    expect(chatRoomAlerts(quiet({ notify: "nothing" }), false)).toBe(false);
    expect(chatRoomAlerts(quiet({ notify: "nothing" }), true)).toBe(false);
  });

  it("rings again once a timed mute has run out", () => {
    expect(
      chatRoomAlerts(quiet({ muted: true, muted_until: later(-1) }), false),
    ).toBe(true);
  });
});

describe("nextMuteExpiry", () => {
  it("is the soonest timed mute still running", () => {
    expect(
      nextMuteExpiry(
        [
          setting({ muted: true, muted_until: later(60) }),
          setting({ muted: true, muted_until: later(-5) }),
          setting({ muted: true, muted_until: later(15) }),
          setting({ muted: true }),
          setting({ muted: false }),
        ],
        NOW,
      ),
    ).toBe(NOW + 15 * 60_000);
  });

  it("is nothing when no mute will run out", () => {
    expect(
      nextMuteExpiry([setting({ muted: true }), setting()], NOW),
    ).toBeNull();
  });
});

describe("muteEndsAt", () => {
  it("offers 15 minutes, an hour, 8 hours, a day, and until unmuted", () => {
    expect(CHAT_MUTE_DURATIONS).toEqual([15, 60, 480, 1440, null]);
  });

  it("ends a timed mute that many minutes from now", () => {
    expect(muteEndsAt(60, NOW)).toBe(later(60));
  });

  it("gives a mute until unmuted no end", () => {
    expect(muteEndsAt(null, NOW)).toBeNull();
  });
});

describe("chatRoomSettingsThread", () => {
  it("keeps a side's team room under its match room, as the api does", () => {
    expect(chatRoomSettingsThread("match_team", "m-1:l-2")).toBe(
      "chat:match:m-1",
    );
  });

  it("keeps every other room under its own thread", () => {
    expect(chatRoomSettingsThread("direct", "1:2")).toBe("chat:direct:1:2");
    expect(chatRoomSettingsThread("team", "t-1")).toBe("chat:team:t-1");
  });
});
