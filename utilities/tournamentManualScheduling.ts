import { e_match_mode_enum } from "~/generated/zeus";

interface SchedulingTournament {
  auto_start?: boolean | null;
  scheduling_mode?: string | null;
  options?: { match_mode?: string | null } | null;
}

interface SchedulingStage {
  options?: { match_mode?: string | null } | null;
}

interface SchedulingBracket {
  options?: { match_mode?: string | null } | null;
}

// Mirrors the api: with auto start off, or match options in Admin mode, a
// bracket only gets a match once an organizer gives it a time. Negotiated
// scheduling has the captains agree the time instead.
function isManual(
  tournament: SchedulingTournament,
  matchMode?: string | null,
): boolean {
  if (tournament.scheduling_mode === "negotiated") {
    return false;
  }
  if (tournament.auto_start === false) {
    return true;
  }
  return matchMode === e_match_mode_enum.admin;
}

export function isStageManuallyScheduled(
  tournament: SchedulingTournament,
  stage?: SchedulingStage | null,
): boolean {
  return isManual(
    tournament,
    stage?.options?.match_mode ?? tournament.options?.match_mode,
  );
}

// schedule_tournament_match reads the bracket's own options before the stage's.
export function isBracketManuallyScheduled(
  tournament: SchedulingTournament,
  stage?: SchedulingStage | null,
  bracket?: SchedulingBracket | null,
): boolean {
  return isManual(
    tournament,
    bracket?.options?.match_mode ??
      stage?.options?.match_mode ??
      tournament.options?.match_mode,
  );
}

export function adminModeStageOrders(
  tournament: SchedulingTournament & {
    stages?: Array<SchedulingStage & { order?: number | null }> | null;
  },
): Array<number> {
  return (tournament.stages ?? [])
    .filter(
      (stage) =>
        (stage.options?.match_mode ?? tournament.options?.match_mode) ===
        e_match_mode_enum.admin,
    )
    .map((stage) => stage.order ?? 1)
    .sort((a, b) => a - b);
}
