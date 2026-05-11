import { $, order_by, Selector } from "~/generated/zeus";
import { playerFields } from "~/graphql/playerFields";

// Shell-only lineup shape. Per-player stats live in matchAllMapsStatsGraphql
// and matchMapStatsGraphql so the page shell doesn't wait on aggregates.
export const matchLineups = Selector("match_lineups")({
  id: true,
  name: true,
  team_id: true,
  team: {
    name: true,
    avatar_url: true,
  },
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
      player: playerFields,
    },
  ],
});
