import { order_by, Selector } from "@/generated/zeus";
import { mapFields } from "~/graphql/mapGraphql";

export const simpleMatchFields = Selector("servers")({
  id: true,
  status: true,
  winning_lineup_id: true,
  lineup_1_id: true,
  lineup_2_id: true,
  options: {
    mr: true,
    best_of: true,
    type: true,
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
    },
  ],
  lineup_1: {
    id: true,
    name: true,
    is_on_lineup: true,
  },
  lineup_2: {
    id: true,
    name: true,
    is_on_lineup: true,
  },
  created_at: true,
  scheduled_at: true,
});