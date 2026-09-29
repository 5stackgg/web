// Mirrors graphql/cs2BuildGraphql.ts and the api's GameServerNodeService /
// MapAssetsService shapes — extend them together.

export type Cs2BuildNode = {
  id: string;
  label: string | null;
  status: string | null;
  enabled: boolean | null;
  build_id: number | null;
  update_status: string | null;
  gpu: boolean | null;
  enabled_for_match_making: boolean | null;
  e_region?: { description: string | null } | null;
};

export type Cs2BuildRunPerson = {
  game_server_node?: { id: string; label: string | null } | null;
  requested_by?: { steam_id: string; name: string } | null;
};

export type GamedataEntry = {
  set: string;
  signature: string;
  kind?: string | null;
  runtimes?: Array<string> | null;
  count?: number | null;
  ok?: boolean | null;
  skipped?: boolean;
  reason?: string | null;
};

export type GamedataChangeEntry = {
  set: string;
  kind: string;
  signature: string;
  runtimes: Array<string>;
  previous_count: number | null;
  count: number | null;
};

export type GamedataChanges = {
  comparable: boolean;
  counts: { checked: number; broken: number; warnings: number; skipped: number };
  newly_broken: Array<GamedataChangeEntry>;
  fixed: Array<GamedataChangeEntry>;
  new_warnings: Array<GamedataChangeEntry>;
  cleared_warnings: Array<GamedataChangeEntry>;
};

export type GamedataRunRow = Cs2BuildRunPerson & {
  id: string;
  build_id: number;
  status: string;
  started_at: string | null;
  validated_at: string | null;
  trigger: "auto" | "manual" | null;
  previous_build_id: number | null;
  changes: GamedataChanges | null;
  results?: {
    status?: string;
    error?: string;
    statuses?: Record<string, string | null>;
    swiftly?: { error?: string | null } | null;
    broken?: Array<GamedataEntry>;
    warnings?: Array<GamedataEntry>;
    skipped?: Array<GamedataEntry>;
    results?: Array<GamedataEntry>;
  } | null;
};

// Mirrors GameServerNodeService.gamedataErrorReason.
export function gamedataErrorReason(
  row: GamedataRunRow | null | undefined,
): string | null {
  const results = row?.results;
  if (!results) {
    return null;
  }
  if (results.error) {
    return results.error;
  }
  if (results.swiftly?.error) {
    return results.swiftly.error;
  }
  const unverified = Object.entries(results.statuses ?? {})
    .filter(([, status]) => status === "error")
    .map(([set]) => set);
  return unverified.length
    ? `could not verify ${unverified.join(", ")}`
    : null;
}

export type MapAssetKind = "tri" | "grenadeclip" | "view" | "callouts";

export type MapAssetsChanges = {
  comparable: boolean;
  total: number;
  added: Array<string>;
  removed: Array<string>;
  rebuilt: Array<{
    map: string;
    reason: "vpk" | "pipeline" | "assets";
    assets: Array<MapAssetKind>;
  }>;
  unchanged: number;
};

export type MapAssetsRunRow = Cs2BuildRunPerson & {
  build_id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  trigger: "auto" | "manual" | null;
  previous_build_id: string | null;
  changes: MapAssetsChanges | null;
  failed: Array<string> | null;
  failed_view: Array<string> | null;
  manifest?: string | null;
  maps?: Record<string, Partial<Record<MapAssetKind, string>>> | null;
  error?: string | null;
};

export type Cs2BuildTone =
  | "success"
  | "warning"
  | "destructive"
  | "running"
  | "idle";

export type GamedataRunStatus =
  | "running"
  | "passed"
  | "warning"
  | "failed"
  | "error"
  | "stale"
  | "none";

export type MapAssetsRunStatus =
  | "pending"
  | "building"
  | "published"
  | "partial"
  | "failed"
  | "stale"
  | "none";

// The api holds the validation lock for an hour and gives a map build two
// hours plus five minutes of polling; past those, a row still saying it is
// running was left behind by a crash and may be run again.
export const GAMEDATA_STALE_MS = 60 * 60 * 1000;
export const MAP_ASSETS_STALE_MS = (2 * 60 + 5) * 60 * 1000;

export const TONE_BY_GAMEDATA_STATUS: Record<GamedataRunStatus, Cs2BuildTone> =
  {
    running: "running",
    passed: "success",
    warning: "warning",
    failed: "destructive",
    error: "warning",
    stale: "warning",
    none: "idle",
  };

export const TONE_BY_MAP_ASSETS_STATUS: Record<
  MapAssetsRunStatus,
  Cs2BuildTone
> = {
  pending: "running",
  building: "running",
  published: "success",
  partial: "warning",
  failed: "destructive",
  stale: "warning",
  none: "idle",
};

const olderThan = (
  date: string | null | undefined,
  ms: number,
  now: number,
) => !!date && now - new Date(date).getTime() > ms;

export function durationSeconds(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  if (!start || !end) {
    return null;
  }
  const seconds = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 1000,
  );
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null) {
    return null;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes) {
    return `${minutes}m ${rest}s`;
  }
  return `${rest}s`;
}

export function gamedataRunStatus(
  row: GamedataRunRow | null | undefined,
  now = Date.now(),
): GamedataRunStatus {
  if (!row) {
    return "none";
  }
  switch (row.status) {
    case "running":
      return olderThan(row.started_at, GAMEDATA_STALE_MS, now)
        ? "stale"
        : "running";
    case "error":
      return "error";
    case "fail":
      return "failed";
    case "pass": {
      const warnings =
        row.changes?.counts?.warnings ?? row.results?.warnings?.length ?? 0;
      return warnings > 0 ? "warning" : "passed";
    }
    default:
      return "error";
  }
}

export function mapAssetsRunStatus(
  row: MapAssetsRunRow | null | undefined,
  now = Date.now(),
): MapAssetsRunStatus {
  if (!row) {
    return "none";
  }
  switch (row.status) {
    case "Pending":
      return olderThan(row.updated_at, MAP_ASSETS_STALE_MS, now)
        ? "stale"
        : "pending";
    case "Building":
      return olderThan(row.started_at, MAP_ASSETS_STALE_MS, now)
        ? "stale"
        : "building";
    case "Published":
      return "published";
    case "Partial":
      return "partial";
    default:
      return "failed";
  }
}

export type NodeIneligibility =
  | { key: "disabled" }
  | { key: "gpu_only" }
  | { key: "status"; status: string }
  | { key: "updating" }
  | { key: "other_build"; build: string };

// Mirrors GameServerNodeService.buildNodeIneligibility; the api has the final
// word, this only greys out what it would refuse.
export function nodeIneligibility(
  node: Cs2BuildNode,
  buildId: number,
): NodeIneligibility | null {
  if (!node.enabled) {
    return { key: "disabled" };
  }
  if (node.gpu && !node.enabled_for_match_making) {
    return { key: "gpu_only" };
  }
  if (node.status !== "Online") {
    return { key: "status", status: node.status ?? "Offline" };
  }
  if (node.update_status) {
    return { key: "updating" };
  }
  if (node.build_id !== buildId) {
    return { key: "other_build", build: String(node.build_id ?? "?") };
  }
  return null;
}

export type GamedataChangeRow = {
  key: string;
  change: "broken" | "still_broken" | "fixed" | "warning" | "cleared";
  tone: Cs2BuildTone;
  signature: string;
  set: string;
  kind: string;
  runtimes: Array<string>;
  previousCount: number | null;
  count: number | null;
};

const entryKey = (entry: { set: string; kind?: string | null; signature: string }) =>
  `${entry.set}\u0000${entry.kind ?? "signature"}\u0000${entry.signature}`;

function changeRow(
  change: GamedataChangeRow["change"],
  tone: Cs2BuildTone,
  entry: GamedataEntry | GamedataChangeEntry,
): GamedataChangeRow {
  const changeEntry = entry as GamedataChangeEntry;
  return {
    key: `${change}:${entryKey(entry)}`,
    change,
    tone,
    signature: entry.signature,
    set: entry.set,
    kind: entry.kind ?? "signature",
    runtimes: entry.runtimes ?? [],
    previousCount:
      "previous_count" in entry ? changeEntry.previous_count : null,
    count: entry.count ?? null,
  };
}

// Newly broken first, then what is still broken, then what got better.
export function gamedataChangeRows(
  row: GamedataRunRow | null | undefined,
): Array<GamedataChangeRow> {
  const changes = row?.changes;
  const broken = row?.results?.broken ?? [];
  const warnings = row?.results?.warnings ?? [];

  if (!changes?.comparable) {
    return [
      ...broken.map((entry) => changeRow("broken", "destructive", entry)),
      ...warnings.map((entry) => changeRow("warning", "warning", entry)),
    ];
  }

  const newlyBroken = new Set(changes.newly_broken.map(entryKey));

  return [
    ...changes.newly_broken.map((entry) =>
      changeRow("broken", "destructive", entry),
    ),
    ...broken
      .filter((entry) => !newlyBroken.has(entryKey(entry)))
      .map((entry) => changeRow("still_broken", "destructive", entry)),
    ...changes.new_warnings.map((entry) =>
      changeRow("warning", "warning", entry),
    ),
    ...changes.fixed.map((entry) => changeRow("fixed", "success", entry)),
    ...changes.cleared_warnings.map((entry) =>
      changeRow("cleared", "idle", entry),
    ),
  ];
}

export type MapAssetChangeRow = {
  map: string;
  change: "failed" | "rebuilt" | "added" | "removed" | "unchanged" | "included";
  tone: Cs2BuildTone;
  reason: "vpk" | "pipeline" | "assets" | "collision" | "view" | null;
  assets: Array<MapAssetKind>;
};

const ASSET_KINDS: Array<MapAssetKind> = [
  "tri",
  "grenadeclip",
  "view",
  "callouts",
];

// Every map, the ones that changed first, so the list reads top-down as
// "what needs attention, what moved, what stayed".
export function mapAssetChangeRows(
  row: MapAssetsRunRow | null | undefined,
): Array<MapAssetChangeRow> {
  if (!row) {
    return [];
  }

  const maps = row.maps ?? {};
  const changes = row.changes;
  const failedCollision = new Set(row.failed ?? []);
  const failedView = new Set(row.failed_view ?? []);
  const rows: Array<MapAssetChangeRow> = [];
  const listed = new Set<string>();

  for (const map of [...new Set([...failedCollision, ...failedView])].sort()) {
    rows.push({
      map,
      change: "failed",
      tone: "destructive",
      reason: failedCollision.has(map) ? "collision" : "view",
      assets: [],
    });
    listed.add(map);
  }

  if (!changes?.comparable) {
    for (const map of Object.keys(maps).sort()) {
      if (listed.has(map)) {
        continue;
      }
      rows.push({
        map,
        change: "included",
        tone: "idle",
        reason: null,
        assets: ASSET_KINDS.filter((kind) => !!maps[map]?.[kind]),
      });
    }
    return rows;
  }

  for (const rebuilt of changes.rebuilt) {
    if (listed.has(rebuilt.map)) {
      continue;
    }
    rows.push({
      map: rebuilt.map,
      change: "rebuilt",
      tone: "running",
      reason: rebuilt.reason,
      assets: rebuilt.assets,
    });
    listed.add(rebuilt.map);
  }

  for (const map of changes.added) {
    if (listed.has(map)) {
      continue;
    }
    rows.push({
      map,
      change: "added",
      tone: "success",
      reason: null,
      assets: ASSET_KINDS.filter((kind) => !!maps[map]?.[kind]),
    });
    listed.add(map);
  }

  for (const map of changes.removed) {
    rows.push({
      map,
      change: "removed",
      tone: "idle",
      reason: null,
      assets: [],
    });
  }

  for (const map of Object.keys(maps).sort()) {
    if (listed.has(map)) {
      continue;
    }
    rows.push({
      map,
      change: "unchanged",
      tone: "idle",
      reason: null,
      assets: [],
    });
  }

  return rows;
}

export function failedMapCount(row: MapAssetsRunRow | null | undefined) {
  return new Set([...(row?.failed ?? []), ...(row?.failed_view ?? [])]).size;
}
