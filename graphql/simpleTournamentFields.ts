import { order_by, Selector } from "~/generated/zeus";
import { matchOptionsFields } from "./matchOptionsFields";

/**
 * The registration / check-in columns and their computed fields.
 *
 * Typed as `Record<string, boolean>` and merged in rather than written inline:
 * these land with the API migration, and until `yarn codegen` runs against a
 * migrated stack the generated Zeus `SelectionFunction` maps every key it does
 * not recognise to `never`, so an inline entry is a compile error here AND at
 * every call site that spreads the selector. Fold them into the literals below
 * and delete this once codegen has run.
 */
export const tournamentRegistrationFields: Record<string, boolean> = {
  registration_type: true,
  min_role: true,
  min_elo: true,
  max_elo: true,
  invite_only: true,
  regions: true,
  check_in_required: true,
  check_in_setting: true,
  check_in_opens_before_minutes: true,
  check_in_closes_before_minutes: true,
  check_in_ends_at: true,
  // Computed: the one-way latch the schedule freeze reads.
  check_in_started: true,
  check_in_open: true,
};

// Organizer-only select, so it is kept out of the shared selector that guest
// and player surfaces reuse — asking for it there fails the whole query.
export const tournamentPasscodeField: Record<string, boolean> = {
  registration_passcode: true,
};

export const simpleTournamentFields = Selector("tournaments")({
  id: true,
  name: true,
  start: true,
  description: true,
  logo: true,
  banner: true,
  homepage: true,
  location: true,
  latitude: true,
  longitude: true,
  awards_enabled: true,
  e_tournament_status: {
    description: true,
  },
  categories: [
    {},
    {
      category: true,
      e_tournament_category: {
        value: true,
        description: true,
      },
    },
  ],
  prizes: [
    {
      order_by: [
        {
          order: order_by.asc,
        },
      ],
    },
    {
      id: true,
      place: true,
      prize: true,
      order: true,
    },
  ],
  organizer_teams: [
    {},
    {
      team_id: true,
      team: {
        id: true,
        name: true,
        short_name: true,
        avatar_url: true,
      },
    },
  ],
  award_configs: [
    {},
    {
      id: true,
      tournament_id: true,
      placement: true,
      award_id: true,
      custom_name: true,
      silhouette: true,
      image_url: true,
      award: {
        id: true,
        name: true,
        tier: true,
        silhouette: true,
        image_url: true,
      },
    },
  ],
  options: matchOptionsFields,
  stages: [
    {
      order_by: [
        {
          order: order_by.asc,
        },
      ],
    },
    {
      id: true,
      type: true,
      e_tournament_stage_type: {
        description: true,
      },
      order: true,
      options: matchOptionsFields,
      default_best_of: true,
      final_map_advantage: true,
      third_place_match: true,
      groups: true,
    },
  ],
  teams_aggregate: [
    {},
    {
      aggregate: {
        count: true,
      },
    },
  ],
});

Object.assign(simpleTournamentFields, tournamentRegistrationFields);
