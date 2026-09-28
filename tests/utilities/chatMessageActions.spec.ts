import { describe, expect, it } from "vitest";
import {
  chatMessagePermissions,
  hasChatMessageActions,
  SELF_SERVICE_WINDOW_MS,
} from "~/utilities/chatMessageActions";
import type { LobbyMessage } from "~/web-sockets/Socket";

const message = {
  id: "7f1d0c2e-8b1a-4c6e-9f00-000000000001",
  message: "gg",
  timestamp: "2026-09-28T12:00:00.000Z",
  from: { steam_id: "76561198000000002" },
};

const viewerSteamId = "76561198000000001";

describe("chatMessagePermissions", () => {
  it.each([
    "match",
    "match_team",
    "matchmaking",
    "tournament",
    "draft",
    "organizers",
  ])("lets a moderator delete in a %s room", (roomType) => {
    expect(
      chatMessagePermissions({
        message,
        viewerSteamId,
        canModerate: true,
        roomType,
      }),
    ).toEqual({ canDelete: true, canEdit: false });
  });

  it("never offers a delete in a direct conversation", () => {
    expect(
      chatMessagePermissions({
        message,
        viewerSteamId,
        canModerate: true,
        roomType: "direct",
      }).canDelete,
    ).toBe(false);
  });

  it("offers nothing to someone who can't moderate", () => {
    expect(
      chatMessagePermissions({
        message,
        viewerSteamId,
        canModerate: false,
        roomType: "match",
      }).canDelete,
    ).toBe(false);
  });

  it("offers nothing for a line the api can't address", () => {
    expect(
      chatMessagePermissions({
        message: { ...message, id: undefined },
        viewerSteamId,
        canModerate: true,
        roomType: "match",
      }).canDelete,
    ).toBe(false);
  });
});

describe("chatMessagePermissions for the author", () => {
  const sentAt = Date.parse("2026-09-28T12:00:00.000Z");

  const own: LobbyMessage = {
    ...message,
    source: "web",
    from: { steam_id: viewerSteamId },
  };

  const permissions = (
    overrides: Partial<LobbyMessage> = {},
    options: { roomType?: string; canModerate?: boolean; age?: number } = {},
  ) =>
    chatMessagePermissions({
      message: { ...own, ...overrides },
      viewerSteamId,
      canModerate: options.canModerate ?? false,
      roomType: options.roomType ?? "match",
      now: sentAt + (options.age ?? 60_000),
    });

  it.each(["match", "matchmaking", "tournament", "direct"])(
    "lets the author edit and delete their own message in a %s room",
    (roomType) => {
      expect(permissions({}, { roomType })).toEqual({
        canDelete: true,
        canEdit: true,
      });
    },
  );

  it("holds the window open until the last millisecond", () => {
    expect(permissions({}, { age: SELF_SERVICE_WINDOW_MS - 1 })).toEqual({
      canDelete: true,
      canEdit: true,
    });
    expect(permissions({}, { age: SELF_SERVICE_WINDOW_MS })).toEqual({
      canDelete: false,
      canEdit: false,
    });
  });

  it("keeps a moderator's delete once their own window has closed", () => {
    expect(
      permissions(
        {},
        { canModerate: true, age: SELF_SERVICE_WINDOW_MS + 60_000 },
      ),
    ).toEqual({ canDelete: true, canEdit: false });
  });

  it("gives nobody a delete in a conversation once the window closes", () => {
    expect(
      permissions(
        {},
        {
          roomType: "direct",
          canModerate: true,
          age: SELF_SERVICE_WINDOW_MS,
        },
      ),
    ).toEqual({ canDelete: false, canEdit: false });
  });

  it("keeps a gagged author's delete in a group room but not the edit", () => {
    expect(
      chatMessagePermissions({
        message: own,
        viewerSteamId,
        viewerGagged: true,
        canModerate: false,
        roomType: "match",
        now: sentAt,
      }),
    ).toEqual({ canDelete: true, canEdit: false });
  });

  it("lets a gagged author edit in a direct conversation", () => {
    expect(
      chatMessagePermissions({
        message: own,
        viewerSteamId,
        viewerGagged: true,
        canModerate: false,
        roomType: "direct",
        now: sentAt,
      }),
    ).toEqual({ canDelete: true, canEdit: true });
  });

  it("never lets a moderator edit someone else's message", () => {
    expect(
      permissions(
        { from: { steam_id: "76561198000000002" } },
        { canModerate: true },
      ),
    ).toEqual({ canDelete: true, canEdit: false });
  });

  it.each([
    ["relayed from the game", { source: "game" as const }],
    ["stored before sources were recorded", { source: undefined }],
    ["with no id", { id: undefined }],
    ["with a timestamp that doesn't parse", { timestamp: "not a date" }],
  ])("offers the author nothing for a line %s", (_, overrides) => {
    expect(permissions(overrides)).toEqual({
      canDelete: false,
      canEdit: false,
    });
  });

  it("offers nothing to a signed-out viewer", () => {
    expect(
      chatMessagePermissions({
        message: own,
        viewerSteamId: null,
        canModerate: false,
        roomType: "match",
        now: sentAt,
      }),
    ).toEqual({ canDelete: false, canEdit: false });
  });
});

describe("hasChatMessageActions", () => {
  it("is true only when something is permitted", () => {
    expect(hasChatMessageActions({ canDelete: true, canEdit: false })).toBe(
      true,
    );
    expect(hasChatMessageActions({ canDelete: false, canEdit: true })).toBe(
      true,
    );
    expect(hasChatMessageActions({ canDelete: false, canEdit: false })).toBe(
      false,
    );
  });
});
