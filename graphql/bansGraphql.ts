import gql from "graphql-tag";

// Raw documents: recently_banned_players and its return type are newer than
// the generated zeus client. The page checks schemaHasType(RECENT_BANS_TYPE)
// first and sends these with { optional: true }, so web shipping ahead of the
// api shows an empty page instead of toasting an error. Who issued a ban is
// only asked for when the viewer is a moderator.
export const RECENT_BANS_TYPE = "recent_ban_entries";

export const RECENT_BANS_QUERY = gql`
  query RecentlyBanned(
    $args: recently_banned_players_args!
    $limit: Int!
    $offset: Int!
    $order_by: [recent_ban_entries_order_by!]
    $moderator: Boolean!
  ) {
    recently_banned_players(
      args: $args
      limit: $limit
      offset: $offset
      order_by: $order_by
    ) {
      steam_id
      banned_at
      banned_at_source
      steam_banned_on
      vac_ban_count
      game_ban_count
      sanction_id
      sanction_kind
      banned_here
      first_match_at
      last_match_at
      last_match_map
      matches_played
      matches_since_steam_ban
      arrived_banned
      shared_matches
      player {
        steam_id
        name
        role
        country
        avatar_url
        custom_avatar_url
        elo
      }
      sanction {
        id
        reason
        created_at
        remove_sanction_date
        sanctioned_by @include(if: $moderator) {
          steam_id
          name
        }
      }
    }
    recently_banned_players_aggregate(args: $args) {
      aggregate {
        count
      }
    }
  }
`;

// Moderators only: Steam-banned players inside the window with no active ban
// here, for the "can still play here" link.
export const RECENT_BAN_GAPS_QUERY = gql`
  query RecentBanGaps($args: recently_banned_players_args!) {
    recently_banned_players_aggregate(args: $args) {
      aggregate {
        count
      }
    }
  }
`;

// The same action PlayerSanctions uses to lift a sanction.
export const END_BAN_MUTATION = gql`
  mutation EndRecentBan($steam_id: String!, $sanction_id: uuid) {
    unsanctionServerPlayer(
      steam_id: $steam_id
      type: "ban"
      sanction_id: $sanction_id
    ) {
      enforced
      message
    }
  }
`;
