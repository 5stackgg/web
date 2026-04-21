import { order_by, Selector } from "~/generated/zeus";

export const trophyFields = Selector("tournament_trophies")({
  id: true,
  tournament_id: true,
  tournament_team_id: true,
  team_id: true,
  player_steam_id: true,
  placement: true,
  placement_tier: true,
  manual: true,
  created_at: true,
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
  trophy_config: {
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
