import { e_check_in_settings_enum } from "~/generated/zeus";

// Mirrors the CHECK constraints on `public.tournaments`. Kept here rather than
// re-typed per form so a bound can never drift into a value Postgres rejects
// only at save time.
export const CHECK_IN_OPENS_MIN_MINUTES = 15;
export const CHECK_IN_OPENS_MAX_MINUTES = 240;
export const CHECK_IN_CLOSES_MIN_MINUTES = 5;
export const CHECK_IN_CLOSES_MAX_MINUTES = 60;
// `opens - closes >= 5` — the window can never invert or collapse to nothing.
export const CHECK_IN_MIN_WINDOW_MINUTES = 5;

export const CHECK_IN_OPENS_DEFAULT_MINUTES = 60;
export const CHECK_IN_CLOSES_DEFAULT_MINUTES = 15;

// The three modes reuse the existing e_check_in_settings enum (Admin /
// Captains / Players); the tournament UI relabels them, it does not add values.
export const CHECK_IN_SETTINGS = [
  e_check_in_settings_enum.Captains,
  e_check_in_settings_enum.Players,
  e_check_in_settings_enum.Admin,
] as const;

export const CHECK_IN_SETTING_DEFAULT = e_check_in_settings_enum.Captains;

interface CheckInTournament {
  start?: string | Date | null;
  check_in_required?: boolean | null;
  // Server computed field (tournament_check_in_started). It is already false
  // whenever check_in_required is off, so nothing here re-derives that.
  check_in_started?: boolean | null;
  check_in_open?: boolean | null;
  check_in_ends_at?: string | null;
}

/**
 * THE schedule freeze test. `tbu_tournaments` rejects any edit to `start`,
 * `check_in_opens_before_minutes` or `check_in_closes_before_minutes` once the
 * window has opened, so every control that writes one of those three must ask
 * this — the wizard, the settings form and DateTimePicker included. Two
 * independent copies of the rule is how a disabled date picker ends up next to
 * a live time picker.
 *
 * Absent field (a selection that never asked for `check_in_started`) reads as
 * not frozen: the server still refuses the write, the UI just fails to warn.
 */
export function isTournamentScheduleFrozen(
  tournament: CheckInTournament | null | undefined,
): boolean {
  return tournament?.check_in_started === true;
}

export interface CheckInTimeline {
  opensAt: Date;
  closesAt: Date;
  startsAt: Date;
}

/**
 * Absolute clock times for the opens -> closes -> start timeline. Returns null
 * when there is no start yet (the create wizard before the schedule step is
 * filled in), so callers render the offsets alone rather than 1970.
 */
export function checkInTimeline(
  start: string | Date | null | undefined,
  opensBeforeMinutes: number | null | undefined,
  closesBeforeMinutes: number | null | undefined,
): CheckInTimeline | null {
  if (!start) {
    return null;
  }

  const startsAt = new Date(start);
  if (Number.isNaN(startsAt.getTime())) {
    return null;
  }

  const opens = Number(opensBeforeMinutes ?? CHECK_IN_OPENS_DEFAULT_MINUTES);
  const closes = Number(closesBeforeMinutes ?? CHECK_IN_CLOSES_DEFAULT_MINUTES);

  return {
    opensAt: new Date(startsAt.getTime() - opens * 60_000),
    closesAt: new Date(startsAt.getTime() - closes * 60_000),
    startsAt,
  };
}
