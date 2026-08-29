// Mirrors graphql/utilityGraphql.ts — extend both together.
export type UtilityType =
  | "Decoy"
  | "HighExplosive"
  | "Flash"
  | "Molotov"
  | "Smoke";

export type UtilitySide = "CT" | "TERRORIST";

export type UtilityTechnique =
  | "Stationary"
  | "Walking"
  | "Running"
  | "Crouch"
  | "Jump"
  | "RunJump"
  | "WalkJump"
  | "CrouchJump";

export type UtilityThrowStrength = "Full" | "Half" | "Drop";

export type UtilityVisibility = "Private" | "Team" | "Public";

export type UtilityOriginSource = "plugin" | "demo" | "editor" | "import";

// `derived` means the angles were inferred from a demo rather than recorded by
// the plugin. The UI has to say so: such a lineup is a starting point, not an
// alignment you can trust shot-for-shot.
export type UtilityConfidence = "exact" | "derived" | "low";

export type UtilityAuthorRef = {
  steam_id: string;
  name: string;
  avatar_url: string | null;
  custom_avatar_url?: string | null;
  country?: string | null;
  role?: string | null;
};

export type UtilityTeamRef = {
  id: string;
  name: string;
  short_name?: string | null;
  avatar_url?: string | null;
};

/** One point of a flight path, in raw CS2 source units. */
export type UtilityTrajectoryPoint = {
  x: number;
  y: number;
  z: number;
  t?: number;
};

export type UtilityLineup = {
  id: string;
  map_name: string;
  utility_type: UtilityType;
  side: UtilitySide;
  technique: UtilityTechnique;
  throw_strength: UtilityThrowStrength;
  jump_throw_bind: boolean | null;
  /**
   * Degrees. How close the crosshair has to be in game before the lineup's
   * marker turns green. Hasura sends double precision as a STRING.
   */
  aim_tolerance?: number | string | null;
  origin_x: number;
  origin_y: number;
  origin_z: number;
  eye_z: number | null;
  view_yaw: number | null;
  view_pitch: number | null;
  land_x: number | null;
  land_y: number | null;
  land_z: number | null;
  flight_time_ms: number | null;
  name: string;
  description?: string | null;
  tags: string[] | null;
  visibility: UtilityVisibility;
  team_id: string | null;
  author_steam_id: string | null;
  origin_source: UtilityOriginSource;
  /** Where an imported lineup came from. Sometimes a clip, usually a page. */
  source_url?: string | null;
  confidence: UtilityConfidence;
  /** Up to 32 quantized points — enough to draw the line on a list/board. */
  trajectory_preview: Array<[number, number, number]> | null;
  trajectory_size?: number | null;
  /**
   * Signed disagreement between the aim the trajectory implies and the view
   * angles the demo recorded. Only mined lineups carry it, and a big number
   * means "go verify this", not "this is broken".
   */
  view_yaw_delta?: number | null;
  view_pitch_delta?: number | null;
  /**
   * PROVISIONAL. Aggregate difficulty graded from everyone's drill record, as a
   * machine token — utilities/utilityDisplay.ts owns the words and the colours for
   * it. Null is the same claim as `unmeasured`: nobody has thrown it enough.
   */
  difficulty?: string | null;
  upvotes: number;
  downvotes: number;
  favorites: number;
  /**
   * The preview render. Computed fields, not the stored S3 keys: only the
   * Cloudflare worker can serve one, and the raw key is not a URL. Null until
   * the lineup goes public and the render pod has filmed it.
   */
  preview_url?: string | null;
  preview_thumbnail_url?: string | null;
  preview_duration_ms?: number | null;
  preview_rendered_at?: string | null;
  verified_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  archived_at?: string | null;
  public_requested_at?: string | null;
  public_reviewed_at?: string | null;
  public_review_note?: string | null;
  can_view: boolean;
  can_edit: boolean;
  my_vote: number | null;
  is_favorited: boolean;
  author?: UtilityAuthorRef | null;
  team?: UtilityTeamRef | null;
  progress?: UtilityLineupProgress[] | null;
};

/**
 * One lineup's preview render job. Mirrors utility_lineup_renders; only a
 * moderator can read one, so nothing outside the review surfaces has it.
 */
export type UtilityLineupRender = {
  id: string;
  utility_lineup_id: string;
  map_name: string;
  status:
    | "queued"
    | "rendering"
    | "uploading"
    | "done"
    | "error"
    | "skipped"
    | "cancelled";
  /** Hasura sends numeric(4,3) as a STRING. */
  progress: number | string | null;
  error_message: string | null;
  /**
   * Why a lineup could not be filmed at all -- no physics seed, wrong runtime,
   * wrong map. A verdict on the lineup, not a fault to retry.
   */
  skip_reason: string | null;
  duration_ms: number | null;
  k8s_job_name: string | null;
  game_server_node_id: string | null;
  paused: boolean;
  sort_index: number | null;
  /**
   * Boot ticks arrive as status "booting" with a boot_stage and never touch
   * the row's status -- same shape clip_render_jobs carries, so BootSequence
   * reads both. Within-stage ticks coalesce and keep the first `at`.
   */
  status_history: Array<{
    status: string;
    at: string;
    boot_stage?: string;
    boot_progress?: number;
    skip_reason?: string;
  }> | null;
  last_status_at: string | null;
  created_at: string;
  requested_by?: UtilityAuthorRef | null;
  lineup?: Pick<
    UtilityLineup,
    | "id"
    | "name"
    | "map_name"
    | "utility_type"
    | "side"
    | "confidence"
    | "preview_url"
    | "preview_thumbnail_url"
    | "preview_rendered_at"
  > | null;
};

export type UtilityCollection = {
  id: string;
  name: string;
  description: string | null;
  created_at?: string | null;
  can_view?: boolean;
  can_edit?: boolean;
  // can_edit covers a teammate editing a team collection; only the owner may
  // delete one, which is what the Hasura delete permission filters on.
  owner_steam_id?: string | null;
  items_aggregate?: {
    aggregate?: { count?: number | null } | null;
  } | null;
};

/** One player's drill record against one lineup. Streaks are API-written. */
export type UtilityLineupProgress = {
  utility_lineup_id: string;
  steam_id: string;
  attempts: number | null;
  successes: number | null;
  current_streak: number | null;
  best_streak: number | null;
  last_practiced_at: string | null;
  mastered_at: string | null;
};

/** One ordered beat of an execute. `step_order` is written from the index. */
export type UtilityPlaybookStep = {
  id: string;
  playbook_id: string;
  utility_lineup_id: string;
  step_order: number;
  offset_ms: number | null;
  assigned_steam_id: string | null;
  note: string | null;
};

export type UtilityPlaybook = {
  id: string;
  name: string;
  description: string | null;
  map_name: string;
  side: UtilitySide;
  team_id: string | null;
  owner_steam_id: string | null;
  visibility: UtilityVisibility;
  created_at?: string | null;
  updated_at?: string | null;
  can_view: boolean;
  can_edit: boolean;
};

/** What saveUtilityPlaybook takes per step — order comes from the array index. */
export type UtilityPlaybookStepInput = {
  utility_lineup_id: string;
  offset_ms?: number | null;
  assigned_steam_id?: string | null;
  note?: string | null;
};

/**
 * One row of `utility_meta_lineups`: a cluster of grenades actually thrown in real
 * matches, not a saved lineup. It has no author and no id to open — it is only
 * ever a count and a representative pair of points.
 */
export type UtilityMetaLineup = {
  lineup_bucket: string;
  map_name: string;
  utility_type: UtilityType;
  side: UtilitySide | null;
  technique: UtilityTechnique | null;
  throw_strength: UtilityThrowStrength | null;
  throwers: number | null;
  throws: number | null;
  matches: number | null;
  /** How many saved lineups already sit in this cluster, counted server side. */
  lineups: number | null;
  origin_x: number | null;
  origin_y: number | null;
  origin_z: number | null;
  land_x: number | null;
  land_y: number | null;
  land_z: number | null;
  view_yaw: number | null;
  view_pitch: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  refreshed_at: string | null;
};

export type UtilityPracticeSession = {
  id: string;
  match_id: string | null;
  match: { server_id: string | null } | null;
  host_steam_id: string | null;
  host: { name: string | null } | null;
  team_id: string | null;
  map_name: string;
  // Set while the server is loading map_name. Until it clears, map_name is
  // where the server is going rather than where it is.
  map_changing_at: string | null;
  region: string | null;
  collection_id: string | null;
  playbook_id: string | null;
  status: string | null;
  invite_code: string | null;
  is_open: boolean | null;
  /** Open | Friends | Invite | Private. Null on rows started before the column. */
  access: string | null;
  expires_at: string | null;
  failure_reason: string | null;
  connection_string: string | null;
  connection_link: string | null;
  is_member: boolean | null;
  can_view: boolean | null;
  can_manage: boolean | null;
};

/** What startUtilityPractice / joinUtilityPractice return. Keyed `id`. */
export type UtilityPracticeSessionOutput = {
  id: string;
  match_id?: string | null;
  status?: string | null;
  invite_code?: string | null;
};

/** What the practice UI consumes — no column names live past this point. */
export type UtilityPracticeView = {
  connectionString: string | null;
  connectionLink: string | null;
  failureReason: string | null;
  status: string | null;
  inviteCode: string | null;
  playbookId: string | null;
  mapName: string | null;
  /** True while the server is loading `mapName`; nothing may be sent into that. */
  switching: boolean;
  isMember: boolean;
  isOpen: boolean;
  /** Open | Friends | Invite | Private. Null on rows started before the column. */
  access: string | null;
  isLive: boolean;
  canManage: boolean;
  /** The match behind the session, for the pod log tail. */
  matchId: string | null;
  /** The box it is running on, for the RCON console. */
  serverId: string | null;
};

/**
 * loadUtilityPlaybookIntoSession is rejected on anything but a live session, and a
 * session is only usefully live once it has handed back somewhere to connect.
 *
 * The connect string is NOT on its own that signal. It is derived from the
 * match's server row, so it resolves the moment a server is assigned -- which
 * for an on-demand session is the instant the pod is scheduled, minutes before
 * cs2 is listening. `Ready` is the only honest answer: the API sets it when the
 * practice plugin asks for its roster, which cannot happen until the server is
 * actually up.
 */
function isLiveSession(
  status: string | null,
  connectionString: string | null,
) {
  return status === "Ready" && !!connectionString;
}

/**
 * The single place `utility_practice_sessions` column names are read. `started` is
 * the mutation's own output, which arrives before the subscription's first
 * payload — so the invite code renders immediately, and the row wins once it
 * lands.
 */
export function readUtilityPracticeSession(
  session: UtilityPracticeSession | null | undefined,
  started?: UtilityPracticeSessionOutput | null,
): UtilityPracticeView {
  // Read once and answered from once: `isLive` deciding on the row while
  // `status` answers from the merge is how the same object came to say Ready
  // and not-live at the same time.
  const status = session?.status ?? started?.status ?? null;
  const connectionString = session?.connection_string ?? null;

  return {
    connectionString,
    connectionLink: session?.connection_link ?? null,
    failureReason: session?.failure_reason ?? null,
    status,
    inviteCode: session?.invite_code ?? started?.invite_code ?? null,
    playbookId: session?.playbook_id ?? null,
    mapName: session?.map_name ?? null,
    switching: !!session?.map_changing_at,
    isMember: session?.is_member === true,
    isOpen: session?.is_open !== false,
    access: session?.access ?? null,
    isLive: isLiveSession(status, connectionString),
    canManage: session?.can_manage === true,
    matchId: session?.match_id ?? started?.match_id ?? null,
    serverId: session?.match?.server_id ?? null,
  };
}

/** One end of a drawn sightline, in raw CS2 source units. */
export type UtilitySightlinePoint = {
  x: number;
  y: number;
  z: number;
};

/** A sightline the user drew on the radar. `id` is client-side only. */
export type UtilitySightlinePair = {
  id: string;
  from: UtilitySightlinePoint;
  to: UtilitySightlinePoint;
};

/**
 * One `checkUtilitySightlines` result. `blocked_by` is the attribution and the
 * only honest way to read `blocked`: "world" means the map itself stops the
 * line and the smoke had nothing to do with it.
 */
export type UtilitySightlineResult = {
  index: number;
  blocked: boolean;
  blocked_by: string | null;
  depth: number;
  transmittance: number;
  world_blocked: boolean;
};

export type UtilitySightlineOutput = {
  threshold: number | null;
  degraded: boolean | null;
  message: string | null;
  results: UtilitySightlineResult[] | null;
};

/**
 * One `checkUtilityOneWay` result. `confidence` is graded on purpose — volumetric
 * lighting and target contrast are not modelled, so this is an indication and
 * the UI must never render it as a fact.
 */
export type UtilityOneWayResult = {
  index: number;
  one_way: boolean;
  favors: string | null;
  cause: string | null;
  confidence: string;
  contested: boolean;
};

export type UtilityOneWayOutput = {
  degraded: boolean | null;
  message: string | null;
  results: UtilityOneWayResult[] | null;
};

/**
 * One `analyseUtilityPlaybookCoverage` result. `by_step` names the step that
 * closes the line and is null when nothing does. `covered: false` is only an
 * open angle when the output as a whole is not degraded — see
 * readUtilityPlaybookCoverage in utilities/utilityDisplay.ts.
 */
export type UtilityPlaybookCoverageResult = {
  index: number;
  covered: boolean;
  by_step: number | null;
  depth: number | null;
  transmittance: number | null;
};

export type UtilityPlaybookCoverageOutput = {
  degraded: boolean | null;
  message: string | null;
  results: UtilityPlaybookCoverageResult[] | null;
};

/** One `findUtilityLineupsBlocking` hit: a lineup plus how well it closes the line. */
export type UtilityBlockingResult = {
  utility_lineup_id: string;
  depth: number;
  transmittance: number;
  blocked: boolean;
};

export type UtilityBlockingOutput = {
  degraded: boolean | null;
  message: string | null;
  results: UtilityBlockingResult[] | null;
};

/**
 * `degraded` is the whole difference between "nothing blocks this angle" and
 * "we could not check". An empty result set under a degraded answer is
 * unknown, and rendering it as a clean negative would be claiming something
 * the parser never said.
 */
export type UtilityAnalysisNotice = {
  degraded: boolean;
  message: string | null;
};

export function readUtilityAnalysisNotice(
  output:
    | { degraded?: boolean | null; message?: string | null }
    | null
    | undefined,
): UtilityAnalysisNotice {
  return {
    degraded: output?.degraded === true,
    message: output?.message ?? null,
  };
}

/**
 * `solveUtilityLineup` answers immediately: `accepted` only means the server took
 * the job. The solved lineup arrives later through normal ingest.
 */
export type UtilitySolveOutput = {
  accepted: boolean;
  status: string;
  message: string | null;
};

/**
 * Why a repair was refused. Four different sentences, and collapsing them into
 * "could not repair" throws away the only part a human can act on: run a scan,
 * give up on this lineup, or move to a session on the right map.
 */
export const UTILITY_REPAIR_REFUSALS = [
  "not_scanned",
  "not_moved",
  "seedless",
  "wrong_map",
] as const;

export type UtilityRepairRefusal = (typeof UTILITY_REPAIR_REFUSALS)[number];

export type UtilityRepairView = {
  accepted: boolean;
  /** The server's word, shown as it came when it is not one we have copy for. */
  status: string | null;
  refusal: UtilityRepairRefusal | null;
  message: string | null;
};

/**
 * The one place repair statuses are read. Statuses arrive PascalCase
 * (`NotScanned`), so they are split on the case boundary rather than matched
 * literally — a server that switches to snake_case does not silently turn every
 * refusal into "unknown".
 */
export function readUtilityRepairOutput(
  output: UtilitySolveOutput | null | undefined,
): UtilityRepairView {
  const status = output?.status ?? null;
  const token = (status ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s-]/g, "_");
  const refusal = (UTILITY_REPAIR_REFUSALS as readonly string[]).includes(token)
    ? (token as UtilityRepairRefusal)
    : null;
  return {
    accepted: output?.accepted === true,
    status,
    refusal,
    message: output?.message ?? null,
  };
}

/**
 * `analysed` is to these three outputs what `degraded` is to the sightline
 * checks: the difference between a measured zero and no measurement at all. A
 * report that was never analysed has no counts to render, only its message, and
 * every view below keeps the flag rather than folding it into the numbers.
 */
export type UtilityUtilityReportTypeRow = {
  utility_type: string;
  throws: number;
  matched: number;
  landed: number;
};

export type UtilityUtilityReportOutput = {
  analysed: boolean;
  message: string | null;
  /** The bucket radius the matcher used, in source units. */
  radius: number | null;
  throws: number;
  matched_lineups: number;
  matched_meta: number;
  landed: number;
  by_type: UtilityUtilityReportTypeRow[] | null;
};

export type UtilityUtilityReportTypeView = {
  utilityType: string;
  throws: number;
  matched: number;
  landed: number;
};

export type UtilityUtilityReportView = {
  analysed: boolean;
  message: string | null;
  radius: number | null;
  throws: number;
  matchedLineups: number;
  matchedMeta: number;
  landed: number;
  byType: UtilityUtilityReportTypeView[];
};

function utilityCount(value: number | null | undefined): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

export function readUtilityUtilityReport(
  output: UtilityUtilityReportOutput | null | undefined,
): UtilityUtilityReportView {
  return {
    analysed: output?.analysed === true,
    message: output?.message ?? null,
    radius:
      output?.radius != null && Number.isFinite(Number(output.radius))
        ? Number(output.radius)
        : null,
    throws: utilityCount(output?.throws),
    matchedLineups: utilityCount(output?.matched_lineups),
    matchedMeta: utilityCount(output?.matched_meta),
    landed: utilityCount(output?.landed),
    byType: (output?.by_type ?? [])
      .filter((row) => !!row?.utility_type)
      .map((row) => ({
        utilityType: row.utility_type,
        throws: utilityCount(row.throws),
        matched: utilityCount(row.matched),
        landed: utilityCount(row.landed),
      })),
  };
}

export type UtilityPracticePlanEntry = {
  utility_lineup_id: string;
  /** The server's ranking score. Shown as an order, never as a bare number. */
  priority: number;
  meta_throwers: number;
  attempts: number;
  successes: number;
  mastered: boolean;
  /** A machine token; utilities/utilityDisplay.ts owns the words for it. */
  reason: string;
  /** The same aggregate grade the lineup row carries. */
  difficulty?: string | null;
  /** How everyone else does on it — the other half of `attempts`/`successes`. */
  global_players?: number | null;
  global_attempts?: number | null;
  /**
   * A 0-1 fraction — 0.8 is four throws in five. Null whenever the grade is
   * `unmeasured`: too few throws to divide by.
   */
  global_landing_rate?: number | null;
};

export type UtilityPracticePlanOutput = {
  analysed: boolean;
  message: string | null;
  entries: UtilityPracticePlanEntry[] | null;
};

export type UtilityPracticePlanEntryView = {
  lineupId: string;
  priority: number;
  metaThrowers: number;
  attempts: number;
  successes: number;
  mastered: boolean;
  reason: string;
  /** Null when nothing has been thrown at it: 0% would claim a failed drill. */
  hitRate: number | null;
  difficulty: string | null;
  globalPlayers: number | null;
  globalAttempts: number | null;
  /** 0-100, and null when the grade is unmeasured. */
  globalLandingRate: number | null;
};

/** The three orders the plan will rank by. An unknown one is rejected server
 * side rather than quietly ignored, so only these may ever be sent. */
export const UTILITY_PLAN_ORDERS = ["priority", "quick_wins", "projects"] as const;

export type UtilityPlanOrder = (typeof UTILITY_PLAN_ORDERS)[number];

export type UtilityPracticePlanView = {
  analysed: boolean;
  message: string | null;
  entries: UtilityPracticePlanEntryView[];
};

/**
 * The rate is a 0-1 fraction and is scaled unconditionally. Deliberately no
 * "looks like a percentage already" branch: a tolerant reader would keep
 * rendering plausible-but-wrong numbers if the API ever switched units, where
 * this one goes visibly wrong the moment it does.
 */
function utilityPercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(Number(value))) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(Number(value) * 100)));
}

export function readUtilityPracticePlan(
  output: UtilityPracticePlanOutput | null | undefined,
): UtilityPracticePlanView {
  const entries: UtilityPracticePlanEntryView[] = [];
  for (const row of output?.entries ?? []) {
    if (!row?.utility_lineup_id) {
      continue;
    }
    const attempts = utilityCount(row.attempts);
    const successes = utilityCount(row.successes);
    entries.push({
      lineupId: row.utility_lineup_id,
      priority: Number(row.priority ?? 0),
      metaThrowers: utilityCount(row.meta_throwers),
      attempts,
      successes,
      mastered: row.mastered === true,
      reason: String(row.reason ?? "")
        .trim()
        .toLowerCase(),
      hitRate: attempts > 0 ? Math.round((successes / attempts) * 100) : null,
      difficulty: row.difficulty ?? null,
      globalPlayers: row.global_players == null ? null : utilityCount(row.global_players),
      globalAttempts:
        row.global_attempts == null ? null : utilityCount(row.global_attempts),
      globalLandingRate: utilityPercent(row.global_landing_rate),
    });
  }
  return {
    analysed: output?.analysed === true,
    message: output?.message ?? null,
    entries,
  };
}

export type UtilityTeamUtilityEntry = {
  utility_lineup_id: string;
  thrown: number;
  landed: number;
  /** Distinct roster members whose throws matched this lineup's bucket. */
  players: number;
};

export type UtilityTeamUtilityOutput = {
  analysed: boolean;
  message: string | null;
  entries: UtilityTeamUtilityEntry[] | null;
};

export type UtilityTeamUtilityEntryView = {
  lineupId: string;
  thrown: number;
  landed: number;
  players: number;
  /** Null with nothing thrown — a rate needs a denominator. */
  landRate: number | null;
};

export type UtilityTeamUtilityView = {
  analysed: boolean;
  message: string | null;
  entries: UtilityTeamUtilityEntryView[];
};

export function readUtilityTeamUtility(
  output: UtilityTeamUtilityOutput | null | undefined,
): UtilityTeamUtilityView {
  const entries: UtilityTeamUtilityEntryView[] = [];
  for (const row of output?.entries ?? []) {
    if (!row?.utility_lineup_id) {
      continue;
    }
    const thrown = utilityCount(row.thrown);
    const landed = utilityCount(row.landed);
    entries.push({
      lineupId: row.utility_lineup_id,
      thrown,
      landed,
      players: utilityCount(row.players),
      landRate: thrown > 0 ? Math.round((landed / thrown) * 100) : null,
    });
  }
  return {
    analysed: output?.analysed === true,
    message: output?.message ?? null,
    entries,
  };
}

/**
 * One rejected payload entry. `index` is its position in the submitted array,
 * which is the only way back to it in a payload of thousands — a reason on its
 * own names a problem nobody can find.
 */
export type UtilityImportError = {
  index: number;
  external_id: string | null;
  reason: string;
};

export type UtilityImportOutput = {
  dry_run: boolean;
  total: number;
  imported: number;
  updated: number;
  failed: number;
  errors: UtilityImportError[] | null;
};

export type UtilityImportErrorView = {
  index: number;
  externalId: string | null;
  reason: string;
};

export type UtilityImportView = {
  /** The server's own echo, not what the button asked for. */
  dryRun: boolean;
  total: number;
  imported: number;
  updated: number;
  failed: number;
  errors: UtilityImportErrorView[];
  /**
   * The error list is capped server side, so `failed` can outrun what arrived.
   * Showing 200 rows against a count of 900 without saying so reads as a
   * complete list of what went wrong.
   */
  errorsTruncated: boolean;
  /** The payload described nothing at all — not a success and not a failure. */
  empty: boolean;
};

/** What one call may carry; a bigger payload has to be split. */
export const UTILITY_IMPORT_MAX_ENTRIES = 5000;

export function readUtilityImportOutput(
  output: UtilityImportOutput | null | undefined,
): UtilityImportView {
  const failed = utilityCount(output?.failed);
  const errors: UtilityImportErrorView[] = [];
  for (const row of output?.errors ?? []) {
    if (!row?.reason) {
      continue;
    }
    errors.push({
      index: utilityCount(row.index),
      externalId: row.external_id ?? null,
      reason: row.reason,
    });
  }
  const total = utilityCount(output?.total);
  return {
    dryRun: output?.dry_run === true,
    total,
    imported: utilityCount(output?.imported),
    updated: utilityCount(output?.updated),
    failed,
    errors,
    errorsTruncated: failed > errors.length,
    empty: total === 0,
  };
}

/**
 * `purgeUtilityLineupSource` names the source it is about to delete rather than
 * assuming one, and answers the same shape either way — so a dry run is a real
 * preview of the damage and every caller should take one before the confirm.
 */
export type UtilityPurgeOutput = {
  dry_run: boolean;
  origin_source: string;
  lineups: number;
};

export type UtilityPurgeView = {
  dryRun: boolean;
  originSource: string;
  lineups: number;
};

export function readUtilityPurgeOutput(
  output: UtilityPurgeOutput | null | undefined,
): UtilityPurgeView {
  return {
    dryRun: output?.dry_run === true,
    originSource: output?.origin_source ?? "",
    lineups: utilityCount(output?.lineups),
  };
}

export type UtilityCalibrationOutput = {
  status: string;
  ready: boolean;
  detail: string | null;
};

export type UtilityDriftScanOutput = {
  scan_id: string;
  lineups: number;
};

export type UtilityCalibrationState =
  | "ready"
  | "no_sample"
  | "unsupported"
  | "unknown";

export type UtilityCalibrationView = {
  ready: boolean;
  state: UtilityCalibrationState;
  status: string | null;
  detail: string | null;
  /** NoSample fixes itself on the next throw; Unsupported never will. */
  selfHealing: boolean;
};

/**
 * The one place solver-calibration statuses are read. `NoSample` and
 * `Unsupported` are completely different answers — one is "throw a utility", the
 * other is "this server's runtime cannot do it" — so they are separated here
 * rather than collapsed into "not ready".
 */
export function readUtilitySolverCalibration(
  output: UtilityCalibrationOutput | null | undefined,
): UtilityCalibrationView {
  const status = output?.status ?? null;
  const token = (status ?? "").trim().toLowerCase().replace(/[\s-]/g, "_");
  let state: UtilityCalibrationState = "unknown";
  if (output?.ready) {
    state = "ready";
  } else if (token === "nosample" || token === "no_sample") {
    state = "no_sample";
  } else if (token === "unsupported") {
    state = "unsupported";
  }
  return {
    ready: output?.ready === true,
    state,
    status,
    detail: output?.detail ?? null,
    selfHealing: state === "no_sample",
  };
}

/**
 * PROVISIONAL SHAPE. `utility_drift_scans` / `utility_drift_results` are being
 * created alongside this UI and only their meaning is settled, not the exact
 * spelling of every column. Column names appear in exactly two places — the
 * field sets in graphql/utilityGraphql.ts and the mappers below — so a rename is
 * a two-file edit rather than a hunt.
 */
export type UtilityDriftScan = {
  id: string;
  map_name: string;
  status: string | null;
  failure_reason: string | null;
  from_revision: string | null;
  to_revision: string | null;
  /** How many lineups the scan took on, and how many it has got through. */
  lineups: number | null;
  scanned: number | null;
  unchanged: number | null;
  moved: number | null;
  broken: number | null;
  unsimulatable: number | null;
  max_distance: number | null;
  requested_by_steam_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type UtilityDriftResult = {
  /** No surrogate key: a row is the (scan, lineup) pair. */
  utility_drift_scan_id: string;
  utility_lineup_id: string;
  verdict: string | null;
  severity: string | null;
  /**
   * Absent — not zero — whenever either side failed to resolve. The gap between
   * a landing and a flight that fell out of the world is not a distance, so
   * there is nothing to render when this is null.
   */
  distance: number | null;
  distance_xy: number | null;
  distance_z: number | null;
  reason: string | null;
};

export type UtilityDriftScanView = {
  id: string;
  mapName: string;
  status: string | null;
  failureReason: string | null;
  fromRevision: string | null;
  toRevision: string | null;
  lineups: number | null;
  scanned: number | null;
  /** The scan's own tallies — right even when the page loads a capped slice. */
  unchanged: number | null;
  moved: number | null;
  broken: number | null;
  unsimulatable: number | null;
  maxDistance: number | null;
  requestedBySteamId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string | null;
  /** Started and not finished. Status wording is the server's, this is not. */
  running: boolean;
  /** Null rather than 0 when there is nothing to divide by. */
  progressPercent: number | null;
  durationSeconds: number | null;
};

export type UtilityDriftResultView = {
  /** Synthesised from the pair, because the row has no key of its own. */
  key: string;
  scanId: string;
  lineupId: string;
  /** Lowercased for matching; `verdictRaw` is what gets shown if unrecognised. */
  verdict: string;
  verdictRaw: string | null;
  /** `minor` or `major` — a word from the parser, never a number. */
  severity: string | null;
  /** How far the simulated end point moved. Null means unmeasured, not zero. */
  distance: number | null;
  distanceXy: number | null;
  distanceZ: number | null;
  /** Lowercased; for `broken` it is one of the parser's fixed reasons. */
  reason: string | null;
  broken: boolean;
  /**
   * Either there was no physics seed to replay, or the flight failed on both
   * meshes — which says nothing about the map. A real answer, not a failed row.
   */
  unsimulatable: boolean;
};

function driftNumber(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(Number(value)) ? Number(value) : null;
}

export function readUtilityDriftScan(row: UtilityDriftScan): UtilityDriftScanView {
  const lineups = driftNumber(row.lineups);
  const scanned = driftNumber(row.scanned);
  const startedAt = row.started_at ?? null;
  const finishedAt = row.finished_at ?? null;
  const started = startedAt ? Date.parse(startedAt) : NaN;
  const finished = finishedAt ? Date.parse(finishedAt) : NaN;
  return {
    id: row.id,
    mapName: row.map_name,
    status: row.status ?? null,
    failureReason: row.failure_reason ?? null,
    fromRevision: row.from_revision ?? null,
    toRevision: row.to_revision ?? null,
    lineups,
    scanned,
    unchanged: driftNumber(row.unchanged),
    moved: driftNumber(row.moved),
    broken: driftNumber(row.broken),
    unsimulatable: driftNumber(row.unsimulatable),
    maxDistance: driftNumber(row.max_distance),
    requestedBySteamId: row.requested_by_steam_id ?? null,
    startedAt,
    finishedAt,
    createdAt: row.created_at ?? null,
    running: !!startedAt && !finishedAt,
    progressPercent:
      lineups && lineups > 0 && scanned != null
        ? Math.min(100, Math.round((scanned / lineups) * 100))
        : null,
    durationSeconds:
      Number.isFinite(started) && Number.isFinite(finished)
        ? Math.max(0, Math.round((finished - started) / 1000))
        : null,
  };
}

/**
 * Deliberately drops `comparison_point`: the simulated position is meaningful
 * only as a difference against the other revision, and showing it as a
 * coordinate would read as "this is where the utility lands", which it is not.
 */
export function readUtilityDriftResult(row: UtilityDriftResult): UtilityDriftResultView {
  const verdict = String(row.verdict ?? "")
    .trim()
    .toLowerCase();
  return {
    key: `${row.utility_drift_scan_id}:${row.utility_lineup_id}`,
    scanId: row.utility_drift_scan_id,
    lineupId: row.utility_lineup_id,
    verdict,
    verdictRaw: row.verdict ?? null,
    severity: row.severity ? String(row.severity).trim().toLowerCase() : null,
    distance: driftNumber(row.distance),
    distanceXy: driftNumber(row.distance_xy),
    distanceZ: driftNumber(row.distance_z),
    reason: row.reason ? String(row.reason).trim().toLowerCase() : null,
    broken: verdict === "broken",
    unsimulatable: verdict === "unsimulatable",
  };
}

/**
 * What `saveUtilityLineupFromDemo` and `saveUtilityLineupFromPractice` hand back. One
 * key, the new lineup's pk — which is the only thing either caller needs, since
 * the lineup itself is read from the library afterwards.
 */
export type UtilityLineupOutput = {
  id: string;
};

/**
 * How a lineup gets missed, aggregated over every recorded practice throw at
 * it. `analysed` carries the same rule as the plan and the utility report:
 * false is "below the sample floor", which is a different sentence from
 * "nobody misses it". Under it `bias` and all three means come back null —
 * `samples` does not, so the panel can still say how far off the floor it is
 * instead of showing an empty box.
 *
 * `bias` is the verdict and the only one there is. The means are the evidence
 * behind it, and the threshold that turns them into a bias lives on the server
 * with the success radius it is measured against.
 */
export type UtilityMissPatternOutput = {
  analysed: boolean;
  message: string | null;
  samples: number;
  players: number;
  /** Signed offsets in source units, relative to the throw direction. */
  mean_along: number | null;
  mean_lateral: number | null;
  mean_vertical: number | null;
  /** A machine token; utilities/utilityDisplay.ts owns the words for it. */
  bias: string | null;
};

export type UtilityMissPatternView = {
  analysed: boolean;
  message: string | null;
  samples: number;
  players: number;
  meanAlong: number | null;
  meanLateral: number | null;
  meanVertical: number | null;
  bias: string | null;
  /**
   * One player's throws are that player's habit, not the lineup's. The panel
   * says so rather than dressing a single drill session up as "most players".
   */
  singlePlayer: boolean;
};

/** Null, not zero: an axis the aggregate did not measure has no offset. */
function utilitySigned(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(Number(value)) ? Number(value) : null;
}

export function readUtilityMissPattern(
  output: UtilityMissPatternOutput | null | undefined,
): UtilityMissPatternView {
  const players = utilityCount(output?.players);
  return {
    analysed: output?.analysed === true,
    message: output?.message ?? null,
    samples: utilityCount(output?.samples),
    players,
    meanAlong: utilitySigned(output?.mean_along),
    meanLateral: utilitySigned(output?.mean_lateral),
    meanVertical: utilitySigned(output?.mean_vertical),
    bias: output?.bias ?? null,
    singlePlayer: players === 1,
  };
}
