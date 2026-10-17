import { e_match_mode_enum } from "~/generated/zeus";

interface SchedulingTournament {
  auto_start?: boolean | null;
  scheduling_mode?: string | null;
  options?: { match_mode?: string | null } | null;
}

interface SchedulingStage {
  options?: { match_mode?: string | null } | null;
}

// Mirrors the api: with auto start off, or a stage whose match options are in
// Admin mode, a bracket only gets a match once an organizer gives it a time.
// Negotiated scheduling has the captains agree the time instead.
export function isStageManuallyScheduled(
  tournament: SchedulingTournament,
  stage?: SchedulingStage | null,
): boolean {
  if (tournament.scheduling_mode === "negotiated") {
    return false;
  }
  if (tournament.auto_start === false) {
    return true;
  }
  return (
    (stage?.options?.match_mode ?? tournament.options?.match_mode) ===
    e_match_mode_enum.admin
  );
}

export function adminModeStageOrders(
  tournament: SchedulingTournament & {
    stages?: Array<SchedulingStage & { order?: number | null }> | null;
  },
): Array<number> {
  return (tournament.stages ?? [])
    .filter((stage) => stage.options?.match_mode === e_match_mode_enum.admin)
    .map((stage) => stage.order ?? 1)
    .sort((a, b) => a - b);
}
