// Presence and live-on-Twitch are app state the index does not know, so each
// arrives as the roster the caller can see, and a player has to be on every
// roster that was sent. null means no roster was sent at all; an empty list
// means nobody qualifies.
export function playersSearchSteamIds(body: {
  online_steam_ids?: unknown;
  live_steam_ids?: unknown;
}): string[] | null {
  const rosters = [body.online_steam_ids, body.live_steam_ids]
    .filter((roster): roster is unknown[] => Array.isArray(roster))
    .map((roster) =>
      roster.map((id) => String(id)).filter((id) => /^[0-9]+$/.test(id)),
    );

  if (rosters.length === 0) {
    return null;
  }

  const [first, ...rest] = rosters;

  return [...new Set(first)].filter((id) =>
    rest.every((roster) => roster.includes(id)),
  );
}
