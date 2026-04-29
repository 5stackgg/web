import { playerFields } from "~/graphql/playerFields";

export default {
  id: true,
  name: true,
  team_id: true,
  seed: true,
  eligible_at: true,
  can_manage: true,
  captain_steam_id: true,
  owner_steam_id: true,
  captain: playerFields,
  team: {
    name: true,
    avatar_url: true,
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
