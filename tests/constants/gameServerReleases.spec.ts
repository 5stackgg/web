// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GAME_SERVER_RELEASES_URL,
  PLAYER_MANAGEMENT_CONFIG_PATHS,
  playerManagementConfig,
  playerManagementDownloadUrl,
  pluginReleaseUrl,
} from "~/constants/gameServerReleases";

describe("gameServerReleases", () => {
  it("links a plugin release by its framework-prefixed tag", () => {
    expect(pluginReleaseUrl("swiftlys2", "0.0.412")).toBe(
      `${GAME_SERVER_RELEASES_URL}/tag/sw-v0.0.412`,
    );
    expect(pluginReleaseUrl("counterstrikesharp", "0.0.390")).toBe(
      `${GAME_SERVER_RELEASES_URL}/tag/css-v0.0.390`,
    );
  });

  // The asset name is set in game-server's plugin-build workflow; this is the
  // other half of that contract.
  it("downloads the player management zip published on that release", () => {
    expect(playerManagementDownloadUrl("swiftlys2", "0.0.412")).toBe(
      `${GAME_SERVER_RELEASES_URL}/download/sw-v0.0.412/PlayerManagement-sw-v0.0.412.zip`,
    );
    expect(playerManagementDownloadUrl("counterstrikesharp", "0.0.390")).toBe(
      `${GAME_SERVER_RELEASES_URL}/download/css-v0.0.390/PlayerManagement-css-v0.0.390.zip`,
    );
  });

  it("falls back to the releases page before any version is known", () => {
    expect(playerManagementDownloadUrl("swiftlys2", null)).toBe(
      GAME_SERVER_RELEASES_URL,
    );
  });

  it("nests the SwiftlyS2 config under its section and keeps CounterStrikeSharp flat", () => {
    const settings = {
      apiDomain: "https://api.example.com",
      serverId: "server-1",
      apiPassword: "secret",
    };

    expect(JSON.parse(playerManagementConfig("swiftlys2", settings))).toEqual({
      PlayerManagement: {
        API_DOMAIN: "https://api.example.com",
        SERVER_ID: "server-1",
        SERVER_API_PASSWORD: "secret",
      },
    });
    expect(
      JSON.parse(playerManagementConfig("counterstrikesharp", settings)),
    ).toEqual({
      Version: 1,
      API_DOMAIN: "https://api.example.com",
      SERVER_ID: "server-1",
      SERVER_API_PASSWORD: "secret",
    });
  });

  it("points each framework at the file its plugin reads", () => {
    expect(PLAYER_MANAGEMENT_CONFIG_PATHS.swiftlys2).toBe(
      "addons/swiftlys2/configs/plugins/PlayerManagement/config.jsonc",
    );
    expect(PLAYER_MANAGEMENT_CONFIG_PATHS.counterstrikesharp).toBe(
      "addons/counterstrikesharp/configs/plugins/PlayerManagement/PlayerManagement.json",
    );
  });
});
