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
import { normalizeMapName } from "~/utilities/mapAssets";

export type UtilityScope =
  | "public"
  | "mine"
  | "team"
  | "favorites"
  | "archived"
  | "pending";

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

/**
 * How close the crosshair has to be, in degrees, before the in-game marker
 * turns green and the throw reads as lined up. Named rather than typed in: a
 * degree figure means nothing to somebody saving a lineup, but "this one has
 * to be exact" does.
 */
export const UTILITY_AIM_PRECISIONS = [
  { key: "exact", degrees: 0.15 },
  { key: "tight", degrees: 0.35 },
  { key: "normal", degrees: 0.75 },
  { key: "loose", degrees: 1.5 },
] as const;

export type UtilityAimPrecision = (typeof UTILITY_AIM_PRECISIONS)[number]["key"];

export const UTILITY_DEFAULT_AIM_TOLERANCE = 0.35;

/** Hasura sends double precision as a string, so never trust the raw value. */
export function aimTolerance(value: number | string | null | undefined): number {
  const degrees = Number(value);

  return Number.isFinite(degrees) && degrees > 0
    ? degrees
    : UTILITY_DEFAULT_AIM_TOLERANCE;
}

export function aimPrecisionFor(
  value: number | string | null | undefined,
): UtilityAimPrecision {
  const degrees = aimTolerance(value);

  return UTILITY_AIM_PRECISIONS.reduce((closest, entry) =>
    Math.abs(entry.degrees - degrees) < Math.abs(closest.degrees - degrees)
      ? entry
      : closest,
  ).key;
}

export function aimPrecisionDegrees(precision: UtilityAimPrecision): number {
  return (
    UTILITY_AIM_PRECISIONS.find((entry) => entry.key === precision)?.degrees ??
    UTILITY_DEFAULT_AIM_TOLERANCE
  );
}

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
    return {
      x: Number(lineup.land_x),
      y: Number(lineup.land_y),
      z: Number(lineup.land_z ?? 0),
    };
  }
  const preview = normalizeTrajectory(lineup.trajectory_preview);
  return preview.length > 0 ? preview[preview.length - 1] : null;
}

export function utilityOrigin(
  lineup: Pick<UtilityLineup, "origin_x" | "origin_y" | "origin_z" | "eye_z">,
): UtilityTrajectoryPoint {
  return {
    // Coerced here, at the one helper everything reads an origin through:
    // Hasura sends double precision as a string, and a string that reaches
    // arithmetic concatenates instead of adding.
    x: Number(lineup.origin_x),
    y: Number(lineup.origin_y),
    // The FEET, not the eye. This is where a player stands, and for a jump
    // throw the two are not even the same moment: origin_z is the standstill
    // the throw was set up from while eye_z is the release, which happens in
    // the air. Anything that genuinely wants an eye adds the height itself.
    z: Number(lineup.origin_z),
  };
}

/** Five consecutive successes inside `public.utility_success_radius`. */
export const UTILITY_MASTERY_STREAK = 5;

export const UTILITY_PLAYBOOK_MAX_STEPS = 32;

export const UTILITY_PLAYBOOK_MAX_OFFSET_MS = 600000;

/**
 * Where a new beat lands and how far the stepper moves it. A first throw
 * stamped 0.0 read as "not filled in" rather than "on the call", and tenths
 * were finer than anyone has ever called an execute.
 */
export const UTILITY_PLAYBOOK_MIN_OFFSET_SECONDS = 1;

export const UTILITY_PLAYBOOK_OFFSET_STEP_SECONDS = 0.5;

/**
 * What one player can physically carry out of buy: two flashes, one of
 * everything else, four grenades in total. A step list handing the same player
 * five smokes is not an execute, it is five rounds of one.
 */
export const UTILITY_CARRY_LIMITS: Record<UtilityType, number> = {
  Smoke: 1,
  Flash: 2,
  Molotov: 1,
  HighExplosive: 1,
  Decoy: 1,
};

export const UTILITY_CARRY_TOTAL = 4;

/**
 * A mined lineup's aim comes out of the flight path, which lands within about a
 * degree or two. Past this the reconstruction and the demo's own view angles
 * genuinely disagree and the lineup has to be walked in a practice server.
 */
export const UTILITY_AIM_DELTA_WARN_DEGREES = 3;

/**
 * Which mouse buttons throw it. CS2 has no jump-throw bind any more -- a jump
 * throw is just a jump, which the technique already says -- so the only thing
 * left to tell a player about the throw itself is what to press:
 *
 *   Full  left click        maximum distance
 *   Half  left + right      about half of it
 *   Drop  right click       drops at your feet
 */
export type UtilityThrowButtons = { left: boolean; right: boolean };

export const UTILITY_THROW_BUTTONS: Record<
  UtilityThrowStrength,
  UtilityThrowButtons
> = {
  Full: { left: true, right: false },
  Half: { left: true, right: true },
  Drop: { left: false, right: true },
};

export function utilityThrowButtons(
  strength: UtilityThrowStrength | null | undefined,
): UtilityThrowButtons {
  return UTILITY_THROW_BUTTONS[strength as UtilityThrowStrength] ?? UTILITY_THROW_BUTTONS.Full;
}

/** `left`, `right` or `both` -- the i18n key under `pages.utility.throw_buttons`. */
export function utilityThrowButtonsKey(
  strength: UtilityThrowStrength | null | undefined,
): "left" | "right" | "both" {
  const buttons = utilityThrowButtons(strength);
  if (buttons.left && buttons.right) {
    return "both";
  }
  return buttons.right ? "right" : "left";
}

/**
 * Where a lineup lives now that it has no page of its own: an address on the map
 * it belongs to, which opens the detail over the board and the list instead of
 * replacing them.
 *
 * Without a map name it falls back to the old `/utility/lineup/<id>` route,
 * which still exists purely to look the map up and redirect here.
 */
export function utilityLineupRoute(
  mapName: string | null | undefined,
  id: string,
) {
  if (!mapName) {
    return { name: "utility-lineup-id", params: { id } };
  }
  return {
    name: "utility-map",
    params: { map: normalizeMapName(mapName) },
    query: { lineup: id },
  };
}

/**
 * The video to show instead of the 3D reconstruction, when there is one.
 *
 * There is no clip attached to a lineup yet: `utility_lineups` has no relation
 * to `match_clips`, so the only URL a lineup carries is `source_url`, which the
 * import path fills in with wherever the lineup came from. That is a clip only
 * when it points straight at a video file.
 *
 * This is the one place that answers "is there a clip", so wiring a real one up
 * later is a single extra line here rather than a change in every surface that
 * previews a lineup.
 */
export function utilityClipSource(
  lineup: Pick<UtilityLineup, "source_url" | "preview_url">,
): string | null {
  // A preview we filmed ourselves beats a link somebody pasted: it is this
  // lineup's throw, at this lineup's angles, on the map as it ships today.
  const rendered = (lineup.preview_url ?? "").trim();
  if (rendered) {
    return rendered;
  }
  const url = (lineup.source_url ?? "").trim();
  if (!url) {
    return null;
  }
  // Deliberately narrow. A page that happens to be *about* the lineup is not a
  // clip of it, and dropping an arbitrary imported link into a <video> element
  // just renders a broken player.
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url) ? url : null;
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
    // Archived lineups are hidden everywhere except the scope that exists to
    // get them back. Without this an archive looks like it failed on reload.
    archived_at:
      state.scope === "archived" ? { _is_null: false } : { _is_null: true },
    // The review queue is "asked, not yet answered". Everywhere else a pending
    // lineup is just a private lineup and needs no clause of its own.
    ...(state.scope === "pending"
      ? {
          public_requested_at: { _is_null: false },
          visibility: { _neq: "Public" },
        }
      : {}),
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
  } else if (state.scope === "archived" && context.mySteamId) {
    clause.author_steam_id = { _eq: context.mySteamId };
  } else if (state.scope === "pending") {
    // Deliberately not narrowed to the caller: the point of the queue is other
    // people's submissions, and only a reviewer can see it at all.
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
  /**
   * `badge` puts the label *inside* a ringed disc rather than beside the point.
   * An execute numbers its beats, and a "1" floating next to a square reads as
   * a count of something; a numbered token reads as the order it is.
   */
  shape?: "dot" | "cross" | "badge";
  /**
   * Whether the viewer may grab this point and move it. Only a draggable
   * marker takes pointer events while the board is picking -- everything else
   * stays transparent so a click lands on the map underneath it.
   */
  draggable?: boolean;
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

/**
 * What a panel asks the page's board to draw. The board belongs to the page and
 * outlives every tab, so a panel that needs a map publishes this instead of
 * mounting a second one beside the first.
 */
export type UtilityPanelBoard = {
  picking?: boolean;
  pickZ?: number;
  markers?: UtilityBoardMarker[];
  segments?: UtilityBoardSegment[];
  selectedSegmentKey?: string | null;
  lineups?: UtilityLineup[];
  selectedId?: string | null;
  hoveredId?: string | null;
  showAllLines?: boolean;
  onPick?: (point: { x: number; y: number; z: number }) => void;
  /** A draggable marker was pressed -- said before any movement. */
  onMarkerGrab?: (key: string) => void;
  onMarkerDrag?: (
    key: string,
    point: { x: number; y: number; z: number },
  ) => void;
  onSelect?: (id: string | null) => void;
  onHover?: (id: string | null) => void;
  onSelectSegment?: (key: string) => void;
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
