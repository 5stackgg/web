import { Selector, order_by } from "~/generated/zeus";

export const scrimAvailabilityFields = Selector("team_scrim_availability")({
  id: true,
  starts_at: true,
  ends_at: true,
  recurring_weekly: true,
});

const scrimRanksFields = Selector("v_team_ranks")({
  avg_elo: true,
  avg_premier: true,
  avg_faceit_level: true,
  roster_size: true,
});

const scrimReputationFields = Selector("v_team_reputation")({
  scrims_completed: true,
  no_shows: true,
  late_cancels: true,
  reliability_pct: true,
});

const scrimSettingsFields = Selector("team_scrim_settings")({
  id: true,
  team_id: true,
  enabled: true,
  regions: true,
  map_ids: true,
  notes: true,
  elo_min: true,
  elo_max: true,
  allow_outside_availability: true,
});

// A team as the finder shows it: who they are, how they rate, when they play.
export const scrimTeamFields = Selector("teams")({
  id: true,
  name: true,
  avatar_url: true,
  ranks: scrimRanksFields,
  reputation: scrimReputationFields,
  scrim_availability: scrimAvailabilityFields,
});

export const scrimPostingFields = Selector("team_scrim_settings")({
  ...scrimSettingsFields,
  team: scrimTeamFields,
});

export const scrimMyTeamFields = Selector("teams")({
  ...scrimTeamFields,
  scrim_settings: scrimSettingsFields,
});

const scrimRequestTeamFields = Selector("teams")({
  id: true,
  name: true,
  avatar_url: true,
  scrim_availability: scrimAvailabilityFields,
});

export const scrimRequestFields = Selector("team_scrim_requests")({
  id: true,
  status: true,
  from_team_id: true,
  to_team_id: true,
  awaiting_team_id: true,
  proposed_scheduled_at: true,
  expires_at: true,
  auto_generated: true,
  created_at: true,
  match_id: true,
  from_team: scrimRequestTeamFields,
  to_team: scrimRequestTeamFields,
  match_options: { best_of: true },
  match: { id: true, status: true },
  proposals: [
    { order_by: [{ created_at: order_by.asc }] },
    { id: true, proposed_by_team_id: true, proposed_scheduled_at: true },
  ],
});

export const scrimPlayedFields = Selector("team_scrim_requests")({
  id: true,
  from_team_id: true,
  to_team_id: true,
  proposed_scheduled_at: true,
  from_team: { id: true, name: true, avatar_url: true },
  to_team: { id: true, name: true, avatar_url: true },
  match: {
    id: true,
    status: true,
    winning_lineup_id: true,
    lineup_1_id: true,
    lineup_2_id: true,
    options: { best_of: true },
    lineup_1: { id: true, team_id: true },
    lineup_2: { id: true, team_id: true },
    match_maps: {
      id: true,
      winning_lineup_id: true,
      lineup_1_score: true,
      lineup_2_score: true,
      map: { id: true, name: true, label: true, patch: true },
    },
  },
});
