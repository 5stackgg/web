import { order_by, Selector } from "@/generated/zeus";
import { mapFields } from "~/graphql/mapGraphql";

export const matchFields = Selector("servers")({
  id: true,
  status: true,
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
      order: true,
      lineup_1_score: true,
      lineup_2_score: true,
    },
  ],
  lineup_1: {
    id: true,
    name: true,
  },
  lineup_2: {
    id: true,
    name: true,
  },
  created_at: true,
});
