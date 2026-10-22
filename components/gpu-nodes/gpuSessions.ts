// What the GPU nodes page derives from its subscriptions: who is on each GPU
// right now, the node's state, the Steam account pool's health and the
// filters. Pure, so it can be tested without a socket.
import { shortGpuName } from "~/components/gpu-nodes/gpuDevices";
import compactDuration, { durationUnit } from "~/utilities/compactDuration";

export type GpuSessionKind = "live" | "demo" | "highlights" | "bake";

export type GpuSession = {
  id: string;
  kind: GpuSessionKind;
  nodeId: string;
  /** Live streams only: GOTV or a direct connection. */
  liveMode?: string | null;
  /** The viewer or the player a render is for; null for spectators / system. */
  who: string | null;
  /** A render queued by the platform rather than a player. */
  system?: boolean;
  matchup: string | null;
  matchId: string | null;
  account: string | null;
  startedAt: number | null;
  booting: boolean;
  statusHistory: any[] | null;
  status: string | null;
  /** Renders: 0..1. Bakes: 0..100. */
  progress: number | null;
  progressStage: string | null;
  snapshotKind: "live" | "demo" | "bake" | "clips";
  snapshotId: string;
};

export type GpuNodeStateKey =
  | "disabled"
  | "offline"
  | "setup"
  | "starting"
  | "streaming"
  | "playing"
  | "rendering"
  | "baking"
  | "bake_failed"
  | "idle";

export type GpuNodeState = {
  key: GpuNodeStateKey;
  tone: "off" | "bad" | "warn" | "ok" | "amber";
  /** Live/active work: the only state that gets the ping. */
  live: boolean;
  group: "busy" | "idle" | "off";
};

export type GpuPoolHealth = {
  nodes: number;
  total: number;
  free: number;
  tone: "muted" | "warn" | "ok";
  key: "no_nodes" | "empty" | "short" | "enough";
  short: number;
};

export type GpuNodeFilters = {
  work: "" | "streaming" | "demos" | "rendering";
  kind: "" | "gpu" | "match";
  region: string;
};

type Account = {
  username: string;
  claims?: Array<{
    purpose: string;
    node_id: string | null;
    created_at?: string | null;
  }>;
};

const matchupOf = (match: any): string | null => {
  const a = match?.lineup_1?.name;
  const b = match?.lineup_2?.name;
  return a && b ? `${a} vs ${b}` : null;
};

const time = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : null;
};

function firstAt(history: unknown): number | null {
  if (!Array.isArray(history)) return null;
  let first: number | null = null;
  for (const entry of history) {
    const at = time(entry?.at);
    if (at !== null && (first === null || at < first)) first = at;
  }
  return first;
}

/** The account a pod on `nodeId` holds, preferring the claim for `purpose`. */
export function claimFor(
  accounts: Account[],
  nodeId: string,
  purpose: string,
): { username: string; createdAt: number | null } | null {
  let fallback: { username: string; createdAt: number | null } | null = null;
  for (const account of accounts) {
    for (const claim of account.claims ?? []) {
      if (claim.node_id !== nodeId) continue;
      const found = {
        username: account.username,
        createdAt: time(claim.created_at),
      };
      if (claim.purpose === purpose) return found;
      fallback ??= found;
    }
  }
  return fallback;
}

export function isBaking(node: any): boolean {
  const status = node?.shader_bake_status;
  return !!status && status !== "done" && status !== "errored";
}

export function bakeFailed(node: any): boolean {
  return node?.shader_bake_status === "errored";
}

// A bake's progress stage, "(26824 / 731082)", as "26,824 / 731,082".
export function shaderCount(stage: string | null | undefined): string | null {
  const match = stage?.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/);
  if (!match) {
    return null;
  }
  const done = Number(match[1].replace(/,/g, "")).toLocaleString();
  const total = Number(match[2].replace(/,/g, "")).toLocaleString();
  return `${done} / ${total}`;
}

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Everything holding a GPU right now: one live stream, demo or render per
 * node (in that order, as the scheduler hands them out), plus shader bakes.
 */
export function buildSessions(input: {
  nodes: any[];
  streams: any[];
  demos: any[];
  renders: any[];
  accounts: Account[];
}): GpuSession[] {
  const { nodes, streams, demos, renders, accounts } = input;
  const byNode = new Map<string, GpuSession>();

  const started = (
    nodeId: string,
    purpose: string,
    ...fallbacks: unknown[]
  ) => {
    const claim = claimFor(accounts, nodeId, purpose);
    let at = claim?.createdAt ?? null;
    for (const fallback of fallbacks) {
      at ??= Array.isArray(fallback) ? firstAt(fallback) : time(fallback);
    }
    return { account: claim?.username ?? null, startedAt: at };
  };

  for (const stream of streams) {
    const nodeId = stream.game_server_node_id;
    if (!nodeId || byNode.has(nodeId)) continue;
    byNode.set(nodeId, {
      id: `live:${stream.id}`,
      kind: "live",
      nodeId,
      liveMode: stream.mode ?? null,
      who: null,
      matchup: matchupOf(stream.match),
      matchId: stream.match_id ?? null,
      ...started(nodeId, "live", stream.status_history),
      booting: !stream.is_live,
      statusHistory: stream.status_history ?? null,
      status: stream.status ?? null,
      progress: null,
      progressStage: null,
      snapshotKind: "live",
      snapshotId: stream.match_id,
    });
  }

  for (const session of demos) {
    const nodeId = session.game_server_node_id;
    if (!nodeId || byNode.has(nodeId)) continue;
    byNode.set(nodeId, {
      id: `demo:${session.id}`,
      kind: "demo",
      nodeId,
      who: session.watcher?.name ?? null,
      matchup: matchupOf(session.match),
      matchId: session.match_id ?? null,
      ...started(nodeId, "demo", session.status_history, session.created_at),
      booting: session.status !== "playing",
      statusHistory: session.status_history ?? null,
      status: session.status ?? null,
      progress: null,
      progressStage: null,
      snapshotKind: "demo",
      snapshotId: session.id,
    });
  }

  for (const job of renders) {
    const nodeId = job.game_server_node_id;
    if (!nodeId || byNode.has(nodeId)) continue;
    const match = job.match_map?.match;
    byNode.set(nodeId, {
      id: `highlights:${job.id}`,
      kind: "highlights",
      nodeId,
      who: job.user?.name ?? null,
      system: !job.user_steam_id,
      matchup: matchupOf(match),
      matchId: match?.id ?? null,
      ...started(nodeId, "highlights", job.status_history, job.created_at),
      booting: job.status === "queued",
      statusHistory: job.status_history ?? null,
      status: job.status ?? null,
      progress: num(job.progress),
      progressStage: null,
      snapshotKind: "clips",
      snapshotId: job.id,
    });
  }

  const sessions = [...byNode.values()];

  for (const node of nodes) {
    if (!isBaking(node)) continue;
    sessions.push({
      id: `bake:${node.id}`,
      kind: "bake",
      nodeId: node.id,
      who: null,
      system: true,
      matchup: null,
      matchId: null,
      ...started(node.id, "bake", node.shader_bake_status_history),
      booting: node.shader_bake_status !== "processing_shaders",
      statusHistory: node.shader_bake_status_history ?? null,
      status: node.shader_bake_status ?? null,
      progress: num(node.shader_bake_progress),
      progressStage: node.shader_bake_progress_stage || null,
      snapshotKind: "bake",
      snapshotId: node.id,
    });
  }

  // Order of the node list, so the table doesn't reshuffle as work starts.
  const order = new Map(nodes.map((node, index) => [node.id, index]));
  return sessions.sort(
    (a, b) =>
      (order.get(a.nodeId) ?? 0) - (order.get(b.nodeId) ?? 0) ||
      (a.kind === "bake" ? 1 : 0) - (b.kind === "bake" ? 1 : 0),
  );
}

export function gpuNodeState(
  node: any,
  session: GpuSession | null | undefined,
): GpuNodeState {
  if (!node.enabled) {
    return { key: "disabled", tone: "off", live: false, group: "off" };
  }
  if (node.status === "Offline") {
    return { key: "offline", tone: "bad", live: false, group: "off" };
  }
  if (node.status === "Setup") {
    return { key: "setup", tone: "warn", live: false, group: "off" };
  }
  if (session && session.kind !== "bake") {
    if (session.booting) {
      return { key: "starting", tone: "ok", live: true, group: "busy" };
    }
    const key =
      session.kind === "live"
        ? "streaming"
        : session.kind === "demo"
          ? "playing"
          : "rendering";
    return { key, tone: "ok", live: true, group: "busy" };
  }
  if (isBaking(node)) {
    return { key: "baking", tone: "amber", live: true, group: "busy" };
  }
  if (bakeFailed(node)) {
    return { key: "bake_failed", tone: "bad", live: false, group: "idle" };
  }
  return { key: "idle", tone: "ok", live: false, group: "idle" };
}

/**
 * Each running pod holds one Steam account, so the pool needs one per GPU
 * that can take work to keep them all busy. Disabled nodes need none.
 */
export function poolHealth(nodes: any[], accounts: Account[]): GpuPoolHealth {
  const working = nodes.filter((node) => node.enabled).length;
  const total = accounts.length;
  const free = accounts.filter((a) => (a.claims?.length ?? 0) === 0).length;
  if (nodes.length === 0) {
    return { nodes: 0, total, free, tone: "muted", key: "no_nodes", short: 0 };
  }
  if (total === 0) {
    return {
      nodes: working,
      total,
      free,
      tone: "warn",
      key: "empty",
      short: 0,
    };
  }
  if (total < working) {
    return {
      nodes: working,
      total,
      free,
      tone: "warn",
      key: "short",
      short: working - total,
    };
  }
  return {
    nodes: working,
    total,
    free,
    tone: free === 0 ? "warn" : "ok",
    key: "enough",
    short: 0,
  };
}

/**
 * Renders queued with no GPU yet: every queued job, less the ones already
 * booting on a node.
 */
export function rendersWaiting(queuedTotal: number, renders: any[]): number {
  const booting = renders.filter(
    (job) => job.status === "queued" && job.game_server_node_id,
  ).length;
  return Math.max(0, queuedTotal - booting);
}

export type WaitReason =
  "no_accounts" | "paused_for_match" | "no_account_free" | "no_gpu_free";

export function waitReason(input: {
  nodes: any[];
  sessions: GpuSession[];
  accounts: Account[];
  pausedForMatch: boolean;
}): WaitReason {
  const { nodes, sessions, accounts, pausedForMatch } = input;
  if (accounts.length === 0) return "no_accounts";
  if (pausedForMatch) return "paused_for_match";
  const busy = new Set(sessions.map((session) => session.nodeId));
  const idleRenderer = nodes.some(
    (node) =>
      node.enabled &&
      node.status !== "Offline" &&
      node.status !== "Setup" &&
      node.gpu_rendering_enabled &&
      !busy.has(node.id),
  );
  const freeAccount = accounts.some((a) => (a.claims?.length ?? 0) === 0);
  return idleRenderer && !freeAccount ? "no_account_free" : "no_gpu_free";
}

export function nodeMatchesFilters(node: any, filters: GpuNodeFilters) {
  if (filters.work && !node[`gpu_${filters.work}_enabled`]) return false;
  if (filters.kind) {
    const match = isMatchNode(node);
    if (filters.kind === "match" ? !match : match) return false;
  }
  if (filters.region) {
    if (
      filters.region === "none" ? !!node.region : node.region !== filters.region
    )
      return false;
  }
  return true;
}

/** Hosts matches as well as GPU work (has a port range and takes matches). */
export function isMatchNode(node: any): boolean {
  return !!(
    node.start_port_range &&
    node.end_port_range &&
    node.enabled_for_match_making
  );
}

export function nodeName(node: any): string {
  return node?.label || node?.id || "";
}

export function gpuName(node: any): string | null {
  return node?.gpu_info?.[0]?.name ?? null;
}

/** "NVIDIA GeForce RTX 4080 SUPER" → "RTX 4080 SUPER". */
export function gpuShortName(node: any): string | null {
  return shortGpuName(gpuName(node));
}

export function matchesSearch(
  query: string,
  node: any,
  session?: GpuSession | null,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    gpuName(node),
    node?.label,
    node?.id,
    node?.public_ip,
    node?.lan_ip,
    node?.e_region?.description,
    session?.matchup,
    session?.who,
    session?.account,
  ].some(
    (value) => typeof value === "string" && value.toLowerCase().includes(q),
  );
}

/** "<1m", "41m", "1h 3m". */
export function formatElapsed(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) {
    return `<${durationUnit(1, "minute")}`;
  }
  return compactDuration(minutes * 60000, {
    largest: "hour",
    smallest: "minute",
    parts: 2,
  });
}

export type GpuWorkload = "streaming" | "demos" | "rendering";

/** The node switch a session runs under. Bakes run under none. */
export function sessionWorkload(
  session: Pick<GpuSession, "kind"> | null | undefined,
): GpuWorkload | null {
  switch (session?.kind) {
    case "live":
      return "streaming";
    case "demo":
      return "demos";
    case "highlights":
      return "rendering";
    default:
      return null;
  }
}

type Translate = (key: string, values?: Record<string, unknown>) => string;

/**
 * What the node is doing under each workload right now, for the workload
 * control. A GPU runs one session at a time, so at most one line is set.
 */
export function workloadActivity(
  session: GpuSession | null | undefined,
  t: Translate,
): Partial<Record<GpuWorkload, string>> {
  const workload = sessionWorkload(session);
  if (!session || !workload) return {};
  const who =
    session.who ||
    (session.system ? t("common.system") : t("gpu_pool_status.unknown_user"));
  let line: string;
  if (session.kind === "live") {
    line = t("pages.gpu_nodes.workload.now_streaming", {
      matchup: session.matchup || t("gpu_pool_status.live_match"),
    });
  } else if (session.kind === "demo") {
    line = t("pages.gpu_nodes.workload.now_demo", { who });
  } else {
    const pct =
      session.status === "rendering" && session.progress !== null
        ? Math.round(session.progress * 100)
        : null;
    line =
      pct === null
        ? t("pages.gpu_nodes.workload.now_render", { who })
        : t("pages.gpu_nodes.workload.now_render_pct", { who, pct });
  }
  if (session.booting) line += ` · ${t("pages.gpu_nodes.state.starting")}`;
  return { [workload]: line };
}

export type SteamTileStatus =
  "empty" | "no_nodes" | "short" | "busy" | "enough";

/** The one line the Steam accounts tile leads with. */
export function steamTileStatus(health: GpuPoolHealth): SteamTileStatus {
  if (health.total === 0) return "empty";
  if (health.key === "no_nodes") return "no_nodes";
  if (health.key === "short") return "short";
  return health.free === 0 ? "busy" : "enough";
}

export type GpuSortKey = "gpu" | "node" | "state";
type SortDir = "asc" | "desc";

const GROUP_ORDER: Record<GpuNodeState["group"], number> = {
  busy: 0,
  idle: 1,
  off: 2,
};

/**
 * The GPUs table in the order its header asks for: by card name, by node, or
 * by state (busy, then idle, then off). Ties fall back to the node's name.
 */
export function sortGpuNodes<T>(
  nodes: readonly T[],
  key: GpuSortKey,
  dir: SortDir,
  stateOf: (node: T) => GpuNodeState,
): T[] {
  const sign = dir === "asc" ? 1 : -1;
  const byName = (a: T, b: T) => nodeName(a).localeCompare(nodeName(b));
  return [...nodes].sort((a, b) => {
    let diff = 0;
    if (key === "state") {
      diff = GROUP_ORDER[stateOf(a).group] - GROUP_ORDER[stateOf(b).group];
    } else if (key === "gpu") {
      diff = (gpuName(a) ?? "").localeCompare(gpuName(b) ?? "");
    } else {
      diff = byName(a, b);
    }
    return diff * sign || byName(a, b);
  });
}

/** The GPU page's remembered view: search, filters and sort. */
export type GpuView = {
  query: string;
  kindFilter: string;
  filters: GpuNodeFilters;
  sort: GpuSortKey;
  dir: SortDir;
};

export const gpuViewDefaults = (): GpuView => ({
  query: "",
  kindFilter: "all",
  filters: { work: "", kind: "", region: "" },
  sort: "gpu",
  dir: "asc",
});

const oneOf =
  (...values: unknown[]) =>
  (value: unknown) =>
    values.includes(value);

export const gpuViewValidators = {
  kindFilter: oneOf("all", "live", "demo", "highlights"),
  filters: (value: unknown) => {
    const filters = value as Partial<GpuNodeFilters> | null;
    return (
      !!filters &&
      typeof filters === "object" &&
      oneOf("", "streaming", "demos", "rendering")(filters.work) &&
      oneOf("", "gpu", "match")(filters.kind) &&
      typeof filters.region === "string"
    );
  },
  sort: oneOf("gpu", "node", "state"),
  dir: oneOf("asc", "desc"),
};

/**
 * A remembered region filter only holds while a GPU is still in it (or, for
 * "none", while one has no region); otherwise it would hide every GPU.
 */
export function regionFilterHolds(region: string, nodes: any[]): boolean {
  if (!region) return true;
  return region === "none"
    ? nodes.some((node) => !node.region)
    : nodes.some((node) => node.region === region);
}
