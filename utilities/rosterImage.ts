import { resolveAvatarUrl } from "./avatarUrl";

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
  player: PlayerLike,
): string | null {
  return teamRoster?.roster_image_url ?? player?.roster_image_url ?? null;
}

export function resolveRosterImageUrl(
  teamRoster: TeamRosterLike,
  player: PlayerLike,
  apiDomain: string | null | undefined,
): string | null {
  return resolveAvatarUrl(pickRosterImagePath(teamRoster, player), apiDomain);
}
