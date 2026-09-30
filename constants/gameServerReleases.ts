export const GAME_SERVER_RELEASES_URL =
  "https://github.com/5stackgg/game-server/releases";

// Both plugins release out of the one repo, so the tag carries the framework.
const PLUGIN_RELEASE_TAG_PREFIXES: Record<string, string> = {
  counterstrikesharp: "css",
  swiftlys2: "sw",
};

export const PLAYER_MANAGEMENT_CONFIG_PATHS: Record<string, string> = {
  counterstrikesharp:
    "addons/counterstrikesharp/configs/plugins/PlayerManagement/PlayerManagement.json",
  swiftlys2: "addons/swiftlys2/configs/plugins/PlayerManagement/config.jsonc",
};

function pluginReleaseTag(runtime: string, version: string) {
  return `${PLUGIN_RELEASE_TAG_PREFIXES[runtime] ?? "sw"}-v${version}`;
}

export function pluginReleaseUrl(runtime: string, version: string) {
  return `${GAME_SERVER_RELEASES_URL}/tag/${pluginReleaseTag(runtime, version)}`;
}

// The player management zip is published on the same release as the match
// plugin, named after its tag, so a version is all a link needs.
export function playerManagementDownloadUrl(
  runtime: string,
  version: string | null | undefined,
) {
  if (!version) {
    return GAME_SERVER_RELEASES_URL;
  }

  const tag = pluginReleaseTag(runtime, version);

  return `${GAME_SERVER_RELEASES_URL}/download/${tag}/PlayerManagement-${tag}.zip`;
}

// SwiftlyS2 binds the "PlayerManagement" section of config.jsonc, while
// CounterStrikeSharp loads PlayerManagement.json as a flat object.
export function playerManagementConfig(
  runtime: string,
  settings: {
    apiDomain: string;
    serverId: string;
    apiPassword: string | null | undefined;
  },
) {
  const config = {
    API_DOMAIN: settings.apiDomain,
    SERVER_ID: settings.serverId,
    SERVER_API_PASSWORD: settings.apiPassword ?? "",
  };

  return JSON.stringify(
    runtime === "counterstrikesharp"
      ? { Version: 1, ...config }
      : { PlayerManagement: config },
    null,
    2,
  );
}
