// Ample for any roster the page sends, and a ceiling on what a caller of this
// public route can make it scan.
const MAX_ROSTER = 5000;

const STEAM_ID = /^\d{1,20}$/;

function roster(value: unknown): Set<string> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const steamIds = new Set<string>();
  for (const id of value.slice(0, MAX_ROSTER)) {
    if (
      typeof id !== "string" &&
      typeof id !== "number" &&
      typeof id !== "bigint"
    ) {
      continue;
    }
    const steamId = String(id);
    if (STEAM_ID.test(steamId)) {
      steamIds.add(steamId);
    }
  }

  return steamIds;
}

// Presence and live-on-Twitch are app state the index does not know, so each
// arrives as the roster the caller can see, and a player has to be on every
// roster that was sent. null means no roster was sent at all; an empty list
// means nobody qualifies.
export function playersSearchSteamIds(body: {
  online_steam_ids?: unknown;
  live_steam_ids?: unknown;
}): string[] | null {
  const rosters = [
    roster(body.online_steam_ids),
    roster(body.live_steam_ids),
  ].filter((steamIds): steamIds is Set<string> => steamIds !== null);

  if (rosters.length === 0) {
    return null;
  }

  const [first, ...rest] = rosters;

  return [...first].filter((steamId) =>
    rest.every((steamIds) => steamIds.has(steamId)),
  );
}
