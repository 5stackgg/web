import { $, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";

export const teamVetoStatsQuery = generateQuery({
  match_map_veto_picks: [
    {
      where: {
        match_lineup: {
          team_id: { _eq: $("teamId", "uuid!") },
        },
      },
      order_by: [{ created_at: order_by.asc_nulls_last }, { id: order_by.asc }],
    },
    {
      id: true,
      type: true,
      side: true,
      map_id: true,
      match_id: true,
      created_at: true,
      match_lineup_id: true,
      map: {
        id: true,
        name: true,
        label: true,
      },
      match_lineup: {
        id: true,
        team_id: true,
      },
      match: {
        id: true,
        match_maps: [
          {},
          {
            id: true,
            map_id: true,
            winning_lineup_id: true,
          },
        ],
      },
    },
  ],
});
