import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { teamMonogram } from "~/components/watch/watchTicker";
import type { VetoBoardLineup } from "~/utilities/vetoOrder";

// Which of the match's two lineups made a pick.
export function lineupSlot(match: any, lineupId: string | null | undefined) {
  if (lineupId && lineupId === match?.lineup_1_id) return 1 as const;
  if (lineupId && lineupId === match?.lineup_2_id) return 2 as const;
  return null;
}

// The lineup the signed-in player is on, if any.
export function viewerSlot(match: any, steamId: string | null | undefined) {
  if (!steamId) return null;
  const on = (lineup: any) =>
    (lineup?.lineup_players ?? []).some(
      (member: any) => String(member.steam_id) === String(steamId),
    );
  if (on(match?.lineup_1)) return 1 as const;
  if (on(match?.lineup_2)) return 2 as const;
  return null;
}

// The two lineups as the veto board shows them. A pickup game's lineups are
// named after their captains, so the captain's face stands in for the missing
// team crest; anything else without a crest gets a monogram.
export function vetoLineups(
  match: any,
  t: (key: string) => string,
): [VetoBoardLineup, VetoBoardLineup] {
  const apiDomain = useRuntimeConfig().public.apiDomain as string;
  const isPug = !match?.lineup_1?.team_id && !match?.lineup_2?.team_id;

  const lineup = (value: any, fallback: string): VetoBoardLineup => {
    const name = value?.name || fallback;
    const captain = (value?.lineup_players ?? []).find(
      (member: any) => member.captain,
    )?.player;
    return {
      name,
      crest:
        resolveAvatarUrl(value?.team?.avatar_url, apiDomain) ??
        (isPug
          ? resolveAvatarUrl(
              captain?.custom_avatar_url || captain?.avatar_url,
              apiDomain,
            )
          : null),
      monogram: teamMonogram(name),
    };
  };

  return [
    lineup(match?.lineup_1, t("match.lineup.lineup_1")),
    lineup(match?.lineup_2, t("match.lineup.lineup_2")),
  ];
}
