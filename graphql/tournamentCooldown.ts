import gql from "graphql-tag";

/**
 * PRE-CODEGEN ESCAPE HATCH — rewrite as a Zeus selector and delete this whole
 * file's raw document once `yarn codegen` has run against a migrated stack.
 *
 * `players.tournament_cooldown` is a computed field that lands with the
 * sanctions migration, so the generated player selector maps the key to `never`
 * and every call site that spreads it fails to compile.
 *
 * The point of the separate document is deploy order, not types. api and web
 * are separate images on separate release channels, so web can reach a stack
 * whose api has not migrated yet. While this field lived in `meFields` that
 * rejection took the whole `me` document with it — and `me` is what sign-in
 * reads, so an unmigrated api locked everyone out over a readout nobody would
 * have missed. On its own subscription the same rejection costs exactly the
 * cooldown line.
 *
 * `steam_id` is selected purely so the result normalises onto the existing
 * `players:<steam_id>` cache entity (see the keyFields policy in
 * plugins/apollo.client.ts) instead of landing as an unidentified object.
 */
export const TOURNAMENT_COOLDOWN_SUBSCRIPTION = gql`
  subscription GetTournamentCooldown($steamId: bigint!) {
    players_by_pk(steam_id: $steamId) {
      steam_id
      tournament_cooldown
    }
  }
`;
