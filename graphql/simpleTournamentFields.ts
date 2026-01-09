import { order_by, Selector } from "~/generated/zeus";
import { matchOptionsFields } from "./matchOptionsFields";

export const simpleTournamentFields = Selector("tournaments")({
  id: true,
  name: true,
  start: true,
  description: true,
  e_tournament_status: {
    description: true,
  },
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
