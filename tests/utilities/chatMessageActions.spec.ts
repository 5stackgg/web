import { describe, expect, it } from "vitest";
import {
  chatMessagePermissions,
  hasChatMessageActions,
} from "~/utilities/chatMessageActions";

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
    ).toEqual({ canDelete: true });
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

describe("hasChatMessageActions", () => {
  it("is true only when something is permitted", () => {
    expect(hasChatMessageActions({ canDelete: true })).toBe(true);
    expect(hasChatMessageActions({ canDelete: false })).toBe(false);
  });
});
