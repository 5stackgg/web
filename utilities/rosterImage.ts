import { resolveAvatarUrl } from "./avatarUrl";

// Team contexts must only use a per-team roster portrait. A player's
// personal roster image is NOT a fallback here — uploading a personal
// roster portrait should not silently apply to every team the player is
// on. Bulk-applying to teams is opt-in via the editor's team checkboxes.

type PlayerLike =
  | {
      roster_image_url?: string | null;
    }
  | null
  | undefined;

type TeamRosterLike =
  | {
      roster_image_url?: string | null;
    }
  | null
  | undefined;

export function pickRosterImagePath(
  teamRoster: TeamRosterLike,
  _player: PlayerLike,
): string | null {
  return teamRoster?.roster_image_url ?? null;
}

export function resolveRosterImageUrl(
  teamRoster: TeamRosterLike,
  player: PlayerLike,
  apiDomain: string | null | undefined,
): string | null {
  return resolveAvatarUrl(pickRosterImagePath(teamRoster, player), apiDomain);
}
