import type {
  UtilityLineup,
  UtilityLineupProgress,
  UtilityMetaLineup,
  UtilityDriftResultView,
  UtilityPlaybookCoverageResult,
  UtilitySide,
  UtilitySightlineResult,
  UtilityTechnique,
  UtilityThrowStrength,
  UtilityTrajectoryPoint,
  UtilityType,
} from "~/types/utility";

export type UtilityScope = "public" | "mine" | "team" | "favorites";

export type UtilitySort = "top" | "new";

export type UtilityFilterState = {
  scope: UtilityScope;
  types: UtilityType[];
  sides: UtilitySide[];
  techniques: UtilityTechnique[];
  strengths: UtilityThrowStrength[];
  tags: string[];
  sort: UtilitySort;
  search: string;
};

export function emptyUtilityFilters(): UtilityFilterState {
  return {
    scope: "public",
    types: [],
    sides: [],
    techniques: [],
    strengths: [],
    tags: [],
    sort: "top",
    search: "",
  };
}

export const UTILITY_TYPES: UtilityType[] = [
  "Smoke",
  "Flash",
  "Molotov",
  "HighExplosive",
  "Decoy",
];

export const UTILITY_SIDES: UtilitySide[] = ["CT", "TERRORIST"];

export const UTILITY_TECHNIQUES: UtilityTechnique[] = [
  "Stationary",
  "Walking",
  "Running",
  "Crouch",
  "Jump",
  "RunJump",
  "WalkJump",
  "CrouchJump",
];

export const UTILITY_THROW_STRENGTHS: UtilityThrowStrength[] = [
  "Full",
  "Half",
  "Drop",
];

// Same hexes Replay3DLite paints utility with, so a lineup reads identically on
// the board, in the list and in the 3D scene.
export const UTILITY_TYPE_COLORS: Record<UtilityType, string> = {
  Smoke: "#32d6e0",
  Molotov: "#ff6a1a",
  HighExplosive: "#ff3b3b",
  Flash: "#ffd21a",
  Decoy: "#66dd55",
};

// The replay renderer keys its colours and filters off the demo's short name.
export function replayUtilityType(type: UtilityType): string {
  return type === "HighExplosive" ? "HE" : type;
}

export function replayTeamForSide(side: UtilitySide): "ct" | "t" {
  return side === "CT" ? "ct" : "t";
}

/**
 * `trajectory_preview` ships as quantized `[x, y, z]` tuples, but the full
 * trajectory file is written as objects. Both land here as one shape.
 */
export function normalizeTrajectory(raw: unknown): UtilityTrajectoryPoint[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const points: UtilityTrajectoryPoint[] = [];
  for (const entry of raw) {
    if (Array.isArray(entry)) {
      const [x, y, z, t] = entry as number[];
      if (Number.isFinite(x) && Number.isFinite(y)) {
        points.push({ x, y, z: Number.isFinite(z) ? z : 0, t });
      }
      continue;
    }
    if (entry && typeof entry === "object") {
      const p = entry as Record<string, unknown>;
      const x = Number(p.x);
      const y = Number(p.y);
      const z = Number(p.z);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        points.push({
          x,
          y,
          z: Number.isFinite(z) ? z : 0,
          t: Number.isFinite(Number(p.t)) ? Number(p.t) : undefined,
        });
      }
    }
  }
  return points;
}

/**
 * Where the utility ends up. Prefers the recorded landing, falls back to the last
 * preview point so a lineup saved before landing was captured still draws.
 */
export function utilityLanding(
  lineup: Pick<
    UtilityLineup,
    "land_x" | "land_y" | "land_z" | "trajectory_preview"
  >,
): UtilityTrajectoryPoint | null {
  if (lineup.land_x != null && lineup.land_y != null) {
    return { x: lineup.land_x, y: lineup.land_y, z: lineup.land_z ?? 0 };
  }
  const preview = normalizeTrajectory(lineup.trajectory_preview);
  return preview.length > 0 ? preview[preview.length - 1] : null;
}

export function utilityOrigin(
  lineup: Pick<UtilityLineup, "origin_x" | "origin_y" | "origin_z" | "eye_z">,
): UtilityTrajectoryPoint {
  return {
    x: lineup.origin_x,
    y: lineup.origin_y,
    z: lineup.eye_z ?? lineup.origin_z,
  };
}

/** Five consecutive successes inside `public.utility_success_radius`. */
export const UTILITY_MASTERY_STREAK = 5;

export const UTILITY_PLAYBOOK_MAX_STEPS = 32;

export const UTILITY_PLAYBOOK_MAX_OFFSET_MS = 600000;

/**
 * A mined lineup's aim comes out of the flight path, which lands within about a
 * degree or two. Past this the reconstruction and the demo's own view angles
 * genuinely disagree and the lineup has to be walked in a practice server.
 */
export const UTILITY_AIM_DELTA_WARN_DEGREES = 3;

export type UtilityJumpBindState = "yes" | "no" | "unknown";

/**
 * A demo never records whether a bind was used, so a mined lineup's `false` is
 * an absence of evidence. Rendering it as "no" would be inventing a fact.
 */
export function jumpThrowBindState(
  lineup: Pick<UtilityLineup, "jump_throw_bind" | "origin_source">,
): UtilityJumpBindState {
  if (lineup.jump_throw_bind) {
    return "yes";
  }
  return lineup.origin_source === "demo" ? "unknown" : "no";
}

/** The worse of the two axes, which is what decides whether we warn. */
export function utilityAimDelta(
  lineup: Pick<UtilityLineup, "view_yaw_delta" | "view_pitch_delta">,
): number | null {
  if (lineup.view_yaw_delta == null && lineup.view_pitch_delta == null) {
    return null;
  }
  const yaw = Math.abs(Number(lineup.view_yaw_delta ?? 0));
  const pitch = Math.abs(Number(lineup.view_pitch_delta ?? 0));
  return Math.max(
    Number.isFinite(yaw) ? yaw : 0,
    Number.isFinite(pitch) ? pitch : 0,
  );
}

export function myUtilityProgress(
  progress: UtilityLineupProgress[] | null | undefined,
  steamId: string | null | undefined,
): UtilityLineupProgress | null {
  if (!steamId) {
    return null;
  }
  return (progress ?? []).find((row) => row.steam_id === steamId) ?? null;
}

/** Offsets are authored in seconds and stored in milliseconds. */
export function formatUtilityOffset(ms: number | null | undefined): string {
  const value = Number(ms ?? 0);
  if (!Number.isFinite(value) || value <= 0) {
    return "0.0";
  }
  return (value / 1000).toFixed(1);
}

export function parseUtilityOffset(input: string | number): number {
  const seconds = Number(input);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return Math.min(Math.round(seconds * 1000), UTILITY_PLAYBOOK_MAX_OFFSET_MS);
}

/**
 * The side of the origin/landing cubes `utility_meta_lineups` clusters on. The
 * median point of a bucket stays inside it, so two throws inside one bucket
 * are never further apart than this on any axis.
 */
export const UTILITY_META_BUCKET_UNITS = 64;

/** A mined cluster reduced to what the board, the cards and the browser draw. */
export type UtilityMetaSpot = {
  key: string;
  utilityType: UtilityType;
  side: UtilitySide | null;
  technique: UtilityTechnique | null;
  throwStrength: UtilityThrowStrength | null;
  /** Distinct players — the only one of the three that means "popular". */
  throwers: number;
  throws: number;
  matches: number;
  /** Saved lineups already in this cluster, counted by the API. */
  lineups: number;
  viewYaw: number | null;
  viewPitch: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  refreshedAt: string | null;
  origin: UtilityTrajectoryPoint;
  landing: UtilityTrajectoryPoint | null;
};

/** The one place `utility_meta_lineups` column names are read. */
export function toUtilityMetaSpots(
  rows: UtilityMetaLineup[] | null | undefined,
): UtilityMetaSpot[] {
  const spots: UtilityMetaSpot[] = [];
  for (const row of rows ?? []) {
    const x = Number(row.origin_x);
    const y = Number(row.origin_y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    const landX = Number(row.land_x);
    const landY = Number(row.land_y);
    spots.push({
      key: row.lineup_bucket,
      utilityType: row.utility_type,
      side: row.side ?? null,
      technique: row.technique ?? null,
      throwStrength: row.throw_strength ?? null,
      throwers: Number(row.throwers ?? 0),
      throws: Number(row.throws ?? 0),
      matches: Number(row.matches ?? 0),
      lineups: Number(row.lineups ?? 0),
      viewYaw: row.view_yaw == null ? null : Number(row.view_yaw),
      viewPitch: row.view_pitch == null ? null : Number(row.view_pitch),
      firstSeenAt: row.first_seen_at ?? null,
      lastSeenAt: row.last_seen_at ?? null,
      refreshedAt: row.refreshed_at ?? null,
      origin: { x, y, z: Number(row.origin_z ?? 0) || 0 },
      landing:
        Number.isFinite(landX) && Number.isFinite(landY)
          ? { x: landX, y: landY, z: Number(row.land_z ?? 0) || 0 }
          : null,
    });
  }
  return spots.sort((a, b) => b.throwers - a.throwers);
}

function axisWithin(a: number, b: number, limit: number) {
  return Math.abs(a - b) <= limit;
}

/**
 * Which cluster a saved lineup belongs to. Matched by proximity rather than by
 * rebuilding `lineup_bucket`: the key's exact text is the API's business, but
 * two throws in one bucket can never be more than a bucket apart, so "within
 * one bucket on every axis" finds the same cluster without depending on how the
 * key is spelled. Height is checked twice as loosely, only to keep Nuke's two
 * levels from collapsing into one spot.
 *
 * This identifies rows; it does not count them. `utility_meta_lineups.lineups` is
 * the server's own count of the saved lineups in a cluster and always wins as
 * the number — this matcher can only see the page of lineups already fetched.
 */
export function matchUtilityMetaSpot(
  lineup: Pick<
    UtilityLineup,
    | "utility_type"
    | "origin_x"
    | "origin_y"
    | "origin_z"
    | "eye_z"
    | "land_x"
    | "land_y"
    | "land_z"
    | "trajectory_preview"
  >,
  spots: UtilityMetaSpot[],
): UtilityMetaSpot | null {
  const origin = utilityOrigin(lineup as UtilityLineup);
  const landing = utilityLanding(lineup as UtilityLineup);
  let best: UtilityMetaSpot | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const spot of spots) {
    if (spot.utilityType !== lineup.utility_type) {
      continue;
    }
    if (
      !axisWithin(spot.origin.x, origin.x, UTILITY_META_BUCKET_UNITS) ||
      !axisWithin(spot.origin.y, origin.y, UTILITY_META_BUCKET_UNITS) ||
      !axisWithin(spot.origin.z ?? 0, origin.z ?? 0, UTILITY_META_BUCKET_UNITS * 2)
    ) {
      continue;
    }
    if (spot.landing && landing) {
      if (
        !axisWithin(spot.landing.x, landing.x, UTILITY_META_BUCKET_UNITS) ||
        !axisWithin(spot.landing.y, landing.y, UTILITY_META_BUCKET_UNITS)
      ) {
        continue;
      }
    }
    const distance =
      Math.abs(spot.origin.x - origin.x) +
      Math.abs(spot.origin.y - origin.y) +
      (spot.landing && landing
        ? Math.abs(spot.landing.x - landing.x) +
          Math.abs(spot.landing.y - landing.y)
        : 0);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = spot;
    }
  }
  return best;
}

/**
 * The one place a browse filter becomes a Hasura `where`. `can_view` is a
 * STABLE scalar computed field, so it is filterable — same precedent as
 * public_events.yaml. Row permissions enforce it anyway; stating it keeps the
 * query honest about what it is asking for.
 */
export function utilityLineupWhere(
  state: UtilityFilterState,
  context: {
    mapName: string;
    mySteamId?: string | null;
    myTeamIds?: string[];
  },
): Record<string, any> {
  const clause: Record<string, any> = {
    map_name: { _eq: context.mapName },
    can_view: { _eq: true },
  };
  if (state.types.length) {
    clause.utility_type = { _in: state.types };
  }
  if (state.sides.length) {
    clause.side = { _in: state.sides };
  }
  if (state.techniques.length) {
    clause.technique = { _in: state.techniques };
  }
  if (state.strengths.length) {
    clause.throw_strength = { _in: state.strengths };
  }
  // _contains on a text[] is "does the array contain every given value", so a
  // multi-tag pick narrows rather than widens.
  if (state.tags.length) {
    clause.tags = { _contains: state.tags };
  }
  if (state.search) {
    clause._or = [
      { name: { _ilike: `%${state.search}%` } },
      { description: { _ilike: `%${state.search}%` } },
    ];
  }
  if (state.scope === "mine" && context.mySteamId) {
    clause.author_steam_id = { _eq: context.mySteamId };
  } else if (state.scope === "team" && context.myTeamIds?.length) {
    clause.team_id = { _in: context.myTeamIds };
  } else if (state.scope === "favorites") {
    clause.is_favorited = { _eq: true };
  } else if (state.scope === "public") {
    clause.visibility = { _eq: "Public" };
  }
  return clause;
}

/** A point the board draws on top of everything else. */
export type UtilityBoardMarker = {
  key: string;
  point: UtilityTrajectoryPoint;
  color?: string;
  label?: string;
  shape?: "dot" | "cross";
};

/** A line the board draws on top of everything else. */
export type UtilityBoardSegment = {
  key: string;
  from: UtilityTrajectoryPoint;
  to: UtilityTrajectoryPoint;
  color?: string;
  label?: string;
  dashed?: boolean;
};

export const UTILITY_SIGHTLINE_MAX_PAIRS = 6;

/** Eye height above a player's feet, for turning a picked radar point into a ray. */
export const UTILITY_EYE_HEIGHT_UNITS = 64;

/**
 * How a sightline reads to a human. `world` is the important one: the map
 * already stops the line, so whatever the smoke does is beside the point and
 * calling it "blocked" would credit the lineup with the map's geometry.
 */
export type UtilitySightlineVerdict = "world" | "blocked" | "grazing" | "clear";

/** Above this much light getting through, a line is clear rather than grazed. */
export const UTILITY_SIGHTLINE_GRAZE_TRANSMITTANCE = 0.9;

export type UtilitySightlineView = {
  verdict: UtilitySightlineVerdict;
  /** How much of the line survives the smoke, 0-100. */
  visiblePercent: number;
  /** Units of smoke the ray passes through. */
  depth: number;
  blockedBy: string | null;
};

export function readUtilitySightlineResult(
  result: Pick<
    UtilitySightlineResult,
    "blocked" | "blocked_by" | "depth" | "transmittance" | "world_blocked"
  >,
): UtilitySightlineView {
  const depth = Number.isFinite(Number(result.depth))
    ? Number(result.depth)
    : 0;
  const transmittance = Number.isFinite(Number(result.transmittance))
    ? Number(result.transmittance)
    : 1;
  const blockedBy = (result.blocked_by ?? "").trim().toLowerCase() || null;
  let verdict: UtilitySightlineVerdict = "clear";
  if (result.world_blocked || blockedBy === "world") {
    verdict = "world";
  } else if (result.blocked) {
    verdict = "blocked";
  } else if (depth > 0 || transmittance < UTILITY_SIGHTLINE_GRAZE_TRANSMITTANCE) {
    verdict = "grazing";
  }
  return {
    verdict,
    visiblePercent: Math.max(0, Math.min(100, Math.round(transmittance * 100))),
    depth: Math.round(depth),
    blockedBy,
  };
}

export const UTILITY_SIGHTLINE_TONES: Record<UtilitySightlineVerdict, string> = {
  world: "border-border bg-muted/40 text-muted-foreground",
  blocked: "border-success/40 bg-success/10 text-success",
  grazing:
    "border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]",
  clear: "border-destructive/40 bg-destructive/10 text-destructive",
};

/** Board colours for a drawn sightline, keyed the same way as the chips. */
export const UTILITY_SIGHTLINE_COLORS: Record<UtilitySightlineVerdict, string> = {
  world: "#8b93a5",
  blocked: "#3ddc84",
  grazing: "#ffb020",
  clear: "#ff3b3b",
};

export const UTILITY_SIGHTLINE_UNCHECKED_COLOR = "#e6ebf5";

/**
 * A playbook's answer for one drawn line. `unknown` exists because the other
 * two are both claims: "the execute closes this" and "the execute leaves this
 * open" are things we only get to say when the parser answered.
 */
export type UtilityCoverageVerdict = "covered" | "open" | "unknown";

export type UtilityCoverageView = {
  verdict: UtilityCoverageVerdict;
  /** The step that closes the line, or null when nothing does. */
  byStep: number | null;
  depth: number | null;
  /** How much of the line survives the execute's utility, 0-100. */
  visiblePercent: number | null;
};

/**
 * The one place a coverage result becomes a verdict, and the one place the
 * degraded rule lives: under a degraded answer nothing may read as open. A
 * missing result is unknown either way, and `covered: true` survives a degraded
 * run because a positive is a claim the parser did make — telling a team an
 * angle is open when the check never completed is the failure this must never
 * produce.
 */
export function readUtilityPlaybookCoverage(
  result:
    | Pick<
        UtilityPlaybookCoverageResult,
        "covered" | "by_step" | "depth" | "transmittance"
      >
    | null
    | undefined,
  degraded: boolean,
): UtilityCoverageView {
  if (!result) {
    return {
      verdict: "unknown",
      byStep: null,
      depth: null,
      visiblePercent: null,
    };
  }
  const depth = Number.isFinite(Number(result.depth))
    ? Number(result.depth)
    : null;
  const transmittance = Number.isFinite(Number(result.transmittance))
    ? Number(result.transmittance)
    : null;
  let verdict: UtilityCoverageVerdict = result.covered ? "covered" : "open";
  if (verdict === "open" && degraded) {
    verdict = "unknown";
  }
  return {
    verdict,
    byStep:
      result.by_step != null && Number.isFinite(Number(result.by_step))
        ? Number(result.by_step)
        : null,
    depth: depth === null ? null : Math.round(depth),
    visiblePercent:
      transmittance === null
        ? null
        : Math.max(0, Math.min(100, Math.round(transmittance * 100))),
  };
}

export const UTILITY_COVERAGE_TONES: Record<UtilityCoverageVerdict, string> = {
  covered: "border-success/40 bg-success/10 text-success",
  open: "border-destructive/40 bg-destructive/10 text-destructive",
  unknown: "border-border bg-muted/40 text-muted-foreground",
};

export const UTILITY_COVERAGE_COLORS: Record<UtilityCoverageVerdict, string> = {
  covered: "#3ddc84",
  open: "#ff3b3b",
  unknown: "#8b93a5",
};

/** Weakest to strongest, exactly as the backend grades it. */
export const UTILITY_ONE_WAY_CONFIDENCES = [
  "none",
  "marginal",
  "likely",
  "strong",
] as const;

export type UtilityOneWayConfidence = (typeof UTILITY_ONE_WAY_CONFIDENCES)[number];

export function utilityOneWayConfidence(raw: string | null | undefined) {
  const token = String(raw ?? "")
    .trim()
    .toLowerCase();
  return (UTILITY_ONE_WAY_CONFIDENCES as readonly string[]).includes(token)
    ? (token as UtilityOneWayConfidence)
    : null;
}

export const UTILITY_ONE_WAY_TONES: Record<UtilityOneWayConfidence, string> = {
  none: "border-border bg-muted/40 text-muted-foreground",
  marginal: "border-border bg-muted/40 text-muted-foreground",
  likely:
    "border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]",
  strong:
    "border-[hsl(var(--tac-amber)/0.7)] bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]",
};

/** `favors` values the UI has words for; anything else is shown as it came. */
const UTILITY_ONE_WAY_FAVORS = ["from", "to", "attacker", "defender", "ct", "t"];

export function utilityOneWayFavorsKey(raw: string | null | undefined) {
  const token = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (token === "terrorist") {
    return "t";
  }
  return UTILITY_ONE_WAY_FAVORS.includes(token) ? token : null;
}

/**
 * Renders an unrecognised server token without inventing a meaning for it:
 * `smoke_edge` becomes `Smoke edge` and nothing more is claimed about it.
 */
export function humanizeUtilityToken(raw: string | null | undefined): string {
  const token = String(raw ?? "")
    .trim()
    .replace(/[_-]+/g, " ");
  if (!token) {
    return "";
  }
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/**
 * The parser's vocabulary. An unknown value still renders, humanized, and is
 * still filterable — but these are the four it actually emits.
 */
export const UTILITY_DRIFT_VERDICTS = [
  "unchanged",
  "moved",
  "broken",
  "unsimulatable",
] as const;

export function utilityDriftVerdictKey(verdict: string | null | undefined) {
  const token = String(verdict ?? "")
    .trim()
    .toLowerCase();
  return (UTILITY_DRIFT_VERDICTS as readonly string[]).includes(token)
    ? token
    : null;
}

export function utilityDriftVerdictTone(verdict: string | null | undefined) {
  switch (utilityDriftVerdictKey(verdict)) {
    case "unchanged":
      return "border-success/40 bg-success/10 text-success";
    case "moved":
      return "border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]";
    case "broken":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

/** Severity is a word — `minor` or `major` — and never a number. */
export function utilityDriftSeverityTone(severity: string | null | undefined) {
  const token = String(severity ?? "")
    .trim()
    .toLowerCase();
  if (token === "major") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }
  if (token === "minor") {
    return "border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]";
  }
  return "border-border bg-muted/40 text-muted-foreground";
}

/**
 * Why a `broken` lineup broke, worst first. `start_sealed` leads because it is
 * the one that means the update itself killed the lineup: the throw origin got
 * walled off. `inside_geometry` sits at the other end — a grenade cannot fly
 * into a pocket too small to hold it, so it is nearly unreachable in practice.
 */
export const UTILITY_DRIFT_BROKEN_REASONS = [
  "start_sealed",
  "out_of_world",
  "max_flight",
  "inside_geometry",
] as const;

export function utilityDriftReasonKey(reason: string | null | undefined) {
  const token = String(reason ?? "")
    .trim()
    .toLowerCase();
  return (UTILITY_DRIFT_BROKEN_REASONS as readonly string[]).includes(token)
    ? token
    : null;
}

/**
 * Triage order, and the reason the list is not sorted by distance: the rows
 * that matter most — broken lineups — carry no distance at all, so a distance
 * sort buries exactly what a human opened the scan to find.
 */
export function utilityDriftTriageRank(row: UtilityDriftResultView): number {
  if (row.broken) {
    return row.reason === "start_sealed" ? 0 : 1;
  }
  switch (utilityDriftVerdictKey(row.verdict)) {
    case "moved":
      return 3;
    case "unsimulatable":
      return 4;
    case "unchanged":
      return 5;
    default:
      // An unrecognised verdict is surfaced, not buried: nobody can triage a
      // word the UI has never seen if it sits under two hundred "unchanged".
      return 2;
  }
}

function severityWeight(severity: string | null) {
  if (severity === "major") {
    return 0;
  }
  return severity === "minor" ? 1 : 2;
}

export function sortUtilityDriftResults(rows: UtilityDriftResultView[]) {
  return [...rows].sort((a, b) => {
    const rank = utilityDriftTriageRank(a) - utilityDriftTriageRank(b);
    if (rank !== 0) {
      return rank;
    }
    const severity = severityWeight(a.severity) - severityWeight(b.severity);
    if (severity !== 0) {
      return severity;
    }
    return (b.distance ?? -1) - (a.distance ?? -1);
  });
}

/**
 * Why the plan put a lineup where it did. Same contract as the drift verdicts:
 * these are the tokens the ranker emits today, an unknown one still renders —
 * humanized — and a row is never dropped for carrying a word this UI has not
 * seen. A plan that hides its unfamiliar rows is a plan with holes in it.
 */
export const UTILITY_PLAN_REASONS = [
  "never_attempted",
  "popular_unmastered",
  "unmastered",
  "mastered_slipping",
] as const;

export function utilityPlanReasonKey(reason: string | null | undefined) {
  const token = String(reason ?? "")
    .trim()
    .toLowerCase();
  return (UTILITY_PLAN_REASONS as readonly string[]).includes(token)
    ? token
    : null;
}

export function utilityPlanReasonTone(reason: string | null | undefined) {
  switch (utilityPlanReasonKey(reason)) {
    // Ground lost, not ground never taken: this one had been mastered and the
    // streak has since broken, which is the only row on the list that is a
    // regression rather than a gap.
    case "mastered_slipping":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "never_attempted":
    case "popular_unmastered":
      return "border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

/**
 * A solve request is answered by a lineup showing up in the library, not by the
 * mutation. This is how close that lineup's landing has to be to the requested
 * target before the UI is willing to say "that one is yours".
 */
export const UTILITY_SOLVE_MATCH_UNITS = 256;

/** The solver's own ceiling — a request that outlives it is not coming back. */
export const UTILITY_SOLVE_TIMEOUT_MS = 120000;

export function utilitySolveMatches(
  lineup: Pick<
    UtilityLineup,
    "land_x" | "land_y" | "land_z" | "trajectory_preview"
  >,
  target: { x: number; y: number; z: number },
): boolean {
  const landing = utilityLanding(lineup);
  if (!landing) {
    return false;
  }
  const dx = landing.x - target.x;
  const dy = landing.y - target.y;
  return Math.sqrt(dx * dx + dy * dy) <= UTILITY_SOLVE_MATCH_UNITS;
}

/**
 * The demo's own word for a grenade, reduced to the five the library keys on.
 * Null means the parser named something this UI has no lineup type for, which
 * is a row that cannot be saved rather than a row to guess at.
 */
export function canonicalUtilityType(
  raw: string | null | undefined,
): UtilityType | null {
  const token = String(raw ?? "").toLowerCase();
  if (token.includes("flash")) {
    return "Flash";
  }
  if (token.includes("smoke")) {
    return "Smoke";
  }
  if (token.includes("decoy")) {
    return "Decoy";
  }
  if (
    token.includes("molot") ||
    token.includes("incend") ||
    token.includes("inferno") ||
    token.includes("fire")
  ) {
    return "Molotov";
  }
  // Last, and deliberately so: "he" is a substring of half the English
  // language, and every other utility name has already been claimed above.
  if (
    token.includes("he") ||
    token.includes("explos") ||
    token.includes("frag")
  ) {
    return "HighExplosive";
  }
  return null;
}

/**
 * How a lineup gets missed, aggregated across everyone who has drilled it.
 * Same contract as the drift verdicts and the plan reasons: these are the
 * tokens the aggregate emits today, an unknown one still renders — humanized —
 * and a row is never dropped for carrying a word this UI has not seen.
 *
 * `none` is not "nobody misses it": it is the aggregate saying the misses have
 * no direction to them, which is a different sentence from `scattered`.
 */
export const UTILITY_MISS_BIASES = [
  "short",
  "long",
  "left",
  "right",
  "high",
  "low",
  "scattered",
  "none",
] as const;

export type UtilityMissBias = (typeof UTILITY_MISS_BIASES)[number];

export function utilityMissBiasKey(raw: string | null | undefined) {
  const token = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]/g, "_");
  return (UTILITY_MISS_BIASES as readonly string[]).includes(token)
    ? (token as UtilityMissBias)
    : null;
}

/**
 * A directional bias is the only one worth colouring: it is the one a human can
 * do something with. `scattered` and `none` are both "there is no pattern here"
 * and read as neutral.
 */
export function utilityMissBiasTone(raw: string | null | undefined) {
  const key = utilityMissBiasKey(raw);
  if (!key || key === "none" || key === "scattered") {
    return "border-border bg-muted/40 text-muted-foreground";
  }
  return "border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]";
}

export type UtilityMissAxis = "along" | "lateral" | "vertical";

/**
 * The three means are signed offsets in source units, relative to the throw
 * direction: along is positive past the target, lateral positive to the throw's
 * right (so a negative reads as the thrower's left), vertical positive above
 * it. Printing the raw negative would be unreadable, so this is the one place a
 * sign becomes a word.
 */
const UTILITY_MISS_AXIS_WORDS: Record<UtilityMissAxis, [string, string]> = {
  along: ["short", "long"],
  lateral: ["left", "right"],
  vertical: ["low", "high"],
};

export type UtilityMissAxisView = {
  /** The measured direction, or null when the mean rounds away to nothing. */
  axis: UtilityMissAxis;
  direction: string | null;
  /** Always positive — the direction carries the sign. */
  units: number;
};

/**
 * A measurement, never a verdict. There is deliberately no threshold here: the
 * server decides whether a lineup has a bias at all, against the configured
 * `utility_success_radius` that this page cannot see, and a second opinion
 * computed locally would contradict `bias` the day an operator changes it. The
 * only thing suppressed is a mean that rounds to zero units, which is arithmetic
 * rather than judgement.
 */
export function utilityMissAxisView(
  axis: UtilityMissAxis,
  value: number | null | undefined,
): UtilityMissAxisView | null {
  if (value == null || !Number.isFinite(Number(value))) {
    return null;
  }
  const mean = Number(value);
  const units = Math.round(Math.abs(mean));
  const [negative, positive] = UTILITY_MISS_AXIS_WORDS[axis];
  return {
    axis,
    direction: units === 0 ? null : mean < 0 ? negative : positive,
    units,
  };
}

/**
 * PROVISIONAL TOKENS. Aggregate difficulty, graded from how everyone does on a
 * lineup. `unmeasured` is the load-bearing one and is never a grade: a handful
 * of attempts by one player is an absence of evidence, and showing it as "easy"
 * because the hit rate happens to look good is the exact wrong inference. A
 * token this UI has never seen is humanized and treated as unmeasured for
 * colour, because an unrecognised grade is not a grade either.
 */
export const UTILITY_DIFFICULTIES = [
  "unmeasured",
  "easy",
  "moderate",
  "hard",
  "very_hard",
] as const;

export type UtilityDifficulty = (typeof UTILITY_DIFFICULTIES)[number];

export function utilityDifficultyKey(raw: string | null | undefined) {
  const token = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]/g, "_");
  return (UTILITY_DIFFICULTIES as readonly string[]).includes(token)
    ? (token as UtilityDifficulty)
    : null;
}

/** Whether the token is an actual grade, as opposed to "not enough throws". */
export function utilityDifficultyMeasured(raw: string | null | undefined) {
  const key = utilityDifficultyKey(raw);
  return !!key && key !== "unmeasured";
}

export function utilityDifficultyTone(raw: string | null | undefined) {
  switch (utilityDifficultyKey(raw)) {
    case "easy":
      return "border-success/40 bg-success/10 text-success";
    case "moderate":
      return "border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]";
    case "hard":
      return "border-[hsl(var(--tac-amber)/0.7)] bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]";
    case "very_hard":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    default:
      // Unmeasured and unknown share the dashed muted state the chip draws —
      // neither of them is a grade, and neither may borrow one's colour.
      return "border-dashed border-border bg-muted/30 text-muted-foreground";
  }
}
