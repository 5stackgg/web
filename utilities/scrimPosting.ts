import {
  openIntervals,
  scrimFit,
  type OpenInterval,
  type ScrimFit,
  type ScrimSide,
} from "~/utilities/scrimSchedule";

export type ScrimTone = "ok" | "amber" | "bad" | "muted";

export interface ScrimStatus {
  tone: ScrimTone;
  key: string;
  at?: number;
}

export interface PostingView {
  intervals: OpenInterval[];
  fit: ScrimFit | null;
  request: any | null;
  status: ScrimStatus | null;
}

export function teamSide(
  team: any,
  settings: any,
  intervals: OpenInterval[],
): ScrimSide {
  return {
    elo: team?.ranks?.avg_elo ?? null,
    eloMin: settings?.elo_min ?? null,
    eloMax: settings?.elo_max ?? null,
    regions: settings?.regions ?? [],
    mapIds: settings?.map_ids ?? [],
    intervals,
  };
}

// The viewer's team as the fit sees it, built once per render.
export function mineSide(myTeam: any, now: Date): ScrimSide | null {
  if (!myTeam) return null;
  return teamSide(
    myTeam,
    myTeam.scrim_settings,
    openIntervals(myTeam.scrim_availability, now),
  );
}

export function postingView(
  posting: any,
  mine: ScrimSide | null,
  myTeamId: string | null,
  requests: any[],
  now: Date,
): PostingView {
  const intervals = openIntervals(posting.team?.scrim_availability, now);
  if (!mine || !myTeamId) {
    return { intervals, fit: null, request: null, status: null };
  }
  const request =
    requests.find(
      (r) => r.from_team_id === posting.team_id || r.to_team_id === posting.team_id,
    ) ?? null;
  const booked = requests.some(
    (r) => r.status === "Matched" && r !== request,
  );
  const fit = scrimFit(
    mine,
    teamSide(posting.team, posting, intervals),
    now,
    { booked },
  );
  return { intervals, fit, request, status: statusFor(fit, request, myTeamId) };
}

export function statusFor(
  fit: ScrimFit,
  request: any | null,
  myTeamId: string,
): ScrimStatus {
  if (request) {
    if (request.status === "Matched") {
      return {
        tone: "ok",
        key: "booked",
        at: new Date(request.proposed_scheduled_at).getTime(),
      };
    }
    return request.awaiting_team_id === myTeamId
      ? { tone: "amber", key: "needs_you" }
      : { tone: "muted", key: "requested" };
  }
  if (fit.block === "booked") return { tone: "muted", key: "you_are_booked" };
  if (fit.block === "their_range") return { tone: "bad", key: "their_range" };
  if (fit.block === "our_range") return { tone: "bad", key: "our_range" };
  return fit.next != null
    ? { tone: "ok", key: "both_free" }
    : { tone: "muted", key: "different_hours" };
}

