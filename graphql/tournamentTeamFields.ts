import { playerFields } from "~/graphql/playerFields";

/**
 * `tournament_teams.checked_in_at` is the ONE check-in signal anything
 * downstream reads — nothing outside the feature has to know which
 * `check_in_setting` mode produced it. `checked_in` is its computed companion,
 * and the roster's own stamp only ever matters in `Players` mode.
 *
 * Both chunks are spread as untyped objects on purpose: these columns land with
 * the API migration, and until `yarn codegen` runs against a migrated stack the
 * generated Zeus selection type maps every unrecognised key to `never` — which
 * would be a compile error not just here but at every call site that reuses
 * this selector. Fold the keys into the literals and delete the casts once
 * codegen has run.
 */
const pendingTeamFields = {
  checked_in_at: true,
  checked_in: true,
} as {};

const pendingRosterFields = {
  checked_in_at: true,
  target_eligible: true,
} as {};

export default {
  ...pendingTeamFields,
  id: true,
  name: true,
  short_name: true,
  team_id: true,
  seed: true,
  eligible_at: true,
  can_manage: true,
  captain_steam_id: true,
  owner_steam_id: true,
  captain: playerFields,
  team: {
    id: true,
    name: true,
    short_name: true,
    avatar_url: true,
  },
  roster: [
    {},
    {
      ...pendingRosterFields,
      role: true,
      player: playerFields,
    },
  ],
  roster_aggregate: [
    {},
    {
      aggregate: {
        count: true,
      },
    },
  ],
};
