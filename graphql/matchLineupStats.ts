import { $, order_by, Selector } from "~/generated/zeus";
import { playerFields } from "~/graphql/playerFields";

export const matchLineupStats = Selector("match_lineups")({
  id: true,
  name: true,
  team_id: true,
  coach: playerFields,
  lineup_players: [
    {
      order_by: [
        {
          captain: order_by.desc_nulls_last,
        },
        {
          player: {
            name: order_by.asc,
          },
        },
      ],
    },
    {
      captain: true,
      steam_id: true,
      checked_in: true,
      placeholder_name: true,
      player: {
        ...playerFields,
        kills_aggregate: [
          {
            where: {
              match_id: {
                _eq: $("matchId", "uuid!"),
              },
              team_kill: {
                _eq: false,
              },
            },
          },
          {
            aggregate: [
              {},
              {
                count: true,
              },
            ],
          },
        ],
        assists_aggregate: [
          {
            where: {
              match_id: {
                _eq: $("matchId", "uuid!"),
              },
              is_team_assist: {
                _eq: false,
              },
            },
          },
          {
            aggregate: [
              {},
              {
                count: true,
              },
            ],
          },
        ],
        deaths_aggregate: [
          {
            where: {
              match_id: {
                _eq: $("matchId", "uuid!"),
              },
            },
          },
          {
            aggregate: [
              {},
              {
                count: true,
              },
            ],
          },
        ],
        damage_dealt_aggregate: [
          {
            where: {
              match_id: {
                _eq: $("matchId", "uuid!"),
              },
              team_damage: {
                _eq: false,
              },
            },
          },
          {
            aggregate: [
              {},
              {
                sum: {
                  damage: true,
                },
              },
            ],
          },
        ],
      },
    },
  ],
});
