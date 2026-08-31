/**
 * The automatic-sanctions policy as the settings page reads and writes it.
 *
 * Every value lives in `public.settings` as TEXT — booleans and integers
 * included — under `public.sanction_<source>_<field>`. The API resolves each
 * one by validating the stored text and falling back to the source row's
 * `default_*` column when it fails, which means a typo weakens nothing but is
 * also completely silent. These helpers reproduce that validation exactly so
 * the operator sees the rejection at the input instead of wondering why an edit
 * did nothing.
 */

export const SANCTION_FIELDS = [
  "enabled",
  "threshold",
  "window_days",
  "durations",
  "scope",
] as const;

export type SanctionField = (typeof SANCTION_FIELDS)[number];

export function sanctionSettingName(
  source: string,
  field: SanctionField,
): string {
  return `public.sanction_${source}_${field}`;
}

/** A row of `public.e_sanction_sources`. */
export interface SanctionSource {
  value: string;
  description: string;
  default_enabled: boolean;
  default_threshold: number;
  default_window_days: number;
  default_durations: string;
  default_scope: string;
  /**
   * True when the source issues a real platform `player_sanctions` ban rather
   * than a scoped cooldown — today only `vac_ban`, and only while its scope is
   * `both`. Narrowing the scope of such a source stops the platform ban row
   * being written at all, which is worth saying out loud in the UI.
   */
  writes_platform_ban: boolean;
}

/** A row of `public.e_sanction_scopes`. */
export interface SanctionScope {
  value: string;
  description: string;
}

/** The resolved policy for one source — settings applied over the defaults. */
export interface SanctionPolicy {
  enabled: boolean;
  threshold: number;
  window_days: number;
  /** The escalation ladder in minutes. `0` at any rung means permanent. */
  durations: number[];
  scope: string;
}

// The API's own validation, character for character
// (`hasura/functions/sanctions/sanction_policy.sql`). Anything that fails these
// is discarded server-side in favour of the default.
const INTEGER_PATTERN = /^-?[0-9]+$/;
const DURATIONS_PATTERN = /^\s*\d+\s*(,\s*\d+\s*)*$/;

export function isValidDurationsCsv(value: string): boolean {
  return DURATIONS_PATTERN.test(value);
}

export function isValidInteger(value: string): boolean {
  return INTEGER_PATTERN.test(value.trim());
}

export function parseLadder(csv: string): number[] {
  if (!isValidDurationsCsv(csv)) {
    return [];
  }
  return csv
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((minutes) => Number.isFinite(minutes));
}

export function serializeLadder(rungs: number[]): string {
  return rungs
    .map((minutes) => String(Math.max(0, Math.trunc(minutes))))
    .join(",");
}

export type DurationUnit = "minutes" | "hours" | "days";

export interface DurationParts {
  value: number;
  unit: DurationUnit;
}

/**
 * Minutes -> the largest whole unit that still represents them exactly, so
 * 10080 reads as "7 days" rather than "10080 minutes" and 1920 as "32 hours".
 * A value that divides into nothing cleanly stays in minutes.
 *
 * `0` is NOT handled here — it means permanent, which is not a duration at all
 * and must never be rendered through a unit or a date.
 */
export function splitDuration(minutes: number): DurationParts {
  const total = Math.max(0, Math.trunc(minutes));
  if (total > 0 && total % 1440 === 0) {
    return { value: total / 1440, unit: "days" };
  }
  if (total > 0 && total % 60 === 0) {
    return { value: total / 60, unit: "hours" };
  }
  return { value: total, unit: "minutes" };
}

export function toMinutes(value: number, unit: DurationUnit): number {
  const amount = Math.max(0, Math.trunc(value));
  if (unit === "days") {
    return amount * 1440;
  }
  if (unit === "hours") {
    return amount * 60;
  }
  return amount;
}

/**
 * Settings applied over a source's shipped defaults, using the API's fallback
 * rules: a value that fails validation is not "empty", it is the default.
 *
 * `enabled` is the odd one — the API treats exactly `"true"` as on and anything
 * else as off, so a stored `"TRUE"` really does disable the source. An ABSENT
 * row is different again: the seed has not run, so the shipped default stands.
 */
export function resolveSanctionPolicy(
  source: SanctionSource,
  settings: Map<string, string>,
  scopes: SanctionScope[],
): SanctionPolicy {
  const read = (field: SanctionField) =>
    settings.get(sanctionSettingName(source.value, field));

  const rawEnabled = read("enabled");
  const rawThreshold = read("threshold");
  const rawWindowDays = read("window_days");
  const rawDurations = read("durations");
  const rawScope = read("scope");

  const threshold =
    rawThreshold !== undefined && isValidInteger(rawThreshold)
      ? Math.max(1, Number(rawThreshold.trim()))
      : source.default_threshold;

  const windowDays =
    rawWindowDays !== undefined && isValidInteger(rawWindowDays)
      ? Math.max(0, Number(rawWindowDays.trim()))
      : source.default_window_days;

  const durations =
    rawDurations !== undefined && isValidDurationsCsv(rawDurations)
      ? parseLadder(rawDurations)
      : parseLadder(source.default_durations);

  const scopeIsKnown =
    rawScope !== undefined && scopes.some((scope) => scope.value === rawScope);

  return {
    enabled:
      rawEnabled === undefined ? source.default_enabled : rawEnabled === "true",
    threshold,
    window_days: windowDays,
    // An empty ladder would mean "no penalty at all", which no default ever is;
    // fall back to a single flat rung rather than render a source with no rungs.
    durations: durations.length > 0 ? durations : [0],
    scope: scopeIsKnown ? (rawScope as string) : source.default_scope,
  };
}

/** The shipped policy for a source, ignoring every stored setting. */
export function defaultSanctionPolicy(source: SanctionSource): SanctionPolicy {
  const durations = parseLadder(source.default_durations);
  return {
    enabled: source.default_enabled,
    threshold: source.default_threshold,
    window_days: source.default_window_days,
    durations: durations.length > 0 ? durations : [0],
    scope: source.default_scope,
  };
}

/** The five settings rows a policy serializes to, in stored (text) form. */
export function sanctionPolicyRows(
  source: string,
  policy: SanctionPolicy,
): Array<{ name: string; value: string }> {
  return [
    {
      name: sanctionSettingName(source, "enabled"),
      value: policy.enabled ? "true" : "false",
    },
    {
      name: sanctionSettingName(source, "threshold"),
      value: String(policy.threshold),
    },
    {
      name: sanctionSettingName(source, "window_days"),
      value: String(policy.window_days),
    },
    {
      name: sanctionSettingName(source, "durations"),
      value: serializeLadder(policy.durations),
    },
    { name: sanctionSettingName(source, "scope"), value: policy.scope },
  ];
}

export function sanctionPoliciesEqual(
  a: SanctionPolicy,
  b: SanctionPolicy,
): boolean {
  return (
    a.enabled === b.enabled &&
    a.threshold === b.threshold &&
    a.window_days === b.window_days &&
    a.scope === b.scope &&
    serializeLadder(a.durations) === serializeLadder(b.durations)
  );
}

export function cloneSanctionPolicy(policy: SanctionPolicy): SanctionPolicy {
  return { ...policy, durations: [...policy.durations] };
}
