// vue-i18n's t, including its (key, named, plural) form.
type Translate = (key: string, ...args: any[]) => string;

export const DRAFT_RANK_MIN = 0;
export const DRAFT_RANK_MAX = 30000;
export const DRAFT_RANK_STEP = 500;

export type DraftSort = "filling" | "newest" | "rank_high" | "rank_low";

export type DraftFilters = {
  format: string;
  search: string;
  hasSpace: boolean;
  rankRange: number[];
  sort: DraftSort;
};

export const defaultDraftFilters = (): DraftFilters => ({
  format: "all",
  search: "",
  hasSpace: false,
  rankRange: [DRAFT_RANK_MIN, DRAFT_RANK_MAX],
  sort: "filling",
});

export const acceptedPlayers = (game: any): any[] =>
  (game?.players ?? []).filter((p: any) => p.status === "Accepted");

export const waitlistPlayers = (game: any): any[] =>
  (game?.players ?? []).filter((p: any) => p.status === "Waitlist");

// "5v5" from capacity; an odd capacity falls back to the match type.
export function draftFormat(game: any): string {
  const cap = game?.capacity;
  if (cap && cap % 2 === 0) return `${cap / 2}v${cap / 2}`;
  return String(game?.type ?? "").slice(0, 4);
}

// Rooms carry no name: two pre-made teams read as the matchup, anything
// else as its match type ("Competitive", "Wingman").
export function draftTitle(game: any, t: Translate): string {
  if (game?.mode === "Teams" && game?.team_1?.name) {
    return t("pages.play.draft_rooms.teams_title", {
      team1: game.team_1.name,
      team2: game.team_2?.name ?? t("pages.play.draft_rooms.open_team"),
    });
  }
  const type = String(game?.type ?? "");
  const key = `matchmaking.match_types.${type.toLowerCase()}.title`;
  const label = type ? t(key) : "";
  return label && label !== key ? label : type;
}

export function draftAvgRank(game: any): number {
  const list = acceptedPlayers(game).filter((p) => p.elo_snapshot);
  if (!list.length) return 0;
  return Math.round(
    list.reduce((sum: number, p: any) => sum + p.elo_snapshot, 0) / list.length,
  );
}

const TYPE_KEYS: Record<string, string> = {
  Captains: "pages.play.draft_rooms.types.captains",
  Host: "pages.play.draft_rooms.types.host",
  Pug: "pages.play.draft_rooms.types.pug",
  Teams: "pages.play.draft_rooms.types.teams",
};

const ACCESS_KEYS: Record<string, string> = {
  Friends: "pages.play.draft_rooms.access.friends",
  Invite: "pages.play.draft_rooms.access.invite",
  Private: "pages.play.draft_rooms.access.private",
};

// The one muted line under a room's title. Plain text, no chips: draft type,
// access only when it isn't open, average rank, regions, and a custom mode
// spelled out as unranked.
export function draftMetaParts(game: any, t: Translate, locale?: string) {
  const parts: string[] = [];
  if (TYPE_KEYS[game?.mode]) parts.push(t(TYPE_KEYS[game.mode]));
  if (ACCESS_KEYS[game?.access]) parts.push(t(ACCESS_KEYS[game.access]));
  const avg = draftAvgRank(game);
  if (avg) {
    parts.push(
      t("pages.play.draft_rooms.avg", {
        rank: avg.toLocaleString(locale),
      }),
    );
  }
  if (game?.regions?.length) parts.push(game.regions.join(", "));
  const mode = game?.options?.game_mode?.name;
  if (mode) parts.push(t("pages.play.draft_rooms.custom_mode", { mode }));
  return parts;
}

export type DraftActionKind =
  "join" | "join_party" | "request" | "requested" | "view" | "sign_in";

export type DraftAction = {
  kind: DraftActionKind;
  label: string;
  reason: string;
  disabled: boolean;
};

export type DraftViewer = {
  meSteamId: string | null | undefined;
  // Accepted members of my party, me included.
  partySize: number;
  isPartyLeader: boolean;
};

export function draftAction(
  game: any,
  viewer: DraftViewer,
  t: Translate,
): DraftAction {
  const accepted = acceptedPlayers(game);
  const left = Math.max((game?.capacity ?? 0) - accepted.length, 0);
  const subs = waitlistPlayers(game).length;
  const mine = viewer.meSteamId
    ? (game?.players ?? []).find(
        (p: any) => String(p.steam_id) === String(viewer.meSteamId),
      )
    : undefined;
  const spots = t(
    "pages.play.draft_rooms.reasons.spots_left",
    { count: left },
    left,
  );

  if (mine && mine.status !== "Requested") {
    return {
      kind: "view",
      label: t("draft_games.card.view"),
      reason: t("pages.play.draft_rooms.reasons.youre_in"),
      disabled: false,
    };
  }
  if (mine?.status === "Requested") {
    return {
      kind: "requested",
      label: t("draft_games.card.requested"),
      reason: t("pages.play.draft_rooms.reasons.waiting_for_host"),
      disabled: true,
    };
  }
  if (left === 0) {
    return {
      kind: "view",
      label: t("draft_games.card.view"),
      reason: subs
        ? t(
            "pages.play.draft_rooms.reasons.subs_waiting",
            { count: subs },
            subs,
          )
        : t("pages.play.draft_rooms.reasons.full"),
      disabled: false,
    };
  }
  if (!viewer.meSteamId) {
    return {
      kind: "sign_in",
      label: t("pages.play.draft_rooms.sign_in_to_join"),
      reason: spots,
      disabled: false,
    };
  }
  if (game?.require_approval) {
    return {
      kind: "request",
      label: t("draft_games.card.request"),
      reason: t("pages.play.draft_rooms.reasons.host_approves"),
      disabled: false,
    };
  }
  if (viewer.isPartyLeader && viewer.partySize > 1) {
    if (left >= viewer.partySize) {
      return {
        kind: "join_party",
        label: t("pages.play.draft_rooms.join_party", {
          count: viewer.partySize,
        }),
        reason: spots,
        disabled: false,
      };
    }
    return {
      kind: "join",
      label: t("draft_games.card.join"),
      reason: t("pages.play.draft_rooms.reasons.no_room_for_party"),
      disabled: false,
    };
  }
  return {
    kind: "join",
    label: t("draft_games.card.join"),
    reason: spots,
    disabled: false,
  };
}

export function draftFormats(games: any[]): string[] {
  const formats = Array.from(new Set(games.map(draftFormat)));
  // Biggest format first: 5v5, 3v3, 2v2, 1v1.
  return formats.sort((a, b) => parseInt(b) - parseInt(a));
}

export function draftFilterCount(filters: DraftFilters): number {
  let count = 0;
  if (filters.hasSpace) count++;
  if (
    filters.rankRange[0] > DRAFT_RANK_MIN ||
    filters.rankRange[1] < DRAFT_RANK_MAX
  ) {
    count++;
  }
  if (filters.sort !== "filling") count++;
  return count;
}

export function filterDraftRooms(games: any[], filters: DraftFilters): any[] {
  let list = [...games];
  if (filters.format !== "all") {
    list = list.filter((game) => draftFormat(game) === filters.format);
  }
  if (filters.hasSpace) {
    list = list.filter(
      (game) => acceptedPlayers(game).length < (game?.capacity ?? 0),
    );
  }
  const [min, max] = filters.rankRange;
  if (min > DRAFT_RANK_MIN || max < DRAFT_RANK_MAX) {
    list = list.filter((game) => {
      const avg = draftAvgRank(game);
      return avg > 0 && avg >= min && avg <= max;
    });
  }
  const query = filters.search.trim().toLowerCase();
  if (query) {
    list = list.filter((game) =>
      [
        game?.host?.name ?? "",
        ...(game?.players ?? []).map((p: any) => p.player?.name ?? ""),
      ].some((name: string) => name.toLowerCase().includes(query)),
    );
  }
  const fill = (game: any) =>
    acceptedPlayers(game).length / Math.max(game?.capacity ?? 1, 1);
  list.sort((a, b) => {
    switch (filters.sort) {
      case "newest":
        return String(b.created_at).localeCompare(String(a.created_at));
      case "rank_high":
        return draftAvgRank(b) - draftAvgRank(a);
      case "rank_low":
        return draftAvgRank(a) - draftAvgRank(b);
      default:
        // Rooms you can still get into come first, closest to starting on top;
        // full rooms sink below them.
        return (
          Number(fill(a) >= 1) - Number(fill(b) >= 1) ||
          fill(b) - fill(a) ||
          acceptedPlayers(b).length - acceptedPlayers(a).length
        );
    }
  });
  return list;
}
