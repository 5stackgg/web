// Build a (steam_id) -> roster_image_url lookup for a given match lineup.
//
// When a lineup has a team_id set, the team's per-roster portraits should
// override the player's own avatar/roster image. Lineup-only matches (no
// team_id) return a no-op lookup so PlayerDisplay falls back to the
// player's own portrait.
//
// Expects each lineup to fetch:
//   team_id: true
//   team: { roster: [ {}, { player_steam_id: true, roster_image_url: true } ] }

interface RosterEntry {
  player_steam_id: string | number;
  roster_image_url?: string | null;
}

interface LineupLike {
  team_id?: string | null;
  team?: {
    roster?: RosterEntry[] | null;
  } | null;
}

export type AvatarOverrideLookup = (
  steamId: string | number | null | undefined,
) => string | null;

const NOOP: AvatarOverrideLookup = () => null;

export function buildLineupAvatarOverride(
  lineup: LineupLike | null | undefined,
): AvatarOverrideLookup {
  if (!lineup || !lineup.team_id) return NOOP;
  const entries = lineup.team?.roster ?? [];
  if (entries.length === 0) return NOOP;
  const map = new Map<string, string>();
  for (const e of entries) {
    if (e.roster_image_url) {
      map.set(String(e.player_steam_id), e.roster_image_url);
    }
  }
  if (map.size === 0) return NOOP;
  return (steamId) => {
    if (steamId == null) return null;
    return map.get(String(steamId)) ?? null;
  };
}
