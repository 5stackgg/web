import { e_match_status_enum } from "~/generated/zeus";

export type MatchActionKind = "check_in" | "region_veto" | "map_veto";

type ActionLineup = {
  name?: string | null;
  is_on_lineup?: boolean | null;
  is_ready?: boolean | null;
  can_pick_map_veto?: boolean | null;
  can_pick_region_veto?: boolean | null;
  lineup_players?: Array<{
    checked_in?: boolean | null;
    player?: { steam_id?: string | number | null } | null;
  }> | null;
} | null;

export type ActionMatch = {
  id: string;
  status?: string | null;
  is_in_lineup?: boolean | null;
  can_check_in?: boolean | null;
  map_veto_type?: string | null;
  region?: string | null;
  options?: { region_veto?: boolean | null } | null;
  lineup_1?: ActionLineup;
  lineup_2?: ActionLineup;
  draft_games?: Array<{ id: string }> | null;
};

export type MatchAction = {
  id: string;
  kind: MatchActionKind;
  match: ActionMatch;
  path: string;
};

export function matchActions(
  matches: ActionMatch[] | null | undefined,
  mySteamId: string | number | null | undefined,
): MatchAction[] {
  if (!mySteamId) {
    return [];
  }

  const me = String(mySteamId);
  const actions: MatchAction[] = [];

  for (const match of matches ?? []) {
    if (!match.is_in_lineup) {
      continue;
    }

    const mine = [match.lineup_1, match.lineup_2].find(
      (lineup) => lineup?.is_on_lineup,
    );
    if (!mine) {
      continue;
    }

    const draftGameId = match.draft_games?.[0]?.id;
    const path = draftGameId
      ? `/draft-room/${draftGameId}`
      : `/matches/${match.id}`;

    if (match.status === e_match_status_enum.WaitingForCheckIn) {
      const myRow = (mine.lineup_players ?? []).find(
        (row) => String(row.player?.steam_id ?? "") === me,
      );
      if (match.can_check_in && myRow && !myRow.checked_in && !mine.is_ready) {
        actions.push({
          id: `match-check_in:${match.id}`,
          kind: "check_in",
          match,
          path,
        });
      }
      continue;
    }

    if (match.status !== e_match_status_enum.Veto) {
      continue;
    }

    // can_pick_map_veto is already true for lineup 1 during the region veto,
    // and can_pick_region_veto ignores whether the match has a region veto at
    // all. The match page splits the two vetoes this way; the toasts follow.
    const regionVetoRunning = !!match.options?.region_veto && !match.region;

    if (regionVetoRunning) {
      if (mine.can_pick_region_veto) {
        actions.push({
          id: `match-region_veto:${match.id}`,
          kind: "region_veto",
          match,
          path,
        });
      }
    } else if (mine.can_pick_map_veto && match.map_veto_type) {
      // The pick snake hands one lineup a Side and then a Pick back to back,
      // so can_pick_map_veto never flips between them; the step type is what
      // makes the second one a new turn that a dismissal must not cover.
      actions.push({
        id: `match-map_veto:${match.id}:${match.map_veto_type}`,
        kind: "map_veto",
        match,
        path,
      });
    }
  }

  return actions;
}

export function isOnMatchActionPage(
  action: MatchAction,
  routePath: string,
): boolean {
  const path = routePath.replace(/\/+$/, "");
  return [`/matches/${action.match.id}`, action.path].some(
    (page) => path === page || path.startsWith(`${page}/`),
  );
}
