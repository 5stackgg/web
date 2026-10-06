import gql from "graphql-tag";

// Raw documents until `yarn codegen` runs against an api with
// players.allow_message_requests; rewrite them as Zeus selectors then. Kept out
// of meFields, which every sign-in depends on.
export const MY_MESSAGE_REQUESTS_SETTING_QUERY = gql`
  query MyMessageRequestsSetting($steamId: bigint!) {
    players_by_pk(steam_id: $steamId) {
      steam_id
      allow_message_requests
    }
  }
`;

export const SET_MESSAGE_REQUESTS_SETTING_MUTATION = gql`
  mutation SetMessageRequestsSetting($steamId: bigint!, $allow: Boolean!) {
    update_players_by_pk(
      pk_columns: { steam_id: $steamId }
      _set: { allow_message_requests: $allow }
    ) {
      steam_id
      allow_message_requests
    }
  }
`;
