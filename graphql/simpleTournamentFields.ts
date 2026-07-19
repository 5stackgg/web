import { order_by, Selector } from "~/generated/zeus";
import { matchOptionsFields } from "./matchOptionsFields";

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
  trophies_enabled: true,
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
  trophy_configs: [
    {},
    {
      id: true,
      tournament_id: true,
      placement: true,
      custom_name: true,
      silhouette: true,
      image_url: true,
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
