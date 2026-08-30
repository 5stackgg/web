import gql from "graphql-tag";

/**
 * PRE-CODEGEN ESCAPE HATCH — delete this file's raw documents and rewrite them
 * as Zeus selectors once `yarn codegen` has run against a migrated stack.
 *
 * `e_sanction_sources` and `e_sanction_scopes` land with the sanctions-policy
 * migration, so Zeus has never seen either table. Two things break at once when
 * a table is unknown: the generated `SelectionFunction` maps every key to
 * `never` (a compile error here AND at every call site), and `Zeus()` has no
 * `AllTypesProps` entry to tell it `order_by`'s value is an enum, so it emits
 * `order_by: {value: "asc"}` — a quoted string Hasura rejects outright. A raw
 * document sidesteps both, the same way `graphql/leagues.ts` does.
 */
export const SANCTION_POLICY_QUERY = gql`
  query GetSanctionPolicy {
    e_sanction_sources(order_by: { value: asc }) {
      value
      description
      default_enabled
      default_threshold
      default_window_days
      default_durations
      default_scope
      writes_platform_ban
    }
    e_sanction_scopes(order_by: { value: asc }) {
      value
      description
    }
  }
`;
