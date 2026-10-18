// Shared rules for the database explorer: the slow-query threshold, what
// counts as slow / bloated / cold, and the formatting every view uses. Kept
// free of Vue so the rules can be tested on their own.

export type Sev = "" | "warn" | "bad";

export type DbGridColumn = {
  key: string;
  label: string;
  num?: boolean;
  sortable?: boolean;
  wrap?: boolean;
  tip?: string;
  srOnly?: boolean;
  /** Px floor for a live column whose text changes width between polls. */
  minWidth?: number;
  value?: (row: any) => any;
};

export const SLOW_THRESHOLDS = [250, 500, 1000, 5000] as const;
export const DEFAULT_SLOW_MS = 1000;
export const SLOW_STORAGE_KEY = "db-slow-threshold";
export const SCHEMA_STORAGE_KEY = "database-selected-schemas";

// Below this many dead rows a table is never flagged, however high its share:
// a 40-row table with 30 dead is not worth anyone's attention.
export const DEAD_ROWS_FLOOR = 10000;
// An index this big that has never been scanned is still paid for on every write.
export const UNUSED_INDEX_FLOOR = 8 * 1024 * 1024;
// A running query is critical at ten times the threshold, or past a minute.
export const RUNNING_CRITICAL_SECONDS = 60;

export function readSlowThreshold(): number {
  try {
    const value = Number(localStorage.getItem(SLOW_STORAGE_KEY));
    if ((SLOW_THRESHOLDS as readonly number[]).includes(value)) {
      return value;
    }
  } catch {
    // storage blocked: fall through to the default
  }
  return DEFAULT_SLOW_MS;
}

export function saveSlowThreshold(ms: number) {
  try {
    localStorage.setItem(SLOW_STORAGE_KEY, String(ms));
  } catch {
    // storage blocked: the choice lasts for this visit only
  }
}

export function readSchemas(): string[] {
  try {
    const saved = JSON.parse(
      localStorage.getItem(SCHEMA_STORAGE_KEY) || "null",
    );
    if (Array.isArray(saved)) {
      return saved.filter((s) => typeof s === "string");
    }
  } catch {
    // unreadable: default below
  }
  return ["public"];
}

export function saveSchemas(schemas: string[]) {
  try {
    localStorage.setItem(SCHEMA_STORAGE_KEY, JSON.stringify(schemas));
  } catch {
    // storage blocked
  }
}

export type QueryStatLike = {
  queryid: string;
  query: string;
  calls: number;
  mean_exec_time: number;
  max_exec_time: number;
  total_exec_time: number;
};

export type ActiveQueryLike = {
  pid: number;
  state: string | null;
  duration_seconds: number | null;
  query: string | null;
  wait_event_type?: string | null;
};

export function msSeverity(
  ms: number | null | undefined,
  threshold: number,
): Sev {
  if (ms == null) return "";
  if (ms > threshold * 10) return "bad";
  if (ms > threshold) return "warn";
  return "";
}

export function runSeverity(
  seconds: number | null | undefined,
  threshold: number,
): Sev {
  if (seconds == null) return "";
  const ms = seconds * 1000;
  if (ms >= threshold * 10 || seconds > RUNNING_CRITICAL_SECONDS) return "bad";
  if (ms > threshold) return "warn";
  return "";
}

export function isOverThreshold(q: QueryStatLike, threshold: number) {
  return q.mean_exec_time > threshold || q.max_exec_time > threshold;
}

export function slowStats<Q extends QueryStatLike, A extends ActiveQueryLike>(
  queries: Q[],
  active: A[],
  threshold: number,
) {
  const byMean = (a: Q, b: Q) => b.mean_exec_time - a.mean_exec_time;
  return {
    avg: queries.filter((q) => q.mean_exec_time > threshold).sort(byMean),
    max: queries.filter((q) => q.max_exec_time > threshold).sort(byMean),
    run: active
      .filter(
        (c) =>
          c.state === "active" && (c.duration_seconds ?? 0) * 1000 > threshold,
      )
      .sort((a, b) => (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0)),
  };
}

// Dead share of every row the table holds, so it can never pass 100%.
export function deadFraction(live: number, dead: number) {
  const total = (live || 0) + (dead || 0);
  return total > 0 ? (dead || 0) / total : 0;
}

export function deadSeverity(live: number, dead: number): Sev {
  if ((dead || 0) <= DEAD_ROWS_FLOOR) return "";
  const share = deadFraction(live, dead);
  if (share >= 0.2) return "bad";
  if (share >= 0.1) return "warn";
  return "";
}

export function hitSeverity(ratio: number | null | undefined): Sev {
  if (ratio == null) return "";
  if (ratio < 0.8) return "bad";
  if (ratio < 0.95) return "warn";
  return "";
}

export function cacheRatio(hit: number, read: number): number | null {
  const total = (hit || 0) + (read || 0);
  return total > 0 ? (hit || 0) / total : null;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const touchCache = new Map<string, RegExp>();

// Whether a recorded statement names the table: the bare name, quoted or not,
// never as part of a longer identifier (matches vs match_maps).
export function touchesTable(query: string | null | undefined, table: string) {
  if (!query || !table) return false;
  let re = touchCache.get(table);
  if (!re) {
    re = new RegExp(
      `(^|[^a-z0-9_])"?${escapeRegExp(table.toLowerCase())}"?([^a-z0-9_]|$)`,
    );
    touchCache.set(table, re);
  }
  return re.test(query.toLowerCase());
}

export function worst(...levels: Sev[]): Sev {
  if (levels.includes("bad")) return "bad";
  if (levels.includes("warn")) return "warn";
  return "";
}

// Sessions blocked on a lock. pg_stat_activity's wait_event_type also covers
// idle sessions reading from their client, so it can't stand in for this.
export function lockWaitCount(
  locks: { pid: number | null; granted: boolean | null }[] | null | undefined,
) {
  return new Set((locks || []).filter((l) => !l.granted).map((l) => l.pid))
    .size;
}

export function tableSeverity(input: {
  live: number;
  dead: number;
  lockWaiting: boolean;
  unusedIndex: boolean;
  slow: Sev;
}): Sev {
  if (input.lockWaiting) return "bad";
  return worst(
    deadSeverity(input.live, input.dead),
    input.slow,
    input.unusedIndex ? "warn" : "",
  );
}

export function slowSeverityFor(
  queries: QueryStatLike[],
  table: string,
  threshold: number,
): Sev {
  const hits = queries.filter(
    (q) => isOverThreshold(q, threshold) && touchesTable(q.query, table),
  );
  if (!hits.length) return "";
  return hits.some((q) => q.mean_exec_time > threshold * 10) ? "bad" : "warn";
}

export const cancelSql = (pid: number | string) =>
  `SELECT pg_cancel_backend(${pid});`;
export const terminateSql = (pid: number | string) =>
  `SELECT pg_terminate_backend(${pid});`;

export function formatSize(bytes: number | null | undefined) {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(4, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(i >= 3 ? 2 : 1))} ${units[i]}`;
}

export function formatBig(value: number | null | undefined) {
  const v = value || 0;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  return Math.round(v).toLocaleString();
}

export function formatMs(value: number | null | undefined) {
  const v = value || 0;
  return v >= 10000 ? Math.round(v).toLocaleString() : v.toFixed(2);
}

export function formatDuration(seconds: number | null | undefined) {
  const s = Math.max(0, seconds || 0);
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(Math.floor(s % 60)).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export function formatPct(ratio: number | null | undefined, digits = 1) {
  return ratio == null ? null : `${(ratio * 100).toFixed(digits)}%`;
}

export const SERVER_VIEWS = [
  "overview",
  "queries",
  "connections",
  "locks",
  "io",
  "index-usage",
  "storage",
  "timescale",
  "backups",
] as const;

export const SERVER_LABEL_KEYS: Record<string, string> = {
  overview: "pages.database.explorer.overview",
  queries: "pages.database.explorer.query_performance",
  connections: "pages.database.tabs.connections",
  locks: "pages.database.explorer.locks_transactions",
  io: "pages.database.explorer.io_buffers",
  "index-usage": "pages.database.explorer.index_usage",
  storage: "pages.database.tabs.storage",
  timescale: "pages.database.tabs.timescale",
  backups: "pages.database.tabs.backups",
};

export const thresholdLabel = (ms: number) =>
  ms >= 1000 ? `${ms / 1000} s` : `${ms} ms`;

// pg_locks reports relation::regclass::text: bare when the schema is on the
// search path, schema-qualified (and quoted when needed) otherwise.
export function relationMatches(
  relation: string | null | undefined,
  schema: string,
  name: string,
) {
  if (!relation) return false;
  const bare = relation.replace(/"/g, "");
  return bare === name || bare === `${schema}.${name}`;
}
