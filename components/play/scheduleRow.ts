import {
  currentMatchMap,
  formatStartTime,
  teamMonogram,
} from "~/components/watch/watchTicker";

type Translate = (key: string, values?: Record<string, unknown>) => string;

export type ScheduleContext = {
  t: Translate;
  locale: string;
  now: Date;
  meSteamId?: string | null;
};

export type ScheduleTeam = {
  name: string;
  monogram: string;
  avatar: string | null;
};

export type ScheduleAction = "check_in" | "connect" | "open_match" | "details";

export type ScheduleRowModel = {
  key: string;
  kind: "match" | "tournament";
  id: string;
  time: string;
  sub: string;
  teams: [ScheduleTeam, ScheduleTeam] | null;
  title: string | null;
  meta: string;
  state: { text: string; tone: "hot" | "live" | "ok" | "muted" };
  action: ScheduleAction;
  // Live first, then by start time.
  sortAt: number;
};

// "in 15 min", "in 2 h", "tomorrow", "in 3 days" -- empty once it's started.
export function relativeWhen(at: Date, now: Date, t: Translate): string {
  const minutes = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return "";
  if (minutes < 60)
    return t("pages.play.schedule.in_minutes", { count: minutes });
  if (at.toDateString() === now.toDateString()) {
    return t("pages.play.schedule.in_hours", {
      count: Math.round(minutes / 60),
    });
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (at.toDateString() === tomorrow.toDateString()) {
    return t("pages.play.schedule.tomorrow");
  }
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const days = Math.floor((at.getTime() - midnight.getTime()) / 86_400_000);
  return t("pages.play.schedule.in_days", { count: days });
}

function lineupTeam(lineup: any): ScheduleTeam {
  const name = lineup?.team?.name || lineup?.name || "?";
  return {
    name,
    monogram: teamMonogram(name, lineup?.team?.short_name),
    avatar: lineup?.team?.avatar_url ?? null,
  };
}

function lineupPlayers(match: any): any[] {
  return [
    ...(match?.lineup_1?.lineup_players ?? []),
    ...(match?.lineup_2?.lineup_players ?? []),
  ];
}

function bestOfLabel(bestOf: number | undefined, t: Translate) {
  return bestOf ? t("pages.play.schedule.best_of", { count: bestOf }) : null;
}

function matchMeta(match: any, t: Translate): string {
  const bracket = match?.tournament_brackets?.[0];
  const maps: any[] = match?.match_maps ?? [];
  const parts = [
    bracket?.stage?.tournament?.name ?? match?.options?.type ?? null,
    bestOfLabel(match?.options?.best_of, t),
    maps.length === 1 ? maps[0]?.map?.label || maps[0]?.map?.name : null,
    match?.region ?? null,
  ];
  return parts.filter(Boolean).join(" · ");
}

function matchState(
  match: any,
  ctx: ScheduleContext,
): Pick<ScheduleRowModel, "state" | "action"> {
  const { t } = ctx;
  switch (match?.status) {
    case "Live": {
      const map = currentMatchMap(match);
      const round = map
        ? (map.lineup_1_score ?? 0) + (map.lineup_2_score ?? 0) + 1
        : null;
      return {
        state: {
          text: round
            ? t("pages.play.schedule.live_round", { round })
            : t("pages.play.schedule.live"),
          tone: "live",
        },
        // The connect link only exists for players the server lets in; the
        // match page owns everything else (camera, TV, booting).
        action: match?.connection_link ? "connect" : "open_match",
      };
    }
    case "WaitingForCheckIn": {
      const players = lineupPlayers(match);
      const checked = players.filter((p) => p.checked_in).length;
      const mine = players.find(
        (p) =>
          ctx.meSteamId &&
          String(p.player?.steam_id ?? p.steam_id) === String(ctx.meSteamId),
      );
      const progress = t("pages.play.schedule.check_in_progress", {
        checked,
        total: players.length,
      });
      if (mine?.checked_in) {
        return {
          state: {
            text: t("pages.play.schedule.checked_in", {
              checked,
              total: players.length,
            }),
            tone: "ok",
          },
          action: "open_match",
        };
      }
      const closes = match?.cancels_at
        ? ` · ${t("pages.play.schedule.check_in_closes", {
            time: formatStartTime(match.cancels_at, ctx.now, ctx.locale),
          })}`
        : "";
      return {
        state: { text: progress + closes, tone: "hot" },
        action: match?.can_check_in ? "check_in" : "open_match",
      };
    }
    case "Veto":
      return {
        state: { text: t("pages.play.schedule.veto"), tone: "muted" },
        action: "open_match",
      };
    case "WaitingForServer":
      return {
        state: {
          text: t("pages.play.schedule.waiting_for_server"),
          tone: "muted",
        },
        action: "open_match",
      };
    case "PickingPlayers":
      return {
        state: {
          text: t("pages.play.schedule.picking_players"),
          tone: "muted",
        },
        action: "open_match",
      };
    default:
      return {
        state: { text: t("pages.play.schedule.scheduled"), tone: "muted" },
        action: "open_match",
      };
  }
}

export function scheduleMatchRow(
  match: any,
  ctx: ScheduleContext,
): ScheduleRowModel {
  const startIso = match?.scheduled_at as string | null | undefined;
  const start = startIso ? new Date(startIso) : null;
  const upcoming = !!start && start.getTime() > ctx.now.getTime();
  const { state, action } = matchState(match, ctx);
  return {
    key: `match-${match.id}`,
    kind: "match",
    id: match.id,
    time:
      upcoming && startIso
        ? formatStartTime(startIso, ctx.now, ctx.locale)
        : ctx.t("pages.play.schedule.now"),
    sub: upcoming && start ? relativeWhen(start, ctx.now, ctx.t) : "",
    teams: [lineupTeam(match?.lineup_1), lineupTeam(match?.lineup_2)],
    title: null,
    meta: matchMeta(match, ctx.t),
    state,
    action,
    sortAt:
      match?.status === "Live"
        ? Number.NEGATIVE_INFINITY
        : (start?.getTime() ?? ctx.now.getTime()),
  };
}

const TYPE_FORMATS: Record<string, string> = {
  Competitive: "5v5",
  Wingman: "2v2",
  Duel: "1v1",
};

function tournamentState(
  tournament: any,
  ctx: ScheduleContext,
): ScheduleRowModel["state"] {
  const { t } = ctx;
  if (tournament?.status === "Live" || tournament?.status === "Paused") {
    return { text: t("pages.play.schedule.live"), tone: "live" };
  }
  if (tournament?.check_in_open) {
    return { text: t("pages.play.schedule.check_in_open"), tone: "hot" };
  }
  const opensBefore = tournament?.check_in_opens_before_minutes;
  if (tournament?.check_in_required && tournament?.start && opensBefore) {
    const opens = new Date(
      new Date(tournament.start).getTime() - opensBefore * 60_000,
    );
    if (opens.getTime() > ctx.now.getTime()) {
      return {
        text: t("pages.play.schedule.check_in_opens", {
          time: formatStartTime(opens.toISOString(), ctx.now, ctx.locale),
        }),
        tone: "muted",
      };
    }
  }
  return { text: t("pages.play.schedule.registered"), tone: "ok" };
}

export function scheduleTournamentRow(
  tournament: any,
  ctx: ScheduleContext,
): ScheduleRowModel {
  const start = tournament?.start ? new Date(tournament.start) : null;
  const live = tournament?.status === "Live" || tournament?.status === "Paused";
  const teams = tournament?.teams_aggregate?.aggregate?.count;
  const meta = [
    TYPE_FORMATS[tournament?.options?.type] ?? tournament?.options?.type,
    tournament?.stages?.[0]?.e_tournament_stage_type?.description,
    teams ? ctx.t("pages.play.schedule.teams", { count: teams }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    key: `tournament-${tournament.id}`,
    kind: "tournament",
    id: tournament.id,
    time:
      start && !live
        ? formatStartTime(tournament.start, ctx.now, ctx.locale)
        : ctx.t("pages.play.schedule.now"),
    sub: start && !live ? relativeWhen(start, ctx.now, ctx.t) : "",
    teams: null,
    title: tournament?.name ?? "",
    meta,
    state: tournamentState(tournament, ctx),
    action: "details",
    sortAt: live
      ? Number.NEGATIVE_INFINITY
      : (start?.getTime() ?? Number.POSITIVE_INFINITY),
  };
}

export function sortScheduleRows(rows: ScheduleRowModel[]) {
  // Compared rather than subtracted: two live rows are both -Infinity.
  return [...rows].sort((a, b) =>
    a.sortAt === b.sortAt ? 0 : a.sortAt < b.sortAt ? -1 : 1,
  );
}
