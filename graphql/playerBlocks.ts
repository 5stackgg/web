import gql from "graphql-tag";

// Raw documents until `yarn codegen` runs against an api with player_blocks
// (5stackgg/api#441); rewrite them as Zeus selectors then.
export const MY_PLAYER_BLOCKS_SUBSCRIPTION = gql`
  subscription MyPlayerBlocks {
    player_blocks(order_by: { created_at: desc }) {
      blocked_steam_id
      created_at
      blocked {
        steam_id
        name
        avatar_url
        custom_avatar_url
        country
      }
    }
  }
`;

export const BLOCK_PLAYER_MUTATION = gql`
  mutation BlockPlayer($steamId: bigint!) {
    insert_player_blocks_one(object: { blocked_steam_id: $steamId }) {
      blocked_steam_id
    }
  }
`;

export const UNBLOCK_PLAYER_MUTATION = gql`
  mutation UnblockPlayer($steamId: bigint!) {
    delete_player_blocks(where: { blocked_steam_id: { _eq: $steamId } }) {
      affected_rows
    }
  }
`;
