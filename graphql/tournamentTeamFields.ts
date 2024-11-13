import { playerFields } from "~/graphql/playerFields";

export default {
  id: true,
  name: true,
  team_id: true,
  seed: true,
  eligible_at: true,
  team: {
    name: true,
  },
  roster: [
    {},
    {
      role: true,
      player: playerFields,
    },
  ],
  roster_aggregate: [
    {},
    {
      aggregate: {
        count: true,
      },
    },
  ],
};
