import { order_by, Selector } from "@/generated/zeus";

export const matchFields = Selector("servers")({
  id: true,
  mr: true,
  best_of: true,
  status: true,
  type: true,
  lineup_1_id: true,
  lineup_2_id: true,
  match_maps: [
    {
      order_by: [
        {
          order: order_by.asc,
        },
      ],
    },
    {
      map: true,
      order: true,
      lineup_1_score: true,
      lineup_2_score: true,
      picked_by: {
        name: true,
      },
    },
  ],
  lineups: {
    id: true,
    name: true,
  },
  created_at: true,
});
