import { order_by, Selector } from "~/generated/zeus";

export const awardDefinitionFields = Selector("awards")({
  id: true,
  name: true,
  description: true,
  tier: true,
  silhouette: true,
  image_url: true,
  system_key: true,
  allow_multiple: true,
});

// The catalog groups by what an award belongs to, so it pulls the scope
// columns and enough of each owner to label the group.
export const awardCatalogFields = Selector("awards")({
  ...awardDefinitionFields,
  tournament_id: true,
  event_id: true,
  season_id: true,
  league_season_id: true,
  tournament: {
    id: true,
    name: true,
  },
  event: {
    id: true,
    name: true,
  },
  season: {
    id: true,
    number: true,
  },
  league_season: {
    id: true,
    name: true,
    season_number: true,
  },
});

export const awardFields = Selector("award_recipients")({
  id: true,
  award_id: true,
  tournament_id: true,
  tournament_team_id: true,
  team_id: true,
  player_steam_id: true,
  placement: true,
  placement_tier: true,
  source: true,
  note: true,
  created_at: true,
  award: awardDefinitionFields,
  tournament: {
    name: true,
    start: true,
    stages: [
      {
        order_by: [
          {
            order: order_by.desc,
          },
        ],
        limit: 1,
      },
      {
        type: true,
      },
    ],
  },
  tournament_team: {
    name: true,
    team_id: true,
    team: {
      id: true,
      name: true,
      short_name: true,
    },
  },
  tournament_award: {
    custom_name: true,
    silhouette: true,
    image_url: true,
  },
  team: {
    id: true,
    name: true,
    short_name: true,
  },
});
