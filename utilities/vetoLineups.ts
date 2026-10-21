import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { teamMonogram } from "~/components/watch/watchTicker";
import mapLabel from "~/utilities/mapLabel";
import { mapVetoOrder } from "~/utilities/vetoOrder";
import type {
  VetoBoardItem,
  VetoBoardLineup,
  VetoBoardStep,
} from "~/utilities/vetoOrder";

// Which of the match's two lineups made a pick.
export function lineupSlot(match: any, lineupId: string | null | undefined) {
  if (lineupId && lineupId === match?.lineup_1_id) return 1 as const;
  if (lineupId && lineupId === match?.lineup_2_id) return 2 as const;
  return null;
}

// The match's map pool as the veto board draws it.
export function mapVetoItems(match: any): VetoBoardItem[] {
  return (match?.options?.map_pool?.maps ?? []).map((map: any) => ({
    id: map.id,
    label: mapLabel(map),
    poster: map.poster,
    patch: map.patch,
  }));
}

// Every step of a match's map veto, with the picks made so far.
export function mapVetoSteps(match: any, picks: any[]): VetoBoardStep[] {
  const poolSize = match?.options?.map_pool?.maps?.length ?? 0;
  return mapVetoOrder(match?.options?.best_of, poolSize).map((step, index) => {
    const pick = picks[index];
    return {
      ...step,
      record: pick
        ? {
            itemId: pick.map.id,
            lineup: lineupSlot(match, pick.match_lineup_id),
            side: pick.side,
            auto: pick.auto_picked,
          }
        : null,
    };
  });
}

// The lineup whose turn it is in the map veto, by the api's word.
export function mapVetoTurn(match: any) {
  if (match?.lineup_1?.is_picking_map_veto) return 1 as const;
  if (match?.lineup_2?.is_picking_map_veto) return 2 as const;
  return null;
}

// Whether the viewer makes the map veto's current move: an organizer with
// veto override on, or a captain whose lineup is up. An organizer who is not
// a captain only ever moves through the override.
export function mapVetoPicking(match: any, override: boolean) {
  if (override) return true;
  if (match.is_organizer && !match.is_captain) return false;
  return !!(
    match.lineup_1?.can_pick_map_veto || match.lineup_2?.can_pick_map_veto
  );
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
        resolveAvatarUrl(value?.team?.avatar_url, apiDomain, 128) ??
        (isPug
          ? resolveAvatarUrl(
              captain?.custom_avatar_url || captain?.avatar_url,
              apiDomain,
              128,
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
