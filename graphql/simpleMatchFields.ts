import { order_by, Selector } from "@/generated/zeus";
import { mapFields } from "~/graphql/mapGraphql";
import { playerFields } from "~/graphql/playerFields";

export const simpleMatchFields = Selector("matches")({
  id: true,
  status: true,
  ended_at: true,
  e_match_status: {
    description: true,
  },
  winning_lineup_id: true,
  lineup_1_id: true,
  lineup_2_id: true,
  options: {
    mr: true,
    best_of: true,
    type: true,
    lobby_access: true,
  },
  match_maps: [
    {
      order_by: [
        {
          order: order_by.asc,
        },
      ],
    },
    {
      map: mapFields,
      lineup_1_score: true,
      lineup_2_score: true,
      winning_lineup_id: true,
    },
  ],
  lineup_1: {
    id: true,
    name: true,
    is_on_lineup: true,
    lineup_players: [
      {},
      {
        checked_in: true,
        placeholder_name: true,
        player: playerFields,
      },
    ],
  },
  lineup_2: {
    id: true,
    name: true,
    is_on_lineup: true,
    lineup_players: [
      {},
      {
        checked_in: true,
        placeholder_name: true,
        player: playerFields,
      },
    ],
  },
  created_at: true,
  scheduled_at: true,
  min_players_per_lineup: true,
  lineup_counts: [{}, true],
});
