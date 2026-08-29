import * as z from "zod";
import { e_player_roles_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import {
  CHECK_IN_CLOSES_DEFAULT_MINUTES,
  CHECK_IN_CLOSES_MAX_MINUTES,
  CHECK_IN_CLOSES_MIN_MINUTES,
  CHECK_IN_MIN_WINDOW_MINUTES,
  CHECK_IN_OPENS_DEFAULT_MINUTES,
  CHECK_IN_OPENS_MAX_MINUTES,
  CHECK_IN_OPENS_MIN_MINUTES,
  CHECK_IN_SETTING_DEFAULT,
} from "~/utilities/tournamentCheckIn";

export const REGISTRATION_TYPES = ["teams", "free_agents", "both"] as const;
export type RegistrationType = (typeof REGISTRATION_TYPES)[number];

/**
 * Two of the tournament columns share a name with a match_options field that
 * lives on the SAME vee-validate form in the create wizard — `regions` (server
 * region veto) and `check_in_setting` (who readies up for a match). Binding the
 * tournament value to either name silently overwrites the match option, so the
 * form keys are namespaced and translated back to real column names in
 * `registrationColumns()`. Never bind a tournament control to the bare name.
 */
export const REGISTRATION_FIELD = {
  registration_type: "registration_type",
  min_role: "min_role",
  min_elo: "min_elo",
  max_elo: "max_elo",
  regions: "registration_regions",
  invite_only: "invite_only",
  registration_passcode: "registration_passcode",
  check_in_required: "check_in_required",
  check_in_setting: "team_check_in_setting",
  check_in_opens_before_minutes: "check_in_opens_before_minutes",
  check_in_closes_before_minutes: "check_in_closes_before_minutes",
} as const;

/**
 * Hasura grants `tournaments.registration_passcode` — select, insert and update
 * — to the tournament_organizer role alone, while a plain `user` with
 * can_create_tournaments can still own one. Naming the column at all in their
 * mutation fails the entire statement, so the same test has to gate the field's
 * visibility, its hydration and every write. One definition, three callers.
 */
export function canManageRegistrationPasscode(): boolean {
  return useAuthStore().isRoleAbove(e_player_roles_enum.tournament_organizer);
}

// A blank ELO input arrives as "", null or NaN; every one of them means "no
// bound", and none of them may collapse to 0 — 0 is a real floor.
function nullableElo() {
  return z
    .union([z.number().min(0), z.nan(), z.literal(""), z.null(), z.undefined()])
    .transform((value) =>
      value === "" ||
      value === null ||
      value === undefined ||
      Number.isNaN(value)
        ? null
        : (value as number),
    );
}

/**
 * The registration/check-in half of a tournament form. Returned as a plain
 * shape so the wizard can fold it into `matchOptionsValidator`'s `additional`
 * and the settings form can spread it into its own `z.object`.
 *
 * `component` is the hosting Options API instance — the cross-field rules read
 * `component.form.values`, the same idiom `matchOptionsValidator` uses for
 * `map_pool`. They are NOT a `.superRefine` on the assembled object: that turns
 * the schema into a ZodEffects, and `toTypedSchema`'s default extraction walks
 * `.shape`, so every match-option default would silently vanish.
 */
export function registrationSchemaShape(component: any) {
  const values = () => component.form?.values ?? {};

  return {
    [REGISTRATION_FIELD.registration_type]: z
      .enum(REGISTRATION_TYPES)
      .default("teams"),
    [REGISTRATION_FIELD.min_role]: z.string().nullable().default(null),
    [REGISTRATION_FIELD.min_elo]: nullableElo(),
    [REGISTRATION_FIELD.max_elo]: nullableElo().refine(
      (maxElo) => {
        const minElo = values()[REGISTRATION_FIELD.min_elo];
        return maxElo == null || minElo == null || maxElo >= minElo;
      },
      { message: component.$t("tournament.registration.rank.invalid_range") },
    ),
    [REGISTRATION_FIELD.regions]: z.string().array().default([]),
    [REGISTRATION_FIELD.invite_only]: z.boolean().default(false),
    [REGISTRATION_FIELD.registration_passcode]: z
      .string()
      .nullable()
      .default(null),
    [REGISTRATION_FIELD.check_in_required]: z.boolean().default(false),
    [REGISTRATION_FIELD.check_in_setting]: z
      .string()
      .default(CHECK_IN_SETTING_DEFAULT),
    [REGISTRATION_FIELD.check_in_opens_before_minutes]: z.coerce
      .number()
      .int()
      .min(CHECK_IN_OPENS_MIN_MINUTES)
      .max(CHECK_IN_OPENS_MAX_MINUTES)
      .default(CHECK_IN_OPENS_DEFAULT_MINUTES)
      .refine(
        (opens) => {
          if (!values()[REGISTRATION_FIELD.check_in_required]) {
            return true;
          }
          const closes = Number(
            values()[REGISTRATION_FIELD.check_in_closes_before_minutes],
          );
          return (
            !Number.isFinite(closes) ||
            opens - closes >= CHECK_IN_MIN_WINDOW_MINUTES
          );
        },
        { message: component.$t("tournament.check_in.window_too_short") },
      ),
    [REGISTRATION_FIELD.check_in_closes_before_minutes]: z.coerce
      .number()
      .int()
      .min(CHECK_IN_CLOSES_MIN_MINUTES)
      .max(CHECK_IN_CLOSES_MAX_MINUTES)
      .default(CHECK_IN_CLOSES_DEFAULT_MINUTES),
  } as Record<string, z.ZodTypeAny>;
}

/**
 * Form values -> the `tournaments` columns. The single place the namespaced
 * form keys become real column names; both the insert and the update go
 * through it so they cannot disagree.
 *
 * `registration_passcode` is only meaningful while `invite_only` is on — a
 * stale code left behind by toggling the switch off would keep letting people
 * in through a door the organizer believes is shut. It is also the one column
 * Hasura grants to the tournament_organizer role alone, and a plain `user` may
 * still own a tournament: naming it at all in their mutation fails the whole
 * statement, so `includePasscode` omits the key rather than sending null.
 */
export function registrationColumns(
  values: Record<string, any>,
  { includePasscode = false }: { includePasscode?: boolean } = {},
) {
  const inviteOnly = !!values[REGISTRATION_FIELD.invite_only];
  const passcode = (
    values[REGISTRATION_FIELD.registration_passcode] ?? ""
  ).trim();

  return {
    registration_type: values[REGISTRATION_FIELD.registration_type] ?? "teams",
    min_role: values[REGISTRATION_FIELD.min_role] || null,
    min_elo: values[REGISTRATION_FIELD.min_elo] ?? null,
    max_elo: values[REGISTRATION_FIELD.max_elo] ?? null,
    regions: values[REGISTRATION_FIELD.regions] ?? [],
    invite_only: inviteOnly,
    ...(includePasscode
      ? { registration_passcode: inviteOnly && passcode ? passcode : null }
      : {}),
    check_in_required: !!values[REGISTRATION_FIELD.check_in_required],
    check_in_setting:
      values[REGISTRATION_FIELD.check_in_setting] || CHECK_IN_SETTING_DEFAULT,
    check_in_opens_before_minutes: Number(
      values[REGISTRATION_FIELD.check_in_opens_before_minutes] ??
        CHECK_IN_OPENS_DEFAULT_MINUTES,
    ),
    check_in_closes_before_minutes: Number(
      values[REGISTRATION_FIELD.check_in_closes_before_minutes] ??
        CHECK_IN_CLOSES_DEFAULT_MINUTES,
    ),
  };
}

/** A tournament row -> the namespaced form values. Inverse of the above. */
export function registrationFormValues(tournament: Record<string, any>) {
  return {
    [REGISTRATION_FIELD.registration_type]:
      tournament.registration_type ?? "teams",
    [REGISTRATION_FIELD.min_role]: tournament.min_role ?? null,
    [REGISTRATION_FIELD.min_elo]:
      tournament.min_elo != null ? Number(tournament.min_elo) : null,
    [REGISTRATION_FIELD.max_elo]:
      tournament.max_elo != null ? Number(tournament.max_elo) : null,
    [REGISTRATION_FIELD.regions]: [...(tournament.regions ?? [])],
    [REGISTRATION_FIELD.invite_only]: !!tournament.invite_only,
    [REGISTRATION_FIELD.registration_passcode]:
      tournament.registration_passcode ?? null,
    [REGISTRATION_FIELD.check_in_required]: !!tournament.check_in_required,
    [REGISTRATION_FIELD.check_in_setting]:
      tournament.check_in_setting ?? CHECK_IN_SETTING_DEFAULT,
    [REGISTRATION_FIELD.check_in_opens_before_minutes]: Number(
      tournament.check_in_opens_before_minutes ??
        CHECK_IN_OPENS_DEFAULT_MINUTES,
    ),
    [REGISTRATION_FIELD.check_in_closes_before_minutes]: Number(
      tournament.check_in_closes_before_minutes ??
        CHECK_IN_CLOSES_DEFAULT_MINUTES,
    ),
  };
}
