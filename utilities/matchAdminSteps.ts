import {
  e_match_map_status_enum,
  e_match_status_enum,
  e_player_roles_enum,
} from "~/generated/zeus";

export type MatchAdminStep =
  "check_in" | "veto" | "warmup" | "live" | "finished";

type StepMatch = {
  status?: string | null;
  options?: { map_veto?: boolean; region_veto?: boolean } | null;
  match_maps?: Array<{ is_current_map?: boolean; status?: string }> | null;
};

const ALL_STEPS: MatchAdminStep[] = [
  "check_in",
  "veto",
  "warmup",
  "live",
  "finished",
];

const ENDED: string[] = [
  e_match_status_enum.Finished,
  e_match_status_enum.Tie,
  e_match_status_enum.Forfeit,
  e_match_status_enum.Surrendered,
  e_match_status_enum.Canceled,
];

// The veto step only exists for matches that run one.
export function matchAdminSteps(match: StepMatch): MatchAdminStep[] {
  const hasVeto = !!(match.options?.map_veto || match.options?.region_veto);
  return ALL_STEPS.filter((step) => step !== "veto" || hasVeto);
}

export function currentMatchAdminStep(match: StepMatch): MatchAdminStep {
  const status = match.status ?? "";

  if (ENDED.includes(status)) {
    return "finished";
  }
  if (status === e_match_status_enum.Veto) {
    return "veto";
  }
  if (status === e_match_status_enum.WaitingForServer) {
    return "warmup";
  }
  if (status === e_match_status_enum.Live) {
    const map = match.match_maps?.find((m) => m.is_current_map);
    return !map ||
      map.status === e_match_map_status_enum.Scheduled ||
      map.status === e_match_map_status_enum.Warmup
      ? "warmup"
      : "live";
  }
  return "check_in";
}

export type UpcomingAdminAction = {
  key:
    | "veto_override"
    | "force_ready"
    | "pause"
    | "live_stream"
    | "highlights"
    | "reparse";
  step: MatchAdminStep;
  label: string;
  // Lowest role that can ever use it; none means any organizer.
  role?: e_player_roles_enum;
};

// What unlocks at each later step, so organizers can see it coming. Actions
// that are always available (server, winner, cancel) never appear here.
export const UPCOMING_ADMIN_ACTIONS: UpcomingAdminAction[] = [
  {
    key: "veto_override",
    step: "veto",
    label: "match.admin_bar.veto_override",
  },
  {
    key: "force_ready",
    step: "warmup",
    label: "match.commands.force_ready",
    role: e_player_roles_enum.moderator,
  },
  // Streaming opens once the match goes live, which is the warmup step.
  {
    key: "live_stream",
    step: "warmup",
    label: "match.actions.start_live",
  },
  {
    key: "pause",
    step: "live",
    label: "match.actions.pause",
    role: e_player_roles_enum.moderator,
  },
  {
    key: "highlights",
    step: "finished",
    label: "match.actions.create_clips",
    role: e_player_roles_enum.administrator,
  },
  {
    key: "reparse",
    step: "finished",
    label: "match.actions.reparse_demos",
    role: e_player_roles_enum.administrator,
  },
];

// Actions the viewer can use at a later step. Ones their role never reaches
// are left out entirely rather than shown locked.
export function upcomingAdminActions(
  match: StepMatch,
  canUseRole: (role: e_player_roles_enum) => boolean,
): UpcomingAdminAction[] {
  const steps = matchAdminSteps(match);
  const current = steps.indexOf(currentMatchAdminStep(match));

  return UPCOMING_ADMIN_ACTIONS.filter(
    (action) =>
      steps.indexOf(action.step) > current &&
      (!action.role || canUseRole(action.role)),
  );
}
