import { Selector } from "@/generated/zeus";

export const matchFields = Selector("servers")({
  id: true,
  mr: true,
  best_of: true,
  status: true,
  type: true,
  lineups: {
    name: true,
    team: {
      name: true,
      short_name: true,
    },
  },
  created_at: true,
});
