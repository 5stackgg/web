import gql from "graphql-tag";

// League queries use raw gql documents (same pattern as pages/leaderboard.vue)
// so they work before `yarn codegen` has been re-run against a Hasura instance
// that includes the league tables.

// There is a single global league (the whole site); divisions and seasons are
// top-level. Enabling the league is a settings toggle, not a created entity.
const LEAGUE_OVERVIEW_SELECTION = `
    league_divisions(order_by: { tier: asc }) {
      id
      name
      tier
    }
    league_seasons(order_by: { season_number: desc }) {
      id
      name
      season_number
      status
      signup_opens_at
      signup_closes_at
      starts_at
      roster_lock_at
      match_weeks_count
      games_per_week
      playoff_seats
      team_seasons_aggregate {
        aggregate {
          count
        }
      }
    }
`;

export const LEAGUE_OVERVIEW_QUERY = gql`
  query GetLeagueOverview {${LEAGUE_OVERVIEW_SELECTION}}
`;

// Field selection shared by the season query and the live subscription.
const LEAGUE_SEASON_SELECTION = `
    league_seasons_by_pk(id: $seasonId) {
      id
      name
      status
      signup_opens_at
      signup_closes_at
      starts_at
      roster_lock_at
      match_weeks_count
      games_per_week
      playoff_seats
      promote_count
      direct_promote_count
      relegation_up_count
      relegation_down_count
      direct_relegate_count
      relegate_count
      default_best_of
      playoff_best_of
      week_best_of
      playoff_round_best_of
      regular_season_stage_type
      auto_regular_season_format
      playoff_stage_type
      playoff_third_place_match
      min_roster_size
      max_roster_size
      match_options_id
      is_league_admin
      can_register
      is_roster_locked
      match_weeks(order_by: { week_number: asc }) {
        id
        week_number
        opens_at
        closes_at
        default_match_at
      }
      team_seasons(order_by: { created_at: asc }) {
        id
        status
        decline_reason
        seed
        requested_division_id
        assigned_division_id
        tournament_team_id
        captain_steam_id
        captain {
          steam_id
          name
          avatar_url
        }
        league_team {
          id
          team_id
          team {
            id
            name
            owner_steam_id
            captain_steam_id
          }
        }
        roster(where: { removed_at: { _is_null: true } }) {
          player_steam_id
          status
          player {
            steam_id
            name
            avatar_url
            elo
            premier_rank
            premier_rank_updated_at
            faceit_skill_level
            faceit_elo
            faceit_url
            faceit_nickname
          }
        }
        roster_history: roster(order_by: { added_at: asc }) {
          player_steam_id
          added_at
          removed_at
          removed_reason
          player {
            steam_id
            name
            avatar_url
          }
        }
      }
      season_divisions {
        id
        league_division_id
        tournament_id
        division {
          id
          name
          tier
        }
        tournament {
          id
          name
          status
          stages(order_by: { order: asc }) {
            id
            type
            order
            brackets(order_by: [{ round: asc }, { match_number: asc }]) {
              id
              round
              match_number
              path
              scheduled_at
              finished
              bye
              match_id
              tournament_team_id_1
              tournament_team_id_2
              team_1 {
                id
                name
                team_id
              }
              team_2 {
                id
                name
                team_id
              }
              match {
                id
                status
                scheduled_at
                winning_lineup_id
                lineup_1_id
                lineup_2_id
              }
              scheduling_proposals(order_by: { created_at: desc }) {
                id
                proposed_time
                status
                message
                proposed_by_steam_id
                proposed_by {
                  steam_id
                  name
                }
              }
            }
          }
        }
        standings(order_by: { rank: asc }) {
          league_team_season_id
          league_team_id
          tournament_team_id
          matches_played
          matches_remaining
          wins
          losses
          rounds_won
          rounds_lost
          round_diff
          head_to_head_match_wins
          rank
        }
      }
      movements {
        id
        league_team_id
        type
        final_rank
        approved_at
        from_division_id
        computed_to_division_id
        final_to_division_id
        league_team {
          id
          team {
            id
            name
          }
        }
        from_division {
          id
          name
        }
        computed_to_division {
          id
          name
        }
        final_to_division {
          id
          name
        }
      }
      relegation_playoffs {
        id
        higher_slots
        resolved_at
        higher_division {
          id
          name
        }
        lower_division {
          id
          name
        }
        tournament {
          id
          name
          status
        }
      }
    }
`;

const LEAGUE_DIVISIONS_SELECTION = `
    league_divisions(order_by: { tier: asc }) {
      id
      name
      tier
    }
`;

const LEAGUE_SEASONS_LIST_SELECTION = `
    league_seasons(order_by: { season_number: desc }) {
      id
      name
      season_number
      status
    }
`;

// The season page loads everything in one query, then keeps each piece live
// with its own subscription (Hasura subscriptions allow a single root field).
export const LEAGUE_SEASON_QUERY = gql`
  query GetLeagueSeason($seasonId: uuid!) {${LEAGUE_SEASON_SELECTION}${LEAGUE_DIVISIONS_SELECTION}${LEAGUE_SEASONS_LIST_SELECTION}}
`;

export const LEAGUE_DIVISIONS_SUBSCRIPTION = gql`
  subscription WatchLeagueDivisions {${LEAGUE_DIVISIONS_SELECTION}}
`;

export const LEAGUE_SEASONS_LIST_SUBSCRIPTION = gql`
  subscription WatchLeagueSeasonsList {${LEAGUE_SEASONS_LIST_SELECTION}}
`;

export const MY_MANAGED_TEAMS_QUERY = gql`
  query GetMyManagedTeams($steamId: bigint!) {
    teams(
      where: {
        _or: [
          { owner_steam_id: { _eq: $steamId } }
          { captain_steam_id: { _eq: $steamId } }
          {
            roster: { player_steam_id: { _eq: $steamId }, role: { _eq: Admin } }
          }
        ]
      }
      order_by: { name: asc }
    ) {
      id
      name
      roster {
        player_steam_id
        status
        coach
        player {
          steam_id
          name
          avatar_url
        }
      }
    }
  }
`;

export const UPSERT_DIVISION_MUTATION = gql`
  mutation UpsertLeagueDivision($name: String!, $tier: smallint!) {
    insert_league_divisions_one(object: { name: $name, tier: $tier }) {
      id
    }
  }
`;


export const DELETE_DIVISION_MUTATION = gql`
  mutation DeleteLeagueDivision($divisionId: uuid!) {
    delete_league_divisions_by_pk(id: $divisionId) {
      id
    }
  }
`;

export const REORDER_DIVISIONS_MUTATION = gql`
  mutation ReorderLeagueDivisions($divisionIds: _uuid!) {
    reorder_league_divisions(args: { _division_ids: $divisionIds }) {
      id
      tier
    }
  }
`;

export const CREATE_SEASON_MUTATION = gql`
  mutation CreateLeagueSeason($season: league_seasons_insert_input!) {
    insert_league_seasons_one(object: $season) {
      id
    }
  }
`;

export const DELETE_SEASON_MUTATION = gql`
  mutation DeleteLeagueSeason($seasonId: uuid!) {
    delete_league_seasons_by_pk(id: $seasonId) {
      id
    }
  }
`;

export const UPDATE_SEASON_STATUS_MUTATION = gql`
  mutation UpdateLeagueSeasonStatus(
    $seasonId: uuid!
    $status: e_league_season_statuses_enum!
  ) {
    update_league_seasons_by_pk(
      pk_columns: { id: $seasonId }
      _set: { status: $status }
    ) {
      id
      status
    }
  }
`;

export const UPDATE_SEASON_BEST_OF_MUTATION = gql`
  mutation UpdateLeagueSeasonBestOf(
    $seasonId: uuid!
    $changes: league_seasons_set_input!
  ) {
    update_league_seasons_by_pk(pk_columns: { id: $seasonId }, _set: $changes) {
      id
      week_best_of
      playoff_round_best_of
      regular_season_stage_type
      auto_regular_season_format
      playoff_stage_type
      playoff_third_place_match
    }
  }
`;

export const CREATE_MATCH_OPTIONS_MUTATION = gql`
  mutation CreateLeagueMatchOptions($mapPoolId: uuid!) {
    insert_match_options_one(
      object: {
        overtime: true
        knife_round: false
        mr: 12
        best_of: 1
        coaches: true
        map_veto: true
        region_veto: false
        match_mode: admin
        map_pool_id: $mapPoolId
        type: Competitive
        tv_delay: 115
      }
    ) {
      id
    }
  }
`;

export const MAP_POOLS_QUERY = gql`
  query GetSeedMapPools {
    map_pools(where: { seed: { _eq: true }, enabled: { _eq: true } }) {
      id
      type
    }
  }
`;

export const REGISTER_TEAM_MUTATION = gql`
  mutation RegisterLeagueTeam(
    $teamId: uuid!
    $seasonId: uuid!
    $requestedDivisionId: uuid
  ) {
    insert_league_teams_one(
      object: {
        team_id: $teamId
        team_seasons: {
          data: [
            {
              league_season_id: $seasonId
              requested_division_id: $requestedDivisionId
            }
          ]
          on_conflict: {
            constraint: league_team_seasons_league_season_id_league_team_id_key
            update_columns: [requested_division_id, status]
          }
        }
      }
      on_conflict: {
        constraint: league_teams_team_id_key
        update_columns: [team_id]
      }
    ) {
      id
    }
  }
`;

export const ADD_ROSTER_PLAYERS_MUTATION = gql`
  mutation AddLeagueRosterPlayers(
    $objects: [league_team_rosters_insert_input!]!
  ) {
    insert_league_team_rosters(
      objects: $objects
      on_conflict: {
        constraint: league_team_rosters_pkey
        update_columns: [removed_at, removed_reason, added_at, status]
      }
    ) {
      affected_rows
    }
  }
`;

export const UPDATE_ROSTER_STATUS_MUTATION = gql`
  mutation UpdateLeagueRosterStatus(
    $teamSeasonId: uuid!
    $playerSteamId: bigint!
    $status: e_team_roster_statuses_enum!
  ) {
    update_league_team_rosters_by_pk(
      pk_columns: {
        league_team_season_id: $teamSeasonId
        player_steam_id: $playerSteamId
      }
      _set: { status: $status }
    ) {
      player_steam_id
      status
    }
  }
`;

export const REMOVE_ROSTER_PLAYER_MUTATION = gql`
  mutation RemoveLeagueRosterPlayer(
    $teamSeasonId: uuid!
    $playerSteamId: bigint!
    $removedAt: timestamptz!
    $reason: String
  ) {
    update_league_team_rosters_by_pk(
      pk_columns: {
        league_team_season_id: $teamSeasonId
        player_steam_id: $playerSteamId
      }
      _set: { removed_at: $removedAt, removed_reason: $reason }
    ) {
      player_steam_id
    }
  }
`;

export const UPDATE_TEAM_SEASON_MUTATION = gql`
  mutation UpdateLeagueTeamSeason(
    $teamSeasonId: uuid!
    $changes: league_team_seasons_set_input!
  ) {
    update_league_team_seasons_by_pk(
      pk_columns: { id: $teamSeasonId }
      _set: $changes
    ) {
      id
      status
    }
  }
`;

export const PROPOSE_TIME_MUTATION = gql`
  mutation ProposeLeagueMatchTime(
    $bracketId: uuid!
    $proposedTime: timestamptz!
    $message: String
  ) {
    insert_league_scheduling_proposals_one(
      object: {
        tournament_bracket_id: $bracketId
        proposed_time: $proposedTime
        message: $message
      }
    ) {
      id
    }
  }
`;

export const RESPOND_PROPOSAL_MUTATION = gql`
  mutation RespondLeagueProposal(
    $proposalId: uuid!
    $status: e_league_proposal_statuses_enum!
  ) {
    update_league_scheduling_proposals_by_pk(
      pk_columns: { id: $proposalId }
      _set: { status: $status }
    ) {
      id
      status
    }
  }
`;

// The viewer's un-played league matches (their rostered teams, active seasons).
// Actionability (needs scheduling vs a proposal to answer) is derived on the
// client so this stays a plain, enum-free filter — it powers the client-derived
// "scheduling tasks" surface in the notifications panel (no backing rows).
export const MY_SCHEDULE_TASKS_SUBSCRIPTION = gql`
  subscription MyLeagueScheduleTasks($steamId: bigint!) {
    league_seasons {
      id
      season_number
      status
      match_weeks(order_by: { week_number: asc }) {
        week_number
        opens_at
        closes_at
        default_match_at
      }
      season_divisions {
        tournament {
          stages {
            brackets(
              where: {
                bye: { _eq: false }
                finished: { _eq: false }
                match_id: { _is_null: true }
                _or: [
                  {
                    team_1: {
                      team: {
                        _or: [
                          { owner_steam_id: { _eq: $steamId } }
                          { captain_steam_id: { _eq: $steamId } }
                          {
                            roster: {
                              player_steam_id: { _eq: $steamId }
                              role: { _eq: Admin }
                            }
                          }
                        ]
                      }
                    }
                  }
                  {
                    team_2: {
                      team: {
                        _or: [
                          { owner_steam_id: { _eq: $steamId } }
                          { captain_steam_id: { _eq: $steamId } }
                          {
                            roster: {
                              player_steam_id: { _eq: $steamId }
                              role: { _eq: Admin }
                            }
                          }
                        ]
                      }
                    }
                  }
                ]
              }
            ) {
              id
              round
              scheduled_at
              team_1 {
                name
                team_id
              }
              team_2 {
                name
                team_id
              }
              scheduling_proposals(order_by: { created_at: desc }) {
                id
                proposed_time
                status
                message
                proposed_by_steam_id
                proposed_by {
                  steam_id
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const AWARD_FORFEIT_MUTATION = gql`
  mutation AwardLeagueForfeit($bracketId: uuid!, $winningTeamId: uuid!) {
    league_award_forfeit(
      args: {
        _tournament_bracket_id: $bracketId
        _winning_tournament_team_id: $winningTeamId
      }
    ) {
      id
      status
    }
  }
`;

export const UPDATE_MOVEMENT_MUTATION = gql`
  mutation UpdateLeagueMovement($movementId: uuid!, $finalToDivisionId: uuid) {
    update_league_team_movements_by_pk(
      pk_columns: { id: $movementId }
      _set: { final_to_division_id: $finalToDivisionId }
    ) {
      id
    }
  }
`;

export const APPROVE_MOVEMENTS_MUTATION = gql`
  mutation ApproveLeagueMovements($seasonId: uuid!) {
    approve_league_season_movements(args: { _league_season_id: $seasonId }) {
      id
      approved_at
    }
  }
`;

export const REMOVE_TEAM_FROM_SEASON_MUTATION = gql`
  mutation RemoveLeagueTeamFromSeason($teamSeasonId: uuid!) {
    remove_league_team_from_season(
      args: { _league_team_season_id: $teamSeasonId }
    ) {
      id
      status
    }
  }
`;

export const CLONE_SEASON_MUTATION = gql`
  mutation CloneLeagueSeason($seasonId: uuid!) {
    clone_league_season(args: { _league_season_id: $seasonId }) {
      id
      name
    }
  }
`;

export const RESTART_SEASON_MUTATION = gql`
  mutation RestartLeagueSeason($seasonId: uuid!) {
    restart_league_season(args: { _league_season_id: $seasonId }) {
      id
      name
      status
    }
  }
`;

export const LEAGUE_SEASON_PLAYER_STATS_QUERY = gql`
  query GetLeagueSeasonPlayerStats($seasonId: uuid!) {
    v_league_season_player_stats(
      where: { league_season_id: { _eq: $seasonId } }
      order_by: { kills: desc }
    ) {
      league_division_id
      league_team_season_id
      league_team_id
      player_steam_id
      kills
      deaths
      assists
      headshots
      matches_played
      kdr
      headshot_percentage
      player {
        steam_id
        name
        avatar_url
      }
      league_team {
        id
        team {
          id
          name
        }
      }
    }
  }
`;

export const TEAM_LEAGUE_HISTORY_QUERY = gql`
  query GetTeamLeagueHistory($teamId: uuid!) {
    league_teams(where: { team_id: { _eq: $teamId } }) {
      id
      team_seasons(order_by: { created_at: desc }) {
        id
        status
        league_season_id
        season {
          id
          name
          status
          playoff_seats
        }
        assigned_division {
          id
          name
          tier
        }
      }
      movements(order_by: { created_at: desc }) {
        id
        league_season_id
        type
        final_rank
        approved_at
        from_division {
          name
        }
        final_to_division {
          name
        }
        computed_to_division {
          name
        }
      }
    }
  }
`;

// Same selection as LEAGUE_SEASON_QUERY, exposed as a live subscription so the
// season page updates in place (proposals, results, registrations).
export const LEAGUE_SEASON_SUBSCRIPTION = gql`
  subscription WatchLeagueSeason($seasonId: uuid!) {${LEAGUE_SEASON_SELECTION}}
`;
