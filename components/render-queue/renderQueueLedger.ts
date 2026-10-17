// One ledger for both render queues: every highlight clip job and every
// utility lineup render is a row, filtered by where it is in its life.

export type LedgerView = "flight" | "failed" | "done";
export type LedgerKind = "clip" | "utility";

export type ClipHistoryEntry = {
  status: string;
  at: string;
  boot_stage?: string;
  boot_progress?: number;
};

export type LedgerClipJob = {
  id: string;
  match_map_id: string;
  status: string;
  paused?: boolean | null;
  progress: number | string | null;
  error_message: string | null;
  k8s_job_name?: string | null;
  clip_id: string | null;
  created_at: string;
  sort_index?: number | null;
  last_status_at: string | null;
  status_history?: ClipHistoryEntry[] | null;
  spec?: {
    title?: string;
    target_name?: string;
    duration_ms?: number;
    round?: number;
    kills_count?: number;
    segments?: Array<unknown>;
  } | null;
  match_map?: {
    id: string;
    map?: {
      name: string;
      label?: string | null;
      poster?: string | null;
    } | null;
    match?: {
      id: string;
      lineup_1?: { name: string } | null;
      lineup_2?: { name: string } | null;
    } | null;
  } | null;
};

export type LedgerUtilityRender = {
  id: string;
  utility_lineup_id: string;
  map_name: string;
  status: string;
  last_status_at: string | null;
  created_at: string;
  duration_ms?: number | string | null;
  lineup?: { name?: string | null } | null;
};

export type LedgerRow<
  C extends LedgerClipJob = LedgerClipJob,
  U extends LedgerUtilityRender = LedgerUtilityRender,
> =
  | {
      kind: "clip";
      key: string;
      status: string;
      map: string | null;
      at: number;
      job: C;
    }
  | {
      kind: "utility";
      key: string;
      status: string;
      map: string | null;
      at: number;
      render: U;
    };

export const CLIP_TERMINAL = new Set(["done", "error", "cancelled"]);
export const UTILITY_TERMINAL = new Set([
  "done",
  "error",
  "skipped",
  "cancelled",
]);

// A clip the server marked done with no clip behind it lost its upload: it
// is a failure to re-queue, not a finished clip.
export function clipStatus(job: Pick<LedgerClipJob, "status" | "clip_id">) {
  return job.status === "done" && !job.clip_id ? "missing" : job.status;
}

export function rowInView(
  view: LedgerView,
  kind: LedgerKind,
  status: string,
): boolean {
  const terminal =
    kind === "clip"
      ? CLIP_TERMINAL.has(status) || status === "missing"
      : UTILITY_TERMINAL.has(status);

  if (view === "flight") {
    return !terminal;
  }

  const failed =
    status === "error" || (kind === "clip" && status === "missing");

  return view === "failed" ? failed : terminal && !failed;
}

export function clipMatchup(job: LedgerClipJob): string | null {
  const a = job.match_map?.match?.lineup_1?.name;
  const b = job.match_map?.match?.lineup_2?.name;
  return a && b ? `${a} vs ${b}` : null;
}

function stamp(value: string | null | undefined): number {
  const at = Date.parse(value ?? "");
  return Number.isFinite(at) ? at : 0;
}

function clipSearchText(job: LedgerClipJob): string {
  return [
    job.spec?.title,
    job.spec?.target_name,
    job.match_map?.match?.lineup_1?.name,
    job.match_map?.match?.lineup_2?.name,
    job.match_map?.map?.name,
    job.match_map?.map?.label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function utilitySearchText(render: LedgerUtilityRender): string {
  return [render.lineup?.name, render.map_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// Batch-inserted rows share created_at, so sort_index is the tiebreak that
// matches the order a render pod works through them.
function byQueueOrder(a: LedgerClipJob, b: LedgerClipJob): number {
  if (a.created_at !== b.created_at) {
    return a.created_at < b.created_at ? -1 : 1;
  }
  const ai = a.sort_index ?? 0;
  const bi = b.sort_index ?? 0;
  if (ai !== bi) {
    return ai - bi;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function buildLedgerRows<
  C extends LedgerClipJob,
  U extends LedgerUtilityRender,
>(input: {
  clipJobs: C[];
  utilityRenders: U[];
  view: LedgerView;
  query?: string;
  kinds?: ReadonlySet<LedgerKind>;
  maps?: ReadonlySet<string>;
}): LedgerRow<C, U>[] {
  const query = (input.query ?? "").trim().toLowerCase();
  const kinds = input.kinds ?? new Set<LedgerKind>(["clip", "utility"]);
  const maps = input.maps ?? new Set<string>();
  const mapOk = (map: string | null) =>
    maps.size === 0 || (!!map && maps.has(map));
  const out: LedgerRow<C, U>[] = [];

  if (kinds.has("clip")) {
    const jobs = [...input.clipJobs].sort(byQueueOrder);
    for (const job of jobs) {
      const status = clipStatus(job);
      const map = job.match_map?.map?.name ?? null;
      if (
        !rowInView(input.view, "clip", status) ||
        !mapOk(map) ||
        (query && !clipSearchText(job).includes(query))
      ) {
        continue;
      }
      out.push({
        kind: "clip",
        key: `clip:${job.id}`,
        status,
        map,
        at: stamp(job.last_status_at ?? job.created_at),
        job,
      });
    }
  }

  if (kinds.has("utility")) {
    for (const render of input.utilityRenders) {
      const map = render.map_name ?? null;
      if (
        !rowInView(input.view, "utility", render.status) ||
        !mapOk(map) ||
        (query && !utilitySearchText(render).includes(query))
      ) {
        continue;
      }
      out.push({
        kind: "utility",
        key: `utility:${render.id}`,
        status: render.status,
        map,
        at: stamp(render.last_status_at ?? render.created_at),
        render,
      });
    }
  }

  // In flight keeps queue order; history reads newest first.
  return input.view === "flight" ? out : out.sort((a, b) => b.at - a.at);
}

export type LedgerSortKey = "name" | "status" | "length" | "at";
export const LEDGER_SORT_KEYS: readonly LedgerSortKey[] = [
  "name",
  "status",
  "length",
  "at",
];
// Names read A to Z first; length and finished read largest/newest first.
export const LEDGER_SORT_DIRS: Partial<Record<LedgerSortKey, "asc" | "desc">> =
  { length: "desc", at: "desc" };

function rowLength(row: LedgerRow): number | null {
  const ms = Number(
    row.kind === "clip" ? row.job.spec?.duration_ms : row.render.duration_ms,
  );
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

// History sorted by a column. Rows without a length sit last either way;
// ties fall back to newest first.
export function sortLedgerRows<R extends LedgerRow>(
  rows: readonly R[],
  sort: { key: LedgerSortKey; dir: "asc" | "desc" },
  nameOf: (row: R) => string,
): R[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  const compare = (a: R, b: R): number => {
    switch (sort.key) {
      case "name":
        return sign * nameOf(a).localeCompare(nameOf(b));
      case "status":
        return sign * a.status.localeCompare(b.status);
      case "length": {
        const la = rowLength(a);
        const lb = rowLength(b);
        if (la === null || lb === null) {
          return la === lb ? 0 : la === null ? 1 : -1;
        }
        return sign * (la - lb);
      }
      default:
        return sign * (a.at - b.at);
    }
  };
  return [...rows].sort(
    (a, b) =>
      compare(a, b) ||
      b.at - a.at ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}

export function countInView(
  clipJobs: LedgerClipJob[],
  utilityRenders: LedgerUtilityRender[],
  view: LedgerView,
): number {
  return (
    clipJobs.filter((job) => rowInView(view, "clip", clipStatus(job))).length +
    utilityRenders.filter((render) => rowInView(view, "utility", render.status))
      .length
  );
}

export type ClipBatchSummary = {
  matchMapId: string;
  total: number;
  done: number;
  failed: number;
  cancelled: number;
  terminal: number;
  inFlight: number;
  // 0..1 across the batch: done clips count whole, a rendering clip by its
  // own progress, an uploading one as rendered.
  progress: number;
  paused: boolean;
  activeJobId: string | null;
  startedAt: number;
  lastHeardAt: number;
  boot: { stage: string; progress: number | null; at: number } | null;
};

function fraction(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

// A boot tick older than this is a pod that stopped talking.
export const CLIP_BOOT_RECENCY_MS = 5 * 60 * 1000;

export function clipBatchSummary(
  matchMapId: string,
  jobs: LedgerClipJob[],
  now: number,
): ClipBatchSummary {
  let done = 0;
  let failed = 0;
  let cancelled = 0;
  let progress = 0;

  for (const job of jobs) {
    const status = clipStatus(job);
    if (status === "done") {
      done++;
      progress += 1;
    } else if (status === "error" || status === "missing") {
      failed++;
    } else if (status === "cancelled") {
      cancelled++;
    } else if (status === "rendering") {
      progress += fraction(job.progress);
    } else if (status === "uploading") {
      progress += 1;
    }
  }

  const active = jobs.filter((job) => !CLIP_TERMINAL.has(job.status));
  const activeJob = jobs.find(
    (job) => job.status === "rendering" || job.status === "uploading",
  );
  const paused = active.some((job) => job.paused === true);
  const lastHeardAt = active.reduce(
    (latest, job) =>
      Math.max(latest, stamp(job.last_status_at ?? job.created_at)),
    0,
  );

  // The api leaves every row "queued" while the pod boots, so the boot is
  // read from the booting ticks on the rows it is booting for.
  let boot: ClipBatchSummary["boot"] = null;
  if (
    active.length > 0 &&
    active.every((job) => job.status === "queued") &&
    !paused &&
    now - lastHeardAt < CLIP_BOOT_RECENCY_MS
  ) {
    let latest: ClipHistoryEntry | null = null;
    let latestAt = 0;
    for (const job of active) {
      for (const entry of job.status_history ?? []) {
        const at = stamp(entry?.at);
        if (entry?.status === "booting" && entry.boot_stage && at >= latestAt) {
          latest = entry;
          latestAt = at;
        }
      }
    }
    if (latest?.boot_stage) {
      boot = {
        stage: latest.boot_stage.split(":")[0],
        progress:
          typeof latest.boot_progress === "number"
            ? fraction(latest.boot_progress)
            : null,
        at: latestAt,
      };
    }
  }

  const terminal = done + failed + cancelled;

  return {
    matchMapId,
    total: jobs.length,
    done,
    failed,
    cancelled,
    terminal,
    inFlight: jobs.length - terminal,
    progress: jobs.length ? progress / jobs.length : 0,
    paused,
    activeJobId: activeJob?.id ?? null,
    startedAt: jobs.reduce(
      (oldest, job) => Math.min(oldest, stamp(job.created_at) || oldest),
      Number.MAX_SAFE_INTEGER,
    ),
    lastHeardAt,
    boot,
  };
}

// Clips cancel a whole batch at a time: the batches behind a selection.
export function batchesOf(jobs: Array<Pick<LedgerClipJob, "match_map_id">>) {
  return [...new Set(jobs.map((job) => job.match_map_id))];
}

// The api turns down a second render for a lineup while one is under way,
// and one lineup selected twice is still one render.
export function lineupsToRender(
  renders: Array<Pick<LedgerUtilityRender, "utility_lineup_id">>,
  rendering: ReadonlySet<string>,
): string[] {
  return [
    ...new Set(
      renders
        .map((render) => render.utility_lineup_id)
        .filter((id) => !rendering.has(id)),
    ),
  ];
}

export function pageWindow(page: number, pages: number): Array<number | null> {
  const out: Array<number | null> = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1) {
      out.push(n);
    } else if (out[out.length - 1] !== null) {
      out.push(null);
    }
  }
  return out;
}
