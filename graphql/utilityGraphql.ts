import { $, order_by } from "~/generated/zeus";
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";

// Every argument goes through a GraphQL variable rather than being inlined.
// Zeus quotes a string it cannot find a type for, which would turn an enum
// column filter into an invalid literal; a variable carries its type in the
// operation header instead and is coerced server side.

export const utilityAuthorFields = {
  steam_id: true,
  name: true,
  avatar_url: true,
  custom_avatar_url: true,
  country: true,
  role: true,
} as const;

// Streaks are written by the API and only ever read here.
export const utilityProgressFields = {
  utility_lineup_id: true,
  steam_id: true,
  attempts: true,
  successes: true,
  current_streak: true,
  best_streak: true,
  last_practiced_at: true,
  mastered_at: true,
} as const;

export const utilityLineupListFields = {
  id: true,
  map_name: true,
  utility_type: true,
  side: true,
  technique: true,
  throw_strength: true,
  jump_throw_bind: true,
  aim_tolerance: true,
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
  // utilityDifficultyKey in utilities/utilityDisplay.ts.
  difficulty: true,
  view_yaw_delta: true,
  view_pitch_delta: true,
  trajectory_preview: true,
  upvotes: true,
  downvotes: true,
  favorites: true,
  // Computed fields: the raw preview_file/preview_thumbnail are S3 keys, and
  // only the Cloudflare worker knows how to serve one.
  preview_url: true,
  preview_thumbnail_url: true,
  preview_duration_ms: true,
  preview_rendered_at: true,
  verified_at: true,
  created_at: true,
  can_view: true,
  can_edit: true,
  my_vote: true,
  is_favorited: true,
  author: utilityAuthorFields,
  team: {
    id: true,
    name: true,
    short_name: true,
    avatar_url: true,
  },
  progress: [{}, utilityProgressFields],
} as const;

export const utilityLineupFields = {
  ...utilityLineupListFields,
  description: true,
  trajectory_size: true,
  updated_at: true,
  archived_at: true,
  public_requested_at: true,
  public_reviewed_at: true,
  public_review_note: true,
} as const;

// Deliberately narrow: only the columns the picker renders plus the two
// confirmed computed fields. Every extra guessed column is a hard validation
// error, not a blank cell.
export const utilityCollectionFields = {
  id: true,
  name: true,
  description: true,
  created_at: true,
  can_view: true,
  can_edit: true,
  items_aggregate: [{}, { aggregate: { count: true } }],
} as const;

// The only other place practice-session column names appear; everything the UI
// reads goes through readUtilityPracticeSession() in types/utility.ts.
export const utilityPracticeSessionFields = {
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

export const utilityLineupsQuery = generateQuery({
  utility_lineups: [
    {
      where: $("where", "utility_lineups_bool_exp!"),
      order_by: $("order_by", "[utility_lineups_order_by!]"),
      limit: $("limit", "Int!"),
      offset: $("offset", "Int!"),
    },
    utilityLineupListFields,
  ],
});

export const utilityLineupsCountQuery = generateQuery({
  utility_lineups_aggregate: [
    {
      where: $("where", "utility_lineups_bool_exp!"),
    },
    {
      aggregate: {
        count: true,
      },
    },
  ],
});

export const utilityLineupQuery = generateQuery({
  utility_lineups_by_pk: [
    {
      id: $("id", "uuid!"),
    },
    utilityLineupFields,
  ],
});

/**
 * The four scope tabs, counted together. Same reasoning as the map counts: one
 * round trip with aliases, rather than four queries fired on every filter
 * change just to put a number on a tab.
 */
export function utilityScopeCountsQuery(scopes: string[]) {
  const aliases: Record<string, unknown> = {};
  for (const scope of scopes) {
    aliases[`scope_${scope}`] = {
      utility_lineups_aggregate: [
        {
          where: $(`where_${scope}`, "utility_lineups_bool_exp!"),
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

/**
 * One aggregate per map in a single round trip. Hasura has no GROUP BY, and
 * ten aliased counts beat ten queries or pulling every row down to tally them
 * in the browser.
 */
export function utilityMapCountsQuery(mapNames: string[]) {
  const aliases: Record<string, unknown> = {};
  for (const name of mapNames) {
    aliases[mapCountAlias(name)] = {
      utility_lineups_aggregate: [
        {
          where: $(`where_${name}`, "utility_lineups_bool_exp!"),
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
export const createUtilityLineupMutation = generateMutation({
  insert_utility_lineups_one: [
    {
      object: $("object", "utility_lineups_insert_input!"),
    },
    {
      id: true,
    },
  ],
});

/** Copies a viewable lineup into the caller's own library as Private. */
export const forkUtilityLineupMutation = generateMutation({
  forkUtilityLineup: [
    {
      utility_lineup_id: $("utility_lineup_id", "uuid!"),
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
 * rather than recorded, so every caller has to render UtilityConfidenceNote
 * against it instead of implying an alignment nobody measured.
 */
export const saveUtilityLineupFromDemoMutation = generateMutation({
  saveUtilityLineupFromDemo: [
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
export const saveUtilityLineupFromPracticeMutation = generateMutation({
  saveUtilityLineupFromPractice: [
    {
      session_id: $("session_id", "uuid!"),
      utility_lineup_id: $("utility_lineup_id", "uuid!"),
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

export const utilityCollectionsQuery = generateQuery({
  utility_collections: [
    {
      where: $("where", "utility_collections_bool_exp!"),
      order_by: $("order_by", "[utility_collections_order_by!]"),
      limit: $("limit", "Int!"),
    },
    utilityCollectionFields,
  ],
});

export const utilityCollectionItemsQuery = generateQuery({
  utility_collection_items: [
    {
      where: $("where", "utility_collection_items_bool_exp!"),
    },
    {
      collection_id: true,
      utility_lineup_id: true,
    },
  ],
});

export const createUtilityCollectionMutation = generateMutation({
  insert_utility_collections_one: [
    {
      object: $("object", "utility_collections_insert_input!"),
    },
    {
      id: true,
      name: true,
    },
  ],
});

export const addLineupToCollectionMutation = generateMutation({
  insert_utility_collection_items_one: [
    {
      object: $("object", "utility_collection_items_insert_input!"),
    },
    {
      collection_id: true,
      utility_lineup_id: true,
    },
  ],
});

export const removeLineupFromCollectionMutation = generateMutation({
  delete_utility_collection_items: [
    {
      where: $("where", "utility_collection_items_bool_exp!"),
    },
    {
      affected_rows: true,
    },
  ],
});

// Clearing first means the write never depends on a unique-constraint name,
// which is the part of a Hasura upsert that is easiest to get wrong.
export const setUtilityVoteMutation = generateMutation({
  delete_utility_lineup_votes: [
    {
      where: $("where", "utility_lineup_votes_bool_exp!"),
    },
    {
      affected_rows: true,
    },
  ],
  insert_utility_lineup_votes_one: [
    {
      object: $("object", "utility_lineup_votes_insert_input!"),
    },
    {
      utility_lineup_id: true,
      vote: true,
    },
  ],
});

export const clearUtilityVoteMutation = generateMutation({
  delete_utility_lineup_votes: [
    {
      where: $("where", "utility_lineup_votes_bool_exp!"),
    },
    {
      affected_rows: true,
    },
  ],
});

export const favoriteUtilityLineupMutation = generateMutation({
  insert_utility_lineup_favorites_one: [
    {
      object: $("object", "utility_lineup_favorites_insert_input!"),
    },
    {
      utility_lineup_id: true,
    },
  ],
});

export const unfavoriteUtilityLineupMutation = generateMutation({
  delete_utility_lineup_favorites: [
    {
      where: $("where", "utility_lineup_favorites_bool_exp!"),
    },
    {
      affected_rows: true,
    },
  ],
});

// The action output is UtilityPracticeSessionOutput, whose key is `id` — the
// session row's pk. Pulling invite_code back here means the shareable link is
// ready the moment the mutation resolves, without waiting for the first
// subscription payload.
export const startUtilityPracticeMutation = generateMutation({
  startUtilityPractice: [
    {
      map_name: $("map_name", "String!"),
      // Nullable server side: omitting a region lets the API resolve one.
      region: $("region", "String"),
      collection_id: $("collection_id", "uuid"),
      is_open: $("is_open", "Boolean"),
      // Books one dedicated practice server outright; the region search and
      // the on-demand headroom reserve are both skipped when it is set.
      server_id: $("server_id", "uuid"),
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
export const joinUtilityPracticeMutation = generateMutation({
  joinUtilityPractice: [
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

export const stopUtilityPracticeMutation = generateMutation({
  stopUtilityPractice: [
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
export const inviteToUtilityPracticeMutation = generateMutation({
  inviteToUtilityPractice: [
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
 * The other half of stopUtilityPractice. Stopping is gated on `can_manage`, and
 * without this a joiner has no way out of a session at all — they are on the
 * roster of a server they cannot end and cannot leave.
 */
export const leaveUtilityPracticeMutation = generateMutation({
  leaveUtilityPractice: [
    {
      session_id: $("session_id", "uuid!"),
    },
    {
      success: true,
    },
  ],
});

// The session a refresh has to find again. Scoped to the caller: can_view also
// covers other people's open sessions, and rejoining a stranger's server on
// page load is not what "my session" means.
export const myUtilityPracticeSessionQuery = generateQuery({
  utility_practice_sessions: [
    {
      where: {
        host_steam_id: { _eq: $("steam_id", "bigint!") },
        status: { _in: $("statuses", "[e_utility_practice_statuses_enum!]") },
      },
      order_by: [{ created_at: order_by.desc }],
      limit: 1,
    },
    utilityPracticeSessionFields,
  ],
});

// The nav chip tracks this rather than polling: a reservation appears the
// moment it is booked and disappears the moment it is handed back, on whatever
// page the player happens to be on.
export const myUtilityPracticeSessionSubscription = generateSubscription({
  utility_practice_sessions: [
    {
      where: {
        host_steam_id: { _eq: $("steam_id", "bigint!") },
        status: { _in: $("statuses", "[e_utility_practice_statuses_enum!]") },
      },
      order_by: [{ created_at: order_by.desc }],
      limit: 1,
    },
    utilityPracticeSessionFields,
  ],
});

export const utilityPracticeSessionSubscription = generateSubscription({
  utility_practice_sessions_by_pk: [
    {
      id: $("id", "uuid!"),
    },
    utilityPracticeSessionFields,
  ],
});

export const utilityPlaybookFields = {
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
export const utilityPlaybookStepFields = {
  id: true,
  playbook_id: true,
  utility_lineup_id: true,
  step_order: true,
  offset_ms: true,
  assigned_steam_id: true,
  note: true,
} as const;

export const utilityPlaybooksQuery = generateQuery({
  utility_playbooks: [
    {
      where: $("where", "utility_playbooks_bool_exp!"),
      order_by: $("order_by", "[utility_playbooks_order_by!]"),
      limit: $("limit", "Int!"),
    },
    utilityPlaybookFields,
  ],
});

export const utilityPlaybookQuery = generateQuery({
  utility_playbooks_by_pk: [
    {
      id: $("id", "uuid!"),
    },
    utilityPlaybookFields,
  ],
});

// One call for every listed playbook's steps, keyed back by playbook_id.
export const utilityPlaybookStepsQuery = generateQuery({
  utility_playbook_steps: [
    {
      where: $("where", "utility_playbook_steps_bool_exp!"),
      order_by: $("order_by", "[utility_playbook_steps_order_by!]"),
    },
    utilityPlaybookStepFields,
  ],
});

/**
 * `steps` must stay absent from the variables to leave the stored steps alone —
 * an empty array is the documented way to clear them, so sending `[]` when the
 * caller only meant to rename wipes the execute.
 */
export const saveUtilityPlaybookMutation = generateMutation({
  saveUtilityPlaybook: [
    {
      playbook_id: $("playbook_id", "uuid"),
      name: $("name", "String!"),
      description: $("description", "String"),
      map_name: $("map_name", "String!"),
      side: $("side", "String!"),
      team_id: $("team_id", "uuid"),
      visibility: $("visibility", "String"),
      steps: $("steps", "[UtilityPlaybookStepInput!]"),
    },
    {
      id: true,
    },
  ],
});

// Archive, not delete. A lineup is referenced by other people's collections,
// playbooks, votes and drill progress, all of which cascade on a real DELETE --
// so removing yours would quietly wipe their history. Archiving takes it out of
// every library view and is reversible.
// Asking is an update the author is allowed to make; answering is not. The
// trigger on the table is what actually decides who may turn a lineup public.
export const requestUtilityLineupPublicMutation = generateMutation({
  update_utility_lineups_by_pk: [
    {
      pk_columns: { id: $("id", "uuid!") },
      _set: { public_requested_at: $("public_requested_at", "timestamptz") },
    },
    {
      id: true,
      public_requested_at: true,
    },
  ],
});

export const reviewUtilityLineupPublicMutation = generateMutation({
  update_utility_lineups_by_pk: [
    {
      pk_columns: { id: $("id", "uuid!") },
      _set: {
        visibility: $("visibility", "e_utility_visibility_enum"),
        public_requested_at: $("public_requested_at", "timestamptz"),
        public_review_note: $("public_review_note", "String"),
      },
    },
    {
      id: true,
      visibility: true,
      public_requested_at: true,
      public_reviewed_at: true,
    },
  ],
});

// One batch per call, by design: the whole point is that a caller can watch it
// progress instead of holding a request open across every demo on the install.
export const remineUtilityMetaMutation = generateMutation({
  remineUtilityMeta: [
    {},
    {
      demos: true,
      throws: true,
      done: true,
    },
  ],
});

// How precise the throw has to be before its in-game marker turns green. Set
// after the fact rather than at .save: the plugin records a throw, it cannot
// know whether landing it depends on the exact pixel or roughly the right wall.
export const setUtilityLineupPrecisionMutation = generateMutation({
  update_utility_lineups_by_pk: [
    {
      pk_columns: { id: $("id", "uuid!") },
      _set: { aim_tolerance: $("aim_tolerance", "float8") },
    },
    {
      id: true,
      aim_tolerance: true,
    },
  ],
});

export const archiveUtilityLineupMutation = generateMutation({
  update_utility_lineups_by_pk: [
    {
      pk_columns: { id: $("id", "uuid!") },
      _set: { archived_at: $("archived_at", "timestamptz") },
    },
    {
      id: true,
      archived_at: true,
    },
  ],
});

export const deleteUtilityPlaybookMutation = generateMutation({
  deleteUtilityPlaybook: [
    {
      playbook_id: $("playbook_id", "uuid!"),
    },
    {
      success: true,
    },
  ],
});

// playbook_id null unloads whatever the session is holding.
export const loadUtilityPlaybookIntoSessionMutation = generateMutation({
  loadUtilityPlaybookIntoSession: [
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
 * The mined aggregate. `utility_demo_throws` is the row-level table behind it and
 * names the players who threw — it is admin-only and must never be queried
 * from here; this view is the anonymous count that is safe to show.
 */
export const utilityMetaLineupFields = {
  lineup_bucket: true,
  map_name: true,
  utility_type: true,
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

export const utilityMetaLineupsQuery = generateQuery({
  utility_meta_lineups: [
    {
      where: $("where", "utility_meta_lineups_bool_exp!"),
      order_by: $("order_by", "[utility_meta_lineups_order_by!]"),
      limit: $("limit", "Int!"),
    },
    utilityMetaLineupFields,
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
          player: utilityAuthorFields,
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
export const checkUtilitySightlinesQuery = generateQuery({
  checkUtilitySightlines: [
    {
      lineup_id: $("lineup_id", "uuid!"),
      pairs: $("pairs", "[UtilitySightlinePairInput!]!"),
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

export const checkUtilityOneWayQuery = generateQuery({
  checkUtilityOneWay: [
    {
      lineup_id: $("lineup_id", "uuid!"),
      pairs: $("pairs", "[UtilitySightlinePairInput!]!"),
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
 * readUtilityPlaybookCoverage in utilities/utilityDisplay.ts, which is the only place
 * a false is allowed to become "open".
 */
export const analyseUtilityPlaybookCoverageQuery = generateQuery({
  analyseUtilityPlaybookCoverage: [
    {
      playbook_id: $("playbook_id", "uuid!"),
      pairs: $("pairs", "[UtilitySightlinePairInput!]!"),
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

export const findUtilityLineupsBlockingQuery = generateQuery({
  findUtilityLineupsBlocking: [
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
        utility_lineup_id: true,
        depth: true,
        transmittance: true,
        blocked: true,
      },
    },
  ],
});

export const utilitySolverCalibrationQuery = generateQuery({
  utilitySolverCalibration: [
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
export const solveUtilityLineupMutation = generateMutation({
  solveUtilityLineup: [
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
 * it used to have on the old revision. Same contract as solveUtilityLineup:
 * `accepted` is the server taking the job, not a fixed lineup.
 */
export const repairUtilityLineupMutation = generateMutation({
  repairUtilityLineup: [
    {
      utility_lineup_id: $("utility_lineup_id", "uuid!"),
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
 * `reason` is a machine token. It is mapped to copy in utilities/utilityDisplay.ts
 * and humanized when it is one this UI has never seen — a row is never dropped
 * for carrying a word the frontend does not recognise.
 */
export const utilityPracticePlanQuery = generateQuery({
  utilityPracticePlan: [
    {
      map_name: $("map_name", "String!"),
      side: $("side", "String"),
      limit: $("limit", "Int"),
      // Only UTILITY_PLAN_ORDERS may be sent: an unrecognised order is rejected
      // server side rather than falling back to the default, so a typo here is
      // a failed plan and not a quietly mis-sorted one.
      order: $("order", "String"),
    },
    {
      analysed: true,
      message: true,
      entries: {
        utility_lineup_id: true,
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
 * from the means — the threshold is a fraction of `utility_success_radius`, which
 * an operator can change and this page cannot read.
 */
export const utilityLineupMissPatternQuery = generateQuery({
  utilityLineupMissPattern: [
    {
      utility_lineup_id: $("utility_lineup_id", "uuid!"),
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
export const utilityTeamUtilityReportQuery = generateQuery({
  utilityTeamUtilityReport: [
    {
      team_id: $("team_id", "uuid!"),
      map_name: $("map_name", "String"),
      limit: $("limit", "Int"),
    },
    {
      analysed: true,
      message: true,
      entries: {
        utility_lineup_id: true,
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
export const utilityMatchUtilityReportQuery = generateQuery({
  utilityMatchUtilityReport: [
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
        utility_type: true,
        throws: true,
        matched: true,
        landed: true,
      },
    },
  ],
});

/**
 * Operator-only bulk import, capped at UTILITY_IMPORT_MAX_ENTRIES per call.
 * `dry_run` is the whole point of the shape: the counts and the per-entry errors
 * come back identically either way, so the panel can show exactly what a real
 * run would do before anything is written. `dry_run` is selected back rather
 * than assumed — the answer says which kind of run produced it.
 *
 * An error is a row, not a sentence: `index` is the entry's position in the
 * submitted payload, which is the only way to find it again in five thousand.
 */
export const importUtilityLineupsMutation = generateMutation({
  importUtilityLineups: [
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
 * `e_utility_sources` server side — so it is never "delete the lineups I think I
 * mean", and it is dry-runnable: the preview is the same shape with nothing
 * removed, which is what turns a destructive confirm into an informed one.
 */
export const purgeUtilityLineupSourceMutation = generateMutation({
  purgeUtilityLineupSource: [
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

export const startUtilityDriftScanMutation = generateMutation({
  startUtilityDriftScan: [
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
 * mapper in types/utility.ts. Scalars only and no relationships, for the same
 * reason the playbook steps are fetched on their own: the tables are known,
 * the names Hasura tracked their relationships under are not.
 *
 * The four verdict tallies are the scan's own count of every row it wrote, so
 * they stay right even though the page only ever loads a capped slice.
 */
export const utilityDriftScanFields = {
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
 * is where the utility lands" — which it is not.
 */
export const utilityDriftResultFields = {
  // The table has no surrogate key: a row is the (scan, lineup) pair.
  utility_drift_scan_id: true,
  utility_lineup_id: true,
  verdict: true,
  severity: true,
  // All three come back null when either side of the comparison failed to
  // resolve. That is an absence of measurement, not a zero.
  distance: true,
  distance_xy: true,
  distance_z: true,
  reason: true,
} as const;

export const utilityDriftScansQuery = generateQuery({
  utility_drift_scans: [
    {
      where: $("where", "utility_drift_scans_bool_exp!"),
      order_by: $("order_by", "[utility_drift_scans_order_by!]"),
      limit: $("limit", "Int!"),
    },
    utilityDriftScanFields,
  ],
});

export const utilityDriftResultsQuery = generateQuery({
  utility_drift_results: [
    {
      where: $("where", "utility_drift_results_bool_exp!"),
      order_by: $("order_by", "[utility_drift_results_order_by!]"),
      limit: $("limit", "Int!"),
    },
    utilityDriftResultFields,
  ],
});

export const utilityPracticeServersQuery = generateQuery({
  utilityPracticeServers: {
    servers: {
      id: true,
      label: true,
      region: true,
      in_use: true,
      held_by: true,
    },
  },
});
