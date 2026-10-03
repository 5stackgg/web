import { order_by } from "~/generated/zeus";

const count = [{}, { aggregate: { count: true } }] as const;

// Everything WatchTournamentCard reads, shared by /watch and /play.
export const tournamentCardFields = {
  id: true,
  name: true,
  status: true,
  start: true,
  location: true,
  banner: true,
  e_tournament_status: { description: true },
  categories: [
    {},
    { category: true, e_tournament_category: { description: true } },
  ],
  options: {
    type: true,
    best_of: true,
    map_pool: { maps: [{}, { poster: true }] },
  },
  organizer_teams: [{}, { team: { name: true } }],
  admin: { name: true },
  prizes: [{}, { prize: true }],
  teams_aggregate: count,
  stages: [
    { order_by: [{ order: order_by.asc }] },
    {
      order: true,
      max_teams: true,
      results: [
        {},
        {
          rank: true,
          team: { name: true, team: { name: true, short_name: true } },
        },
      ],
    },
  ],
  awards: [
    { where: { placement: { _eq: 1 } } },
    {
      placement: true,
      tournament_team: { name: true, team: { name: true, short_name: true } },
    },
  ],
};
