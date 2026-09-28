import { describe, expect, it } from "vitest";
import {
  chatMessagePermissions,
  hasChatMessageActions,
  heldChatReactions,
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
    ).toEqual({
      canDelete: true,
      canEdit: false,
      canReact: false,
      canAddReaction: false,
    });
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
        canReact: false,
        canAddReaction: false,
      });
    },
  );

  it("holds the window open until the last millisecond", () => {
    expect(permissions({}, { age: SELF_SERVICE_WINDOW_MS - 1 })).toEqual({
      canDelete: true,
      canEdit: true,
      canReact: false,
      canAddReaction: false,
    });
    expect(permissions({}, { age: SELF_SERVICE_WINDOW_MS })).toEqual({
      canDelete: false,
      canEdit: false,
      canReact: false,
      canAddReaction: false,
    });
  });

  it("keeps a moderator's delete once their own window has closed", () => {
    expect(
      permissions(
        {},
        { canModerate: true, age: SELF_SERVICE_WINDOW_MS + 60_000 },
      ),
    ).toEqual({
      canDelete: true,
      canEdit: false,
      canReact: false,
      canAddReaction: false,
    });
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
    ).toEqual({
      canDelete: false,
      canEdit: false,
      canReact: false,
      canAddReaction: false,
    });
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
    ).toEqual({
      canDelete: true,
      canEdit: false,
      canReact: false,
      canAddReaction: false,
    });
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
    ).toEqual({
      canDelete: true,
      canEdit: true,
      canReact: false,
      canAddReaction: false,
    });
  });

  it("never lets a moderator edit someone else's message", () => {
    expect(
      permissions(
        { from: { steam_id: "76561198000000002" } },
        { canModerate: true },
      ),
    ).toEqual({
      canDelete: true,
      canEdit: false,
      canReact: false,
      canAddReaction: false,
    });
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
      canReact: false,
      canAddReaction: false,
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
    ).toEqual({
      canDelete: false,
      canEdit: false,
      canReact: false,
      canAddReaction: false,
    });
  });
});

describe("chatMessagePermissions for reactions", () => {
  const react = (
    overrides: Partial<LobbyMessage> = {},
    options: {
      roomType?: string;
      canPost?: boolean;
      viewerGagged?: boolean;
      viewer?: string | null;
    } = {},
  ) => {
    const { canReact, canAddReaction } = chatMessagePermissions({
      message: { ...message, ...overrides },
      viewerSteamId:
        options.viewer === undefined ? viewerSteamId : options.viewer,
      viewerGagged: options.viewerGagged,
      canModerate: false,
      canPost: options.canPost ?? true,
      roomType: options.roomType ?? "match",
    });

    return { canReact, canAddReaction };
  };

  const both = { canReact: true, canAddReaction: true };
  const neither = { canReact: false, canAddReaction: false };

  it.each([
    "match",
    "match_team",
    "matchmaking",
    "tournament",
    "draft",
    "organizers",
    "direct",
  ])("lets anyone who can post react in a %s room", (roomType) => {
    expect(react({}, { roomType })).toEqual(both);
  });

  it.each([
    ["relayed from the game", { source: "game" as const }],
    ["stored before sources were recorded", { source: undefined }],
    ["of their own", { from: { steam_id: viewerSteamId } }],
    ["long past the edit window", { timestamp: "2020-01-01T00:00:00.000Z" }],
  ])("allows a reaction on a line %s", (_, overrides) => {
    expect(react(overrides)).toEqual(both);
  });

  it("offers nothing where the viewer can't post", () => {
    expect(react({}, { canPost: false })).toEqual(neither);
  });

  it("offers nothing for a line the api can't address", () => {
    expect(react({ id: undefined })).toEqual(neither);
  });

  it("offers nothing to a signed-out viewer", () => {
    expect(react({}, { viewer: null })).toEqual(neither);
  });

  it("offers a gagged player nothing to add in a group room", () => {
    expect(react({}, { viewerGagged: true })).toEqual(neither);
  });

  it("lets a gagged player take back what they already hold", () => {
    expect(
      react(
        { reactions: { heart: ["76561198000000003", viewerSteamId] } },
        { viewerGagged: true },
      ),
    ).toEqual({ canReact: true, canAddReaction: false });
  });

  it("ignores a reaction the viewer holds that isn't on the list", () => {
    expect(
      react({ reactions: { party: [viewerSteamId] } }, { viewerGagged: true }),
    ).toEqual(neither);
  });

  it("doesn't hold a gag against a direct conversation", () => {
    expect(react({}, { viewerGagged: true, roomType: "direct" })).toEqual(
      both,
    );
  });
});

describe("heldChatReactions", () => {
  it("names the reactions the viewer holds", () => {
    expect(
      heldChatReactions(
        {
          ...message,
          reactions: {
            thumbsup: ["76561198000000003"],
            fire: [viewerSteamId],
            sad: [viewerSteamId, "76561198000000003"],
          },
        },
        viewerSteamId,
      ),
    ).toEqual(new Set(["fire", "sad"]));
  });

  it("holds nothing on a message from an api without reactions", () => {
    expect(heldChatReactions(message, viewerSteamId)).toEqual(new Set());
  });
});

describe("hasChatMessageActions", () => {
  const none = {
    canDelete: false,
    canEdit: false,
    canReact: false,
    canAddReaction: false,
  };

  it("is true only when something is permitted", () => {
    expect(hasChatMessageActions({ ...none, canDelete: true })).toBe(true);
    expect(hasChatMessageActions({ ...none, canEdit: true })).toBe(true);
    expect(hasChatMessageActions({ ...none, canReact: true })).toBe(true);
    expect(hasChatMessageActions(none)).toBe(false);
  });
});
