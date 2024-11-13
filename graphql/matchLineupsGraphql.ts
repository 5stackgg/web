import { $, e_utility_types_enum, order_by, Selector } from "~/generated/zeus";
import { playerFields } from "~/graphql/playerFields";

export const matchLineups = Selector("match_lineups")({
  id: true,
  name: true,
  team_id: true,
  is_ready: true,
  is_on_lineup: true,
  can_pick_map_veto: true,
  can_pick_region_veto: true,
  can_update_lineup: true,
  is_picking_map_veto: true,
  is_picking_region_veto: true,
  coach: playerFields,
  captain: {
    placeholder_name: true,
    player: {
      name: true,
      steam_id: true,
    },
  },
  lineup_players: [
    {
      order_by: [
        {
          captain: order_by.desc_nulls_last,
        },
        {
          player: {
            name: $("order_by_name", "order_by!"),
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
        multi_kills: [
          {
            where: {
              match_id: {
                _eq: $("matchId", "uuid!"),
              },
            },
          },
          {
            kills: true,
          },
        ],
        flashed_players_aggregate: [
          {
            where: {
              match_id: {
                _eq: $("matchId", "uuid!"),
              },
              team_flash: {
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
        __alias: {
          hs_kills_aggregate: {
            kills_aggregate: [
              {
                where: {
                  match_id: {
                    _eq: $("matchId", "uuid!"),
                  },
                  headshot: {
                    _eq: true,
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
          },
          flash_assists: {
            assists_aggregate: [
              {
                where: {
                  match_id: {
                    _eq: $("matchId", "uuid!"),
                  },
                  flash: {
                    _eq: true,
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
          },
          zeus_kills_aggregate: {
            kills_aggregate: [
              {
                where: {
                  match_id: {
                    _eq: $("matchId", "uuid!"),
                  },
                  with: {
                    _eq: "taser",
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
          },
          knife_kills_aggregate: {
            kills_aggregate: [
              {
                where: {
                  match_id: {
                    _eq: $("matchId", "uuid!"),
                  },
                  with: {
                    _like: "knife%",
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
          },
          team_flashes_aggregate: {
            flashed_players_aggregate: [
              {
                where: {
                  team_flash: {
                    _eq: true,
                  },
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
          },
          avg_flash_duration_aggregate: {
            flashed_players_aggregate: [
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
                    avg: {
                      duration: true,
                    },
                  },
                ],
              },
            ],
          },
          flashes_thrown_aggregate: {
            utility_thrown_aggregate: [
              {
                where: {
                  type: {
                    _eq: e_utility_types_enum.Flash,
                  },
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
          },
          team_damage_aggregate: {
            damage_dealt_aggregate: [
              {
                where: {
                  match_id: {
                    _eq: $("matchId", "uuid!"),
                  },
                  team_damage: {
                    _eq: true,
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
          he_damage_aggregate: {
            damage_dealt_aggregate: [
              {
                where: {
                  with: {
                    _eq: "hegrenade",
                  },
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
          molotov_damage_aggregate: {
            // TODO - non team damage
            damage_dealt_aggregate: [
              {
                where: {
                  with: {
                    _in: ["molotov", "inferno"],
                  },
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
      },
    },
  ],
});
