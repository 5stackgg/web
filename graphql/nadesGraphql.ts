import { $ } from "~/generated/zeus";
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";

// Every argument goes through a GraphQL variable rather than being inlined.
// Zeus quotes a string it cannot find a type for, which would turn an enum
// column filter into an invalid literal; a variable carries its type in the
// operation header instead and is coerced server side.

export const nadeAuthorFields = {
  steam_id: true,
  name: true,
  avatar_url: true,
  custom_avatar_url: true,
  country: true,
  role: true,
} as const;

// Streaks are written by the API and only ever read here.
export const nadeProgressFields = {
  nade_lineup_id: true,
  steam_id: true,
  attempts: true,
  successes: true,
  current_streak: true,
  best_streak: true,
  last_practiced_at: true,
  mastered_at: true,
} as const;

export const nadeLineupListFields = {
  id: true,
  map_name: true,
  nade_type: true,
  side: true,
  technique: true,
  throw_strength: true,
  jump_throw_bind: true,
  origin_x: true,
  origin_y: true,
  origin_z: true,
  eye_z: true,
  view_yaw: true,
  view_pitch: true,
  land_x: true,
  land_y: true,
  land_z: true,
  flight_time_ms: true,
  name: true,
  tags: true,
  visibility: true,
  team_id: true,
  author_steam_id: true,
  origin_source: true,
  confidence: true,
  // Graded from everyone's drill record, so it rides the list field set rather
  // than being fetched per card. `unmeasured` is a value, not an absence — see
  // nadeDifficultyKey in utilities/nadeDisplay.ts.
  difficulty: true,
  view_yaw_delta: true,
  view_pitch_delta: true,
  trajectory_preview: true,
  upvotes: true,
  downvotes: true,
  favorites: true,
  verified_at: true,
  created_at: true,
  can_view: true,
  can_edit: true,
  my_vote: true,
  is_favorited: true,
  author: nadeAuthorFields,
  team: {
    id: true,
    name: true,
    short_name: true,
    avatar_url: true,
  },
  progress: [{}, nadeProgressFields],
} as const;

export const nadeLineupFields = {
  ...nadeLineupListFields,
  description: true,
  trajectory_file: true,
  trajectory_size: true,
  updated_at: true,
} as const;

// Deliberately narrow: only the columns the picker renders plus the two
// confirmed computed fields. Every extra guessed column is a hard validation
// error, not a blank cell.
export const nadeCollectionFields = {
  id: true,
  name: true,
  description: true,
  created_at: true,
  can_view: true,
  can_edit: true,
  items_aggregate: [{}, { aggregate: { count: true } }],
} as const;

// The only other place practice-session column names appear; everything the UI
// reads goes through readNadePracticeSession() in types/nade.ts.
export const nadePracticeSessionFields = {
  id: true,
  match_id: true,
  host_steam_id: true,
  team_id: true,
  map_name: true,
  region: true,
  collection_id: true,
  playbook_id: true,
  status: true,
  invite_code: true,
  is_open: true,
  expires_at: true,
  failure_reason: true,
  connection_string: true,
  connection_link: true,
  is_member: true,
  can_view: true,
  can_manage: true,
} as const;

export const nadeLineupsQuery = generateQuery({
  nade_lineups: [
    {
      where: $("where", "nade_lineups_bool_exp!"),
      order_by: $("order_by", "[nade_lineups_order_by!]"),
      limit: $("limit", "Int!"),
      offset: $("offset", "Int!"),
    },
    nadeLineupListFields,
  ],
});

export const nadeLineupsCountQuery = generateQuery({
  nade_lineups_aggregate: [
    {
      where: $("where", "nade_lineups_bool_exp!"),
    },
    {
      aggregate: {
        count: true,
      },
    },
  ],
});

export const nadeLineupQuery = generateQuery({
  nade_lineups_by_pk: [
    {
      id: $("id", "uuid!"),
    },
    nadeLineupFields,
  ],
});

/**
 * One aggregate per map in a single round trip. Hasura has no GROUP BY, and
 * ten aliased counts beat ten queries or pulling every row down to tally them
 * in the browser.
 */
export function nadeMapCountsQuery(mapNames: string[]) {
  const aliases: Record<string, unknown> = {};
  for (const name of mapNames) {
    aliases[mapCountAlias(name)] = {
      nade_lineups_aggregate: [
        {
          where: $(`where_${name}`, "nade_lineups_bool_exp!"),
        },
        {
          aggregate: {
            count: true,
          },
        },
      ],
    };
  }
  return generateQuery({
    __alias: aliases,
  } as any);
}

export function mapCountAlias(mapName: string) {
  return `count_${mapName}`;
}

export function mapCountVariable(mapName: string) {
  return `where_${mapName}`;
}

/**
 * Authoring straight into the table — there is no action for it, and the `user`
 * role's insert permission is what decides which columns may appear here.
 * `origin_source` and `confidence` are deliberately absent: the server grades a
 * lineup, and a hand-placed one has no measured physics behind it to grade as
 * exact. Sending either is a permission error, not a stronger claim.
 */
export const createNadeLineupMutation = generateMutation({
  insert_nade_lineups_one: [
    {
      object: $("object", "nade_lineups_insert_input!"),
    },
    {
      id: true,
    },
  ],
});

/** Copies a viewable lineup into the caller's own library as Private. */
export const forkNadeLineupMutation = generateMutation({
  forkNadeLineup: [
    {
      nade_lineup_id: $("nade_lineup_id", "uuid!"),
      name: $("name", "String"),
      collection_id: $("collection_id", "uuid"),
    },
    {
      id: true,
    },
  ],
});

/**
 * The only path from a grenade in a demo to a lineup in the library. The meta
 * job mines aggregates — counts of where people throw — and never writes a
 * lineup, so without this a match's utility can be looked at but not kept.
 *
 * What comes back is graded `derived`: the aim is reconstructed from the flight
 * rather than recorded, so every caller has to render NadeConfidenceNote
 * against it instead of implying an alignment nobody measured.
 */
export const saveNadeLineupFromDemoMutation = generateMutation({
  saveNadeLineupFromDemo: [
    {
      match_id: $("match_id", "uuid!"),
      match_map_id: $("match_map_id", "uuid!"),
      // The parser's stable per-grenade id, which is what pairs a throw with
      // its detonation — not an index into anything.
      grenade_id: $("grenade_id", "Int!"),
      name: $("name", "String!"),
      description: $("description", "String"),
      visibility: $("visibility", "String"),
      team_id: $("team_id", "uuid"),
      tags: $("tags", "[String!]"),
      collection_id: $("collection_id", "uuid"),
    },
    {
      id: true,
    },
  ],
});

/**
 * Keeps a throw made in a practice session as a lineup of its own. The in-game
 * `.save` covers the same ground from inside the server; this is the panel-side
 * door for a session that is already open on the page.
 */
export const saveNadeLineupFromPracticeMutation = generateMutation({
  saveNadeLineupFromPractice: [
    {
      session_id: $("session_id", "uuid!"),
      nade_lineup_id: $("nade_lineup_id", "uuid!"),
      name: $("name", "String!"),
      description: $("description", "String"),
      visibility: $("visibility", "String"),
      team_id: $("team_id", "uuid"),
      tags: $("tags", "[String!]"),
      collection_id: $("collection_id", "uuid"),
    },
    {
      id: true,
    },
  ],
});

export const nadeCollectionsQuery = generateQuery({
  nade_collections: [
    {
      where: $("where", "nade_collections_bool_exp!"),
      order_by: $("order_by", "[nade_collections_order_by!]"),
      limit: $("limit", "Int!"),
    },
    nadeCollectionFields,
  ],
});

export const nadeCollectionItemsQuery = generateQuery({
  nade_collection_items: [
    {
      where: $("where", "nade_collection_items_bool_exp!"),
    },
    {
      collection_id: true,
      nade_lineup_id: true,
    },
  ],
});

export const createNadeCollectionMutation = generateMutation({
  insert_nade_collections_one: [
    {
      object: $("object", "nade_collections_insert_input!"),
    },
    {
      id: true,
      name: true,
    },
  ],
});

export const addLineupToCollectionMutation = generateMutation({
  insert_nade_collection_items_one: [
    {
      object: $("object", "nade_collection_items_insert_input!"),
    },
    {
      collection_id: true,
      nade_lineup_id: true,
    },
  ],
});

export const removeLineupFromCollectionMutation = generateMutation({
  delete_nade_collection_items: [
    {
      where: $("where", "nade_collection_items_bool_exp!"),
    },
    {
      affected_rows: true,
    },
  ],
});

// Clearing first means the write never depends on a unique-constraint name,
// which is the part of a Hasura upsert that is easiest to get wrong.
export const setNadeVoteMutation = generateMutation({
  delete_nade_lineup_votes: [
    {
      where: $("where", "nade_lineup_votes_bool_exp!"),
    },
    {
      affected_rows: true,
    },
  ],
  insert_nade_lineup_votes_one: [
    {
      object: $("object", "nade_lineup_votes_insert_input!"),
    },
    {
      nade_lineup_id: true,
      vote: true,
    },
  ],
});

export const clearNadeVoteMutation = generateMutation({
  delete_nade_lineup_votes: [
    {
      where: $("where", "nade_lineup_votes_bool_exp!"),
    },
    {
      affected_rows: true,
    },
  ],
});

export const favoriteNadeLineupMutation = generateMutation({
  insert_nade_lineup_favorites_one: [
    {
      object: $("object", "nade_lineup_favorites_insert_input!"),
    },
    {
      nade_lineup_id: true,
    },
  ],
});

export const unfavoriteNadeLineupMutation = generateMutation({
  delete_nade_lineup_favorites: [
    {
      where: $("where", "nade_lineup_favorites_bool_exp!"),
    },
    {
      affected_rows: true,
    },
  ],
});

// The action output is NadePracticeSessionOutput, whose key is `id` — the
// session row's pk. Pulling invite_code back here means the shareable link is
// ready the moment the mutation resolves, without waiting for the first
// subscription payload.
export const startNadePracticeMutation = generateMutation({
  startNadePractice: [
    {
      map_name: $("map_name", "String!"),
      // Nullable server side: omitting a region lets the API resolve one.
      region: $("region", "String"),
      collection_id: $("collection_id", "uuid"),
      is_open: $("is_open", "Boolean"),
    },
    {
      id: true,
      match_id: true,
      status: true,
      invite_code: true,
    },
  ],
});

// Takes either key: session_id for the in-app "join my session" path where the
// id is already in hand, invite_code for a shared link. The response hands the
// id back, which is what the by-pk subscription then needs.
export const joinNadePracticeMutation = generateMutation({
  joinNadePractice: [
    {
      session_id: $("session_id", "uuid"),
      invite_code: $("invite_code", "String"),
    },
    {
      id: true,
      match_id: true,
      status: true,
      invite_code: true,
    },
  ],
});

export const stopNadePracticeMutation = generateMutation({
  stopNadePractice: [
    {
      session_id: $("session_id", "uuid!"),
    },
    {
      success: true,
    },
  ],
});

/**
 * Puts people straight onto the session's roster rather than handing them a
 * link. Both paths matter: the link is how you reach someone who is not on the
 * panel, this is how you reach the four people who are.
 */
export const inviteToNadePracticeMutation = generateMutation({
  inviteToNadePractice: [
    {
      session_id: $("session_id", "uuid!"),
      steam_ids: $("steam_ids", "[String!]!"),
    },
    {
      success: true,
    },
  ],
});

/**
 * The other half of stopNadePractice. Stopping is gated on `can_manage`, and
 * without this a joiner has no way out of a session at all — they are on the
 * roster of a server they cannot end and cannot leave.
 */
export const leaveNadePracticeMutation = generateMutation({
  leaveNadePractice: [
    {
      session_id: $("session_id", "uuid!"),
    },
    {
      success: true,
    },
  ],
});

export const nadePracticeSessionSubscription = generateSubscription({
  nade_practice_sessions_by_pk: [
    {
      id: $("id", "uuid!"),
    },
    nadePracticeSessionFields,
  ],
});

export const nadePlaybookFields = {
  id: true,
  name: true,
  description: true,
  map_name: true,
  side: true,
  team_id: true,
  owner_steam_id: true,
  visibility: true,
  created_at: true,
  updated_at: true,
  can_view: true,
  can_edit: true,
} as const;

// Scalars only, and the steps are fetched as their own row set rather than
// through a relationship: the tables and their columns are known, the names
// Hasura tracked the relationships under are not.
export const nadePlaybookStepFields = {
  id: true,
  playbook_id: true,
  nade_lineup_id: true,
  step_order: true,
  offset_ms: true,
  assigned_steam_id: true,
  note: true,
} as const;

export const nadePlaybooksQuery = generateQuery({
  nade_playbooks: [
    {
      where: $("where", "nade_playbooks_bool_exp!"),
      order_by: $("order_by", "[nade_playbooks_order_by!]"),
      limit: $("limit", "Int!"),
    },
    nadePlaybookFields,
  ],
});

export const nadePlaybookQuery = generateQuery({
  nade_playbooks_by_pk: [
    {
      id: $("id", "uuid!"),
    },
    nadePlaybookFields,
  ],
});

// One call for every listed playbook's steps, keyed back by playbook_id.
export const nadePlaybookStepsQuery = generateQuery({
  nade_playbook_steps: [
    {
      where: $("where", "nade_playbook_steps_bool_exp!"),
      order_by: $("order_by", "[nade_playbook_steps_order_by!]"),
    },
    nadePlaybookStepFields,
  ],
});

/**
 * `steps` must stay absent from the variables to leave the stored steps alone —
 * an empty array is the documented way to clear them, so sending `[]` when the
 * caller only meant to rename wipes the execute.
 */
export const saveNadePlaybookMutation = generateMutation({
  saveNadePlaybook: [
    {
      playbook_id: $("playbook_id", "uuid"),
      name: $("name", "String!"),
      description: $("description", "String"),
      map_name: $("map_name", "String!"),
      side: $("side", "String!"),
      team_id: $("team_id", "uuid"),
      visibility: $("visibility", "String"),
      steps: $("steps", "[NadePlaybookStepInput!]"),
    },
    {
      id: true,
    },
  ],
});

export const deleteNadePlaybookMutation = generateMutation({
  deleteNadePlaybook: [
    {
      playbook_id: $("playbook_id", "uuid!"),
    },
    {
      success: true,
    },
  ],
});

// playbook_id null unloads whatever the session is holding.
export const loadNadePlaybookIntoSessionMutation = generateMutation({
  loadNadePlaybookIntoSession: [
    {
      session_id: $("session_id", "uuid!"),
      playbook_id: $("playbook_id", "uuid"),
    },
    {
      success: true,
    },
  ],
});

/**
 * The mined aggregate. `nade_demo_throws` is the row-level table behind it and
 * names the players who threw — it is admin-only and must never be queried
 * from here; this view is the anonymous count that is safe to show.
 */
export const nadeMetaLineupFields = {
  lineup_bucket: true,
  map_name: true,
  nade_type: true,
  side: true,
  technique: true,
  throw_strength: true,
  // Three different questions: how many people, how many throws, how many
  // matches. High `throws` against low `throwers` is one player drilling, not
  // a lineup the server has adopted, so they must never be shown as one number.
  throwers: true,
  throws: true,
  matches: true,
  // Server-side COUNT(*) of the saved lineups already in this cluster — zero is
  // authoritatively "nobody has written this one down".
  lineups: true,
  origin_x: true,
  origin_y: true,
  origin_z: true,
  land_x: true,
  land_y: true,
  land_z: true,
  view_yaw: true,
  view_pitch: true,
  first_seen_at: true,
  last_seen_at: true,
  refreshed_at: true,
} as const;

export const nadeMetaLineupsQuery = generateQuery({
  nade_meta_lineups: [
    {
      where: $("where", "nade_meta_lineups_bool_exp!"),
      order_by: $("order_by", "[nade_meta_lineups_order_by!]"),
      limit: $("limit", "Int!"),
    },
    nadeMetaLineupFields,
  ],
});

export const teamRosterQuery = generateQuery({
  teams_by_pk: [
    {
      id: $("id", "uuid!"),
    },
    {
      id: true,
      name: true,
      roster: [
        {},
        {
          player: nadeAuthorFields,
        },
      ],
    },
  ],
});

/**
 * The three analysis actions are read-only and are asked for as queries; the
 * two that make the server go and do something are mutations. If an action
 * turns out to be tracked the other way round, the fix is the generate* call
 * here plus the matching client.query/client.mutate at the call site.
 */
export const checkNadeSightlinesQuery = generateQuery({
  checkNadeSightlines: [
    {
      lineup_id: $("lineup_id", "uuid!"),
      pairs: $("pairs", "[NadeSightlinePairInput!]!"),
      // Omitted rather than guessed: the server's own default comes back on
      // the response, which is what the UI shows.
      threshold: $("threshold", "Float"),
    },
    {
      threshold: true,
      // `degraded` is the difference between "nothing blocks this" and "we
      // could not check". Never selected optionally — an empty `results` is
      // unreadable without it.
      degraded: true,
      message: true,
      results: {
        index: true,
        blocked: true,
        blocked_by: true,
        depth: true,
        transmittance: true,
        world_blocked: true,
      },
    },
  ],
});

export const checkNadeOneWayQuery = generateQuery({
  checkNadeOneWay: [
    {
      lineup_id: $("lineup_id", "uuid!"),
      pairs: $("pairs", "[NadeSightlinePairInput!]!"),
    },
    {
      degraded: true,
      message: true,
      results: {
        index: true,
        one_way: true,
        favors: true,
        cause: true,
        confidence: true,
        contested: true,
      },
    },
  ],
});

/**
 * The same pair input as the sightline check, asked of a whole execute instead
 * of one lineup. `covered` is only ever read next to `degraded` — see
 * readNadePlaybookCoverage in utilities/nadeDisplay.ts, which is the only place
 * a false is allowed to become "open".
 */
export const analyseNadePlaybookCoverageQuery = generateQuery({
  analyseNadePlaybookCoverage: [
    {
      playbook_id: $("playbook_id", "uuid!"),
      pairs: $("pairs", "[NadeSightlinePairInput!]!"),
    },
    {
      degraded: true,
      message: true,
      results: {
        index: true,
        covered: true,
        by_step: true,
        depth: true,
        transmittance: true,
      },
    },
  ],
});

export const findNadeLineupsBlockingQuery = generateQuery({
  findNadeLineupsBlocking: [
    {
      map_name: $("map_name", "String!"),
      from_x: $("from_x", "Float!"),
      from_y: $("from_y", "Float!"),
      from_z: $("from_z", "Float!"),
      to_x: $("to_x", "Float!"),
      to_y: $("to_y", "Float!"),
      to_z: $("to_z", "Float!"),
      side: $("side", "String"),
      limit: $("limit", "Int"),
    },
    {
      degraded: true,
      message: true,
      results: {
        nade_lineup_id: true,
        depth: true,
        transmittance: true,
        blocked: true,
      },
    },
  ],
});

export const nadeSolverCalibrationQuery = generateQuery({
  nadeSolverCalibration: [
    {
      session_id: $("session_id", "uuid!"),
    },
    {
      status: true,
      ready: true,
      detail: true,
    },
  ],
});

/**
 * Returns as soon as the job is taken: `accepted` is not a solved lineup. The
 * lineup itself shows up in the library through normal ingest up to two
 * minutes later, so every caller has to watch for it rather than await this.
 */
export const solveNadeLineupMutation = generateMutation({
  solveNadeLineup: [
    {
      session_id: $("session_id", "uuid!"),
      target_x: $("target_x", "Float!"),
      target_y: $("target_y", "Float!"),
      target_z: $("target_z", "Float!"),
      from_x: $("from_x", "Float"),
      from_y: $("from_y", "Float"),
      from_z: $("from_z", "Float"),
      utility_type: $("utility_type", "String"),
      name: $("name", "String"),
      tolerance: $("tolerance", "Float"),
    },
    {
      accepted: true,
      status: true,
      message: true,
    },
  ],
});

/**
 * Re-solves a lineup that a drift scan found had `moved`, aiming at the landing
 * it used to have on the old revision. Same contract as solveNadeLineup:
 * `accepted` is the server taking the job, not a fixed lineup.
 */
export const repairNadeLineupMutation = generateMutation({
  repairNadeLineup: [
    {
      nade_lineup_id: $("nade_lineup_id", "uuid!"),
      session_id: $("session_id", "uuid!"),
    },
    {
      accepted: true,
      status: true,
      message: true,
    },
  ],
});

/**
 * What the caller should drill next on a map. `analysed` is the same rule the
 * other analysis outputs carry: false means the plan could not be built, and an
 * empty `entries` under it is "we do not know", never "nothing left to learn".
 *
 * `reason` is a machine token. It is mapped to copy in utilities/nadeDisplay.ts
 * and humanized when it is one this UI has never seen — a row is never dropped
 * for carrying a word the frontend does not recognise.
 */
export const nadePracticePlanQuery = generateQuery({
  nadePracticePlan: [
    {
      map_name: $("map_name", "String!"),
      side: $("side", "String"),
      limit: $("limit", "Int"),
      // Only NADE_PLAN_ORDERS may be sent: an unrecognised order is rejected
      // server side rather than falling back to the default, so a typo here is
      // a failed plan and not a quietly mis-sorted one.
      order: $("order", "String"),
    },
    {
      analysed: true,
      message: true,
      entries: {
        nade_lineup_id: true,
        priority: true,
        meta_throwers: true,
        attempts: true,
        successes: true,
        mastered: true,
        reason: true,
        difficulty: true,
        // The denominator behind the grade. Shown beside the caller's own
        // record so the ranking reads as a comparison rather than a score.
        global_players: true,
        global_attempts: true,
        global_landing_rate: true,
      },
    },
  ],
});

/**
 * How a lineup gets missed, over every practice throw recorded at it. Same
 * `analysed` rule as the plan: false means the aggregate is below its sample
 * floor, and it nulls `bias` and all three means under it — `samples` survives,
 * which is the only honest thing to show there.
 *
 * `bias` is a machine token and the authoritative verdict; the means are signed
 * offsets in source units behind it. The frontend never re-derives the verdict
 * from the means — the threshold is a fraction of `nade_success_radius`, which
 * an operator can change and this page cannot read.
 */
export const nadeLineupMissPatternQuery = generateQuery({
  nadeLineupMissPattern: [
    {
      nade_lineup_id: $("nade_lineup_id", "uuid!"),
    },
    {
      analysed: true,
      message: true,
      // Two different denominators: forty throws by one player is a habit,
      // forty by twelve is the lineup. Never shown as one number.
      samples: true,
      players: true,
      mean_along: true,
      mean_lateral: true,
      mean_vertical: true,
      bias: true,
    },
  ],
});

/**
 * Which lineups a roster's grenades looked like in real matches. A throw is
 * attributed to a lineup by spatial bucket, so `thrown` counts throws that match
 * the lineup's shape — see pages/teams copy, which has to say so.
 */
export const nadeTeamUtilityReportQuery = generateQuery({
  nadeTeamUtilityReport: [
    {
      team_id: $("team_id", "uuid!"),
      map_name: $("map_name", "String"),
      limit: $("limit", "Int"),
    },
    {
      analysed: true,
      message: true,
      entries: {
        nade_lineup_id: true,
        thrown: true,
        landed: true,
        players: true,
      },
    },
  ],
});

/**
 * The same bucket-matched attribution, scoped to one match. `analysed: false`
 * means the demo has not been mined yet, which is a completely different claim
 * from every counter being zero — the UI renders the message instead.
 */
export const nadeMatchUtilityReportQuery = generateQuery({
  nadeMatchUtilityReport: [
    {
      match_id: $("match_id", "uuid!"),
      steam_id: $("steam_id", "String"),
    },
    {
      analysed: true,
      message: true,
      radius: true,
      throws: true,
      matched_lineups: true,
      matched_meta: true,
      landed: true,
      by_type: {
        nade_type: true,
        throws: true,
        matched: true,
        landed: true,
      },
    },
  ],
});

/**
 * Operator-only bulk import, capped at NADE_IMPORT_MAX_ENTRIES per call.
 * `dry_run` is the whole point of the shape: the counts and the per-entry errors
 * come back identically either way, so the panel can show exactly what a real
 * run would do before anything is written. `dry_run` is selected back rather
 * than assumed — the answer says which kind of run produced it.
 *
 * An error is a row, not a sentence: `index` is the entry's position in the
 * submitted payload, which is the only way to find it again in five thousand.
 */
export const importNadeLineupsMutation = generateMutation({
  importNadeLineups: [
    {
      payload: $("payload", "jsonb!"),
      dry_run: $("dry_run", "Boolean"),
    },
    {
      dry_run: true,
      total: true,
      imported: true,
      updated: true,
      failed: true,
      errors: {
        index: true,
        external_id: true,
        reason: true,
      },
    },
  ],
});

/**
 * The undo for a bad import. It names the source it deletes — validated against
 * `e_nade_sources` server side — so it is never "delete the lineups I think I
 * mean", and it is dry-runnable: the preview is the same shape with nothing
 * removed, which is what turns a destructive confirm into an informed one.
 */
export const purgeNadeLineupSourceMutation = generateMutation({
  purgeNadeLineupSource: [
    {
      origin_source: $("origin_source", "String!"),
      dry_run: $("dry_run", "Boolean"),
    },
    {
      dry_run: true,
      origin_source: true,
      lineups: true,
    },
  ],
});

export const startNadeDriftScanMutation = generateMutation({
  startNadeDriftScan: [
    {
      map_name: $("map_name", "String!"),
      from_revision: $("from_revision", "String"),
      to_revision: $("to_revision", "String"),
    },
    {
      scan_id: true,
      lineups: true,
    },
  ],
});

/**
 * The second of the two places drift column names live — the other is the
 * mapper in types/nade.ts. Scalars only and no relationships, for the same
 * reason the playbook steps are fetched on their own: the tables are known,
 * the names Hasura tracked their relationships under are not.
 *
 * The four verdict tallies are the scan's own count of every row it wrote, so
 * they stay right even though the page only ever loads a capped slice.
 */
export const nadeDriftScanFields = {
  id: true,
  map_name: true,
  status: true,
  failure_reason: true,
  from_revision: true,
  to_revision: true,
  lineups: true,
  scanned: true,
  unchanged: true,
  moved: true,
  broken: true,
  unsimulatable: true,
  max_distance: true,
  requested_by_steam_id: true,
  started_at: true,
  finished_at: true,
  created_at: true,
  updated_at: true,
} as const;

/**
 * `comparison_point` is deliberately not selected. It is only meaningful as a
 * difference between two revisions, and a coordinate on screen reads as "this
 * is where the nade lands" — which it is not.
 */
export const nadeDriftResultFields = {
  // The table has no surrogate key: a row is the (scan, lineup) pair.
  nade_drift_scan_id: true,
  nade_lineup_id: true,
  verdict: true,
  severity: true,
  // All three come back null when either side of the comparison failed to
  // resolve. That is an absence of measurement, not a zero.
  distance: true,
  distance_xy: true,
  distance_z: true,
  reason: true,
} as const;

export const nadeDriftScansQuery = generateQuery({
  nade_drift_scans: [
    {
      where: $("where", "nade_drift_scans_bool_exp!"),
      order_by: $("order_by", "[nade_drift_scans_order_by!]"),
      limit: $("limit", "Int!"),
    },
    nadeDriftScanFields,
  ],
});

export const nadeDriftResultsQuery = generateQuery({
  nade_drift_results: [
    {
      where: $("where", "nade_drift_results_bool_exp!"),
      order_by: $("order_by", "[nade_drift_results_order_by!]"),
      limit: $("limit", "Int!"),
    },
    nadeDriftResultFields,
  ],
});
