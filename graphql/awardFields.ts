import { order_by, Selector } from "~/generated/zeus";
import { playerFields } from "~/graphql/playerFields";

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

// An award belongs to at most one owner, and both the composer and the catalog
// need to know which, so the scope columns travel with the definition. The ids
// alone stay cheap enough to load anywhere the definition is loaded.
export const awardScopedDefinitionFields = Selector("awards")({
  ...awardDefinitionFields,
  tournament_id: true,
  event_id: true,
  season_id: true,
  league_season_id: true,
});

// The catalog groups by what an award belongs to, so on top of the scope
// columns it pulls enough of each owner to label the group.
export const awardCatalogFields = Selector("awards")({
  ...awardScopedDefinitionFields,
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

// The trophy cases read a grant from the holder's side, so they never had to
// name who holds it. The award page reads from the other side — one award,
// every holder — so the row carries the player, and every scope a grant can be
// pinned to.
export const awardRecipientDetailFields = Selector("award_recipients")({
  ...awardFields,
  event_id: true,
  season_id: true,
  league_season_id: true,
  player: playerFields,
  awarded_by: {
    steam_id: true,
    name: true,
  },
  team: {
    id: true,
    name: true,
    short_name: true,
    avatar_url: true,
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
