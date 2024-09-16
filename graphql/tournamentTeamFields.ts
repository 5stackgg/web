export default {
  id: true,
  name: true,
  team_id: true,
  eligible_at: true,
  team: {
    name: true,
  },
  roster: [
    {},
    {
      role: true,
      player: {
        name: true,
        steam_id: true,
        avatar_url: true,
        country: true,
      },
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
  // matches: [{}, matchFields],
};
