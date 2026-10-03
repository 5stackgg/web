import type { WatchStream } from "~/components/watch/streamPlatform";

type Translate = (key: string, values?: Record<string, unknown>) => string;

// Statuses the ticker treats as "on now". The live subscription asks for
// these; anything else is upcoming (Scheduled) or a result (Finished).
export const TICKER_LIVE_STATUSES = [
  "Live",
  "WaitingForServer",
  "Veto",
  "WaitingForCheckIn",
] as const;

export const TICKER_UPCOMING_LIMIT = 10;
export const TICKER_RESULTS_PAGE = 12;

const MAP_OVER_STATUSES = ["Finished", "WaitingForTV", "UploadingDemo"];

export type TickerFilter = "all" | "live" | "upcoming" | "results";
export type TickerKind = "live" | "pre" | "upcoming" | "result";

export type TickerTeam = {
  name: string;
  monogram: string;
  avatar: string | null;
  score: number | null;
  pips: { won: number; total: number } | null;
  // win = bold on a final; trail = muted while live.
  emphasis: "win" | "trail" | null;
};

export type TickerCellModel = {
  id: string;
  kind: TickerKind;
  status: { dot: "live" | "idle" | null; text: string };
  teams: [TickerTeam, TickerTeam];
  tag: string | null;
  you: boolean;
  streams: WatchStream[];
};

export function currentMatchMap(match: any): any | null {
  const maps: any[] = match?.match_maps ?? [];
  return (
    maps.find((mm) => mm.is_current_map) ??
    maps.find((mm) => !mm.winning_lineup_id) ??
    maps[maps.length - 1] ??
    null
  );
}

function mapsWon(match: any, lineupId: string | null | undefined) {
  if (!lineupId) return 0;
  return (match?.match_maps ?? []).filter(
    (mm: any) => mm.winning_lineup_id === lineupId,
  ).length;
}

function mapLabel(mm: any): string {
  return mm?.map?.label || mm?.map?.name || "";
}

export function teamMonogram(name: string, shortName?: string | null) {
  if (shortName) return shortName.slice(0, 3).toUpperCase();
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/);
  const letters =
    words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "?";
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

// "21:30" today, "Sat 12:00" this week, "Oct 31, 19:00" beyond that.
export function formatStartTime(iso: string, now: Date, locale: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  if (sameDay(d, now)) return d.toLocaleTimeString(locale, time);
  const days = (d.getTime() - now.getTime()) / 86_400_000;
  if (days > 0 && days < 6) {
    return d.toLocaleString(locale, { weekday: "short", ...time });
  }
  return d.toLocaleString(locale, { month: "short", day: "numeric", ...time });
}

// Day divider for results: "Today", "Yesterday", then "Wed, Sep 30".
export function resultDayLabel(
  iso: string | null | undefined,
  now: Date,
  t: Translate,
  locale: string,
) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (sameDay(d, now)) return t("pages.watch.ticker.today");
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return t("pages.watch.ticker.yesterday");
  return d.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function hasOvertime(match: any) {
  const mr: number = match?.options?.mr ?? 12;
  return (match?.match_maps ?? []).some(
    (mm: any) => (mm.lineup_1_score ?? 0) + (mm.lineup_2_score ?? 0) > mr * 2,
  );
}

function checkInCounts(match: any) {
  const players = [
    ...(match?.lineup_1?.lineup_players ?? []),
    ...(match?.lineup_2?.lineup_players ?? []),
  ];
  const perLineup: number | null = match?.max_players_per_lineup ?? null;
  return {
    checked: players.filter((p: any) => p.checked_in).length,
    total: perLineup ? perLineup * 2 : players.length,
  };
}

export function tickerKind(match: any): TickerKind {
  if (match?.status === "Live") return "live";
  if ((TICKER_LIVE_STATUSES as readonly string[]).includes(match?.status)) {
    return "pre";
  }
  if (match?.status === "Scheduled") return "upcoming";
  return "result";
}

function statusLine(
  match: any,
  kind: TickerKind,
  t: Translate,
  locale: string,
  now: Date,
): TickerCellModel["status"] {
  if (kind === "result") {
    const bestOf: number = match?.options?.best_of ?? 1;
    if (bestOf > 1) {
      return {
        dot: null,
        text: t("pages.watch.ticker.final_best_of", { count: bestOf }),
      };
    }
    return {
      dot: null,
      text: hasOvertime(match)
        ? t("pages.watch.ticker.final_overtime")
        : t("pages.watch.ticker.final"),
    };
  }

  if (kind === "upcoming") {
    return {
      dot: null,
      text: match?.scheduled_at
        ? formatStartTime(match.scheduled_at, now, locale)
        : t("match.stream.card.scheduled"),
    };
  }

  if (kind === "pre") {
    if (match.status === "WaitingForCheckIn") {
      return {
        dot: "idle",
        text: t("pages.watch.ticker.check_in", checkInCounts(match)),
      };
    }
    return {
      dot: "idle",
      text:
        match.status === "Veto"
          ? t("match.stream.card.veto")
          : t("match.stream.card.waiting_for_server"),
    };
  }

  const current = currentMatchMap(match);
  const map = mapLabel(current);
  const join = (...parts: Array<string | null | false>) =>
    parts.filter(Boolean).join(" · ");
  const round =
    (current?.lineup_1_score ?? 0) + (current?.lineup_2_score ?? 0) + 1;

  switch (current?.status) {
    case "Warmup":
      return { dot: "live", text: join(t("match.stream.card.warmup"), map) };
    case "Knife":
      return { dot: "live", text: join(t("match.stream.card.knife"), map) };
    case "Scheduled":
      return { dot: "live", text: join(t("match.stream.card.up_next"), map) };
    case "Paused":
      return { dot: "live", text: join(t("match.stream.card.paused"), map) };
    case "Overtime":
      return {
        dot: "live",
        text: join(
          t("pages.watch.ticker.overtime_short"),
          t("pages.watch.ticker.round_short", { round }),
          map,
        ),
      };
  }
  if (MAP_OVER_STATUSES.includes(current?.status)) {
    return { dot: "live", text: join(t("match.stream.card.map_over"), map) };
  }
  return {
    dot: "live",
    text: join(t("pages.watch.ticker.round_short", { round }), map),
  };
}

function teams(
  match: any,
  kind: TickerKind,
  t: Translate,
): [TickerTeam, TickerTeam] {
  const bestOf: number = match?.options?.best_of ?? 1;
  const lineups = [match?.lineup_1, match?.lineup_2];
  const ids = [match?.lineup_1_id, match?.lineup_2_id];

  let scores: [number | null, number | null] = [null, null];
  if (kind === "live") {
    const current = currentMatchMap(match);
    scores = [current?.lineup_1_score ?? 0, current?.lineup_2_score ?? 0];
  } else if (kind === "result") {
    if (bestOf > 1) {
      scores = [mapsWon(match, ids[0]), mapsWon(match, ids[1])];
    } else {
      const map =
        [...(match?.match_maps ?? [])]
          .reverse()
          .find(
            (mm: any) =>
              (mm.lineup_1_score ?? 0) + (mm.lineup_2_score ?? 0) > 0,
          ) ?? null;
      scores = map
        ? [map.lineup_1_score ?? 0, map.lineup_2_score ?? 0]
        : [null, null];
    }
  }

  return [0, 1].map((i) => {
    const lineup = lineups[i];
    const name: string =
      lineup?.name || lineup?.team?.name || t("pages.watch.ticker.tbd");
    const other = scores[1 - i];
    let emphasis: TickerTeam["emphasis"] = null;
    if (kind === "result" && match?.winning_lineup_id) {
      emphasis = match.winning_lineup_id === ids[i] ? "win" : null;
    } else if (
      kind === "live" &&
      scores[i] !== null &&
      other !== null &&
      (scores[i] as number) < other
    ) {
      emphasis = "trail";
    }
    return {
      name,
      monogram: lineup ? teamMonogram(name, lineup.team?.short_name) : "?",
      avatar: lineup?.team?.avatar_url ?? null,
      score: scores[i],
      pips:
        kind === "live" && bestOf > 1
          ? { won: mapsWon(match, ids[i]), total: Math.ceil(bestOf / 2) }
          : null,
      emphasis,
    };
  }) as [TickerTeam, TickerTeam];
}

export function tickerTag(match: any): string | null {
  const parts = [
    match?.event_links?.[0]?.event?.name,
    match?.tournament_brackets?.[0]?.stage?.tournament?.name,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : (match?.options?.type ?? null);
}

export function tickerCell(
  match: any,
  ctx: { t: Translate; locale: string; now: Date },
): TickerCellModel {
  const kind = tickerKind(match);
  return {
    id: match.id,
    kind,
    status: statusLine(match, kind, ctx.t, ctx.locale, ctx.now),
    teams: teams(match, kind, ctx.t),
    tag: tickerTag(match),
    you: !!match?.is_in_lineup,
    streams: match?.streams ?? [],
  };
}

// In-game first, then the pre-match states, newest first within each.
export function sortLiveMatches(matches: any[]) {
  const rank = (status: string) =>
    (TICKER_LIVE_STATUSES as readonly string[]).indexOf(status);
  return [...matches].sort((a, b) => {
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) return byStatus;
    return (b.started_at ?? "").localeCompare(a.started_at ?? "");
  });
}

// Only Live and Upcoming carry a count: both are naturally small, while
// results grow with the server's whole history.
export function tickerFilterTabs(
  counts: { live: number; upcoming: number },
  t: Translate,
): Array<{ key: TickerFilter; label: string; count: string | null }> {
  return [
    { key: "all", label: t("pages.watch.ticker.filter_all"), count: null },
    {
      key: "live",
      label: t("pages.watch.ticker.filter_live"),
      count: String(counts.live),
    },
    {
      key: "upcoming",
      label: t("pages.watch.ticker.filter_upcoming"),
      count:
        counts.upcoming >= TICKER_UPCOMING_LIMIT
          ? `${TICKER_UPCOMING_LIMIT}+`
          : String(counts.upcoming),
    },
    { key: "results", label: t("pages.watch.ticker.filter_results"), count: null },
  ];
}
