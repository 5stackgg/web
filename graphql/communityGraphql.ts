import gql from "graphql-tag";

// Raw documents: the community session tables, view and actions are newer
// than the generated zeus client. Send them with COMMUNITY_OPTIONAL so web
// shipping ahead of the api's metadata degrades to the old behaviour instead
// of toasting an error the viewer cannot act on.
export const COMMUNITY_OPTIONAL = { optional: true };

// Only what a roster row renders: the live roster re-runs about once a second
// per watched server, so every extra field here is paid for continuously.
const ROW_PLAYER_FIELDS = `
  steam_id
  name
  avatar_url
  is_registered
  is_banned
  is_muted
  is_gagged
  vac_banned
  vac_ban_count
  game_ban_count
  days_since_last_ban
`;

const TOTALS_FIELDS = `
  sessions
  seconds
  kills
  deaths
  servers
  rank
`;

const LEADERBOARD_ENTRY_FIELDS = `
  rank
  steam_id
  name
  avatar_url
  country
  seconds
  kills
  deaths
  sessions
`;

export const SERVER_ROSTER_SUBSCRIPTION = gql`
  subscription ServerRoster($serverId: uuid!) {
    server_rosters_by_pk(server_id: $serverId) {
      server_id
      reported_at
      sessions(
        where: { ended_at: { _is_null: true } }
        order_by: { started_at: asc }
      ) {
        id
        player_steam_id
        name
        ip
        kills
        deaths
        started_at
        player {
          ${ROW_PLAYER_FIELDS}
        }
      }
    }
  }
`;

export const SERVER_RECENT_PLAYERS_QUERY = gql`
  query ServerRecentPlayers(
    $where: server_recent_players_bool_exp!
    $limit: Int!
    $offset: Int!
  ) {
    server_recent_players(
      where: $where
      order_by: [
        { online: desc }
        { last_seen_at: desc }
        { player_steam_id: asc }
      ]
      limit: $limit
      offset: $offset
    ) {
      server_id
      player_steam_id
      name
      ip
      sessions
      seconds_played
      kills
      first_seen_at
      last_seen_at
      online
      player {
        ${ROW_PLAYER_FIELDS}
      }
    }
    server_recent_players_aggregate(where: $where) {
      aggregate {
        count
      }
    }
  }
`;

export const SERVER_RECENT_TOTALS_QUERY = gql`
  query ServerRecentPlayerTotals(
    $serverId: uuid!
    $day: timestamptz!
    $week: timestamptz!
  ) {
    day: server_recent_players_aggregate(
      where: {
        server_id: { _eq: $serverId }
        _or: [{ online: { _eq: true } }, { last_seen_at: { _gte: $day } }]
      }
    ) {
      aggregate {
        count
      }
    }
    week: server_recent_players_aggregate(
      where: {
        server_id: { _eq: $serverId }
        _or: [{ online: { _eq: true } }, { last_seen_at: { _gte: $week } }]
      }
    ) {
      aggregate {
        count
        sum {
          sessions
          seconds_played
        }
      }
    }
  }
`;

export const SERVER_SESSIONS_ON_IPS_QUERY = gql`
  query ServerSessionsOnIps(
    $serverId: uuid!
    $ips: [inet!]!
    $week: timestamptz!
  ) {
    server_player_sessions(
      where: {
        server_id: { _eq: $serverId }
        ip: { _in: $ips }
        _or: [{ ended_at: { _is_null: true } }, { ended_at: { _gte: $week } }]
      }
      distinct_on: [ip, player_steam_id]
      order_by: [
        { ip: asc }
        { player_steam_id: asc }
        { started_at: desc }
      ]
    ) {
      ip
      player_steam_id
      name
      player {
        steam_id
        name
        is_registered
      }
    }
  }
`;

export const PLAYER_COMMUNITY_STATS_QUERY = gql`
  query PlayerCommunityStats($steamId: bigint!) {
    getPlayerCommunityStats(steam_id: $steamId) {
      week {
        ${TOTALS_FIELDS}
      }
      all_time {
        ${TOTALS_FIELDS}
      }
      last_seen_at
      online_server_id
      online_server_label
      is_moderator_view
      servers {
        server_id
        label
        region
        type
        online
        last_seen_at
        week {
          ${TOTALS_FIELDS}
        }
        all_time {
          ${TOTALS_FIELDS}
        }
        names
        sessions {
          started_at
          ended_at
          ip
        }
      }
      ips {
        ip
        sessions
      }
      ip_matches {
        steam_id
        name
        avatar_url
        has_account
        is_banned
        sessions
        last_seen_at
        online
        ip
      }
    }
  }
`;

export const PUBLIC_SERVER_SUBSCRIPTION = gql`
  subscription PublicServer($serverId: uuid!) {
    servers_by_pk(id: $serverId) {
      id
      label
      type
      game
      region
      connected
      connection_link
      connection_string
      max_players
      game_mode {
        slug
        name
      }
    }
  }
`;

export const DEDICATED_SERVER_INFO_QUERY = gql`
  query PublicServerInfo {
    getDedicatedServerInfo {
      id
      map
      players
      lastPing
    }
  }
`;

export const SERVER_COMMUNITY_STATS_QUERY = gql`
  query ServerCommunityStats($serverId: uuid!) {
    getServerCommunityStats(server_id: $serverId) {
      server_id
      online
      max_players
      week_players
      week_seconds
      all_time_players
      tracked_since
      hourly {
        hour
        seconds
        players
      }
    }
  }
`;

export const SERVER_LEADERBOARD_QUERY = gql`
  query ServerLeaderboard(
    $serverId: uuid!
    $period: String!
    $metric: String!
    $limit: Int
  ) {
    getServerLeaderboard(
      server_id: $serverId
      period: $period
      metric: $metric
      limit: $limit
    ) {
      entries {
        ${LEADERBOARD_ENTRY_FIELDS}
      }
      you {
        ${LEADERBOARD_ENTRY_FIELDS}
      }
    }
  }
`;
