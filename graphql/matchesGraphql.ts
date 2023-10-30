import { Selector } from "@/generated/zeus";

export const matchFields = Selector("servers")({
  id: true,
  map: true,
  mr: true,
  status: true,
  type: true,
  lineup_1: {
    name: true,
    score: true,
    team: {
      name: true,
      short_name: true,
    },
  },
  lineup_2: {
    name: true,
    score: true,
    team: {
      name: true,
      short_name: true,
    },
  },
  created_at: true,
});
