import {
  e_tournament_free_agent_statuses_enum,
  order_by,
} from "~/generated/zeus";

const count = [{}, { aggregate: { count: true } }] as const;

// The pool: drafted agents are on a team, withdrawn ones have left.
export const freeAgentPoolWhere = {
  status: {
    _in: [
      e_tournament_free_agent_statuses_enum.registered,
      e_tournament_free_agent_statuses_enum.waitlisted,
    ],
  },
};

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
  registration_type: true,
  min_players_per_lineup: true,
  free_agents_aggregate: [
    { where: freeAgentPoolWhere },
    { aggregate: { count: true } },
  ],
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
  // The viewer's own standing, so a card never offers "Register a team" to
  // someone already in: on a roster or owning a team, or in the free agent
  // pool (which of those is told apart by the pool rows).
  joined_tournament: true,
  free_agents: [
    { where: freeAgentPoolWhere },
    { player_steam_id: true, status: true },
  ],
  awards: [
    { where: { placement: { _eq: 1 } } },
    {
      placement: true,
      tournament_team: { name: true, team: { name: true, short_name: true } },
    },
  ],
};
