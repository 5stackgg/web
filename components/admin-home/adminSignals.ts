// What the admin home calls a problem. Every rule is borrowed from the page
// that owns the area (node attention from the nodes console, the Steam pool
// from GPU nodes, thresholds from System Metrics and the database explorer),
// so the home never disagrees with the page it links to. Plain functions so
// the ordering and grouping can be tested without mounting anything.
import {
  nodeAttention,
  type AttentionItem,
} from "~/components/game-server-nodes/nodeInspector";
import {
  isGpuOnly,
  isOffline,
  type IssueContext,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";
import { bakeFailed, poolHealth } from "~/components/gpu-nodes/gpuSessions";
import type { MetricIssue } from "~/components/system-metrics/metricRules";
import {
  lockWaitCount,
  runSeverity,
  slowStats,
  thresholdLabel,
  type ActiveQueryLike,
  type QueryStatLike,
} from "~/components/database/dbHealth";
import {
  pluginCardState,
  type DesiredInstall,
  type DirectoryPlugin,
} from "~/components/plugins/pluginDirectoryState";
import {
  pluginOutdated,
  type FleetContext,
} from "~/components/servers/serverFleet";

export type Severity = "danger" | "warning" | "notice";

export type AreaKey =
  | "seasons"
  | "nodes"
  | "servers"
  | "gpus"
  | "renders"
  | "metrics"
  | "database"
  | "alerts"
  | "plugins"
  | "settings";

/** The left nav's order: the cards read the way the Admin list does. */
export const AREAS: AreaKey[] = [
  "seasons",
  "nodes",
  "servers",
  "gpus",
  "renders",
  "metrics",
  "database",
  "alerts",
  "plugins",
  "settings",
];

/**
 * Ties between two problems of the same severity go to the area that stops
 * matches first: machines, then what runs on them, then the site.
 */
const AREA_PRIORITY: AreaKey[] = [
  "nodes",
  "servers",
  "gpus",
  "metrics",
  "database",
  "renders",
  "seasons",
  "plugins",
  "alerts",
  "settings",
];

export const AREA_ROUTES: Record<AreaKey, string> = {
  seasons: "/seasons",
  nodes: "/game-server-nodes",
  servers: "/dedicated-servers",
  gpus: "/gpu-nodes",
  renders: "/system-render-queue",
  metrics: "/system-metrics",
  database: "/database",
  alerts: "/system-alerts",
  plugins: "/plugins",
  settings: "/settings/application",
};

/** The left nav's words for each area. */
export const AREA_LABEL_KEYS: Record<AreaKey, string> = {
  seasons: "layouts.app_nav.administration.seasons",
  nodes: "layouts.app_nav.administration.game_server_nodes",
  servers: "layouts.app_nav.administration.dedicated_servers",
  gpus: "layouts.app_nav.administration.gpu_nodes",
  renders: "layouts.app_nav.system.render_queue",
  metrics: "layouts.app_nav.system.metrics",
  database: "layouts.app_nav.system.database",
  alerts: "layouts.app_nav.administration.alerts",
  plugins: "layouts.app_nav.platform.plugin_directory",
  settings: "layouts.app_nav.administration.app_settings",
};

const SEVERITY_RANK: Record<Severity, number> = {
  danger: 0,
  warning: 1,
  notice: 2,
};

/** Rows name at most this many nodes, servers or plugins; the rest is "+N". */
export const SUBJECTS_SHOWN = 3;

/** Past this many rows the list is grouped under area headings. */
export const GROUP_AFTER = 8;

export type Subject = {
  id: string;
  label: string;
  /** A short reading after the name: "93%", "1.4 → 1.5". */
  detail?: string;
  to: string | null;
};

export type Signal = {
  /** Stable across updates, so a row that stays put never re-enters. */
  key: string;
  area: AreaKey;
  severity: Severity;
  /** Full i18n key, translated with { count, ...params } and count. */
  message: string;
  count: number;
  params?: Record<string, string | number>;
  subjects: Subject[];
  /** Subjects beyond the ones shown. */
  more: number;
  /** Where "Open" goes. */
  to: string;
  /** A fix done in place instead of a link. */
  action?: "steam_accounts";
};

const MSG = "pages.admin_home.signal";

type Bucket = {
  severity: Severity;
  subjects: Array<Subject & { weight: number }>;
  params?: Record<string, string | number>;
};

function signal(
  area: AreaKey,
  key: string,
  bucket: Bucket,
  message: string,
  areaTo: string,
): Signal {
  const subjects = [...bucket.subjects].sort(
    (a, b) => b.weight - a.weight || a.label.localeCompare(b.label),
  );
  const shown = subjects
    .slice(0, SUBJECTS_SHOWN)
    .map(({ weight: _weight, ...subject }) => subject);
  return {
    key: `${area}:${key}`,
    area,
    severity: bucket.severity,
    message,
    count: subjects.length,
    params: bucket.params,
    subjects: shown,
    more: Math.max(0, subjects.length - SUBJECTS_SHOWN),
    // One thing wrong: go straight to it.
    to: subjects.length === 1 && subjects[0].to ? subjects[0].to : areaTo,
  };
}

function collect(buckets: Map<string, Bucket>, order: string[]) {
  return order.filter((key) => buckets.get(key)?.subjects.length);
}

function add(
  buckets: Map<string, Bucket>,
  key: string,
  severity: Severity,
  subject: Subject & { weight: number },
  params?: Record<string, string | number>,
) {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { severity, subjects: [], params };
    buckets.set(key, bucket);
  }
  if (!bucket.subjects.some((s) => s.id === subject.id)) {
    bucket.subjects.push(subject);
  }
}

const toneSeverity = (tone: AttentionItem["tone"]): Severity | null =>
  tone === "bad" ? "danger" : tone === "warn" ? "warning" : null;

// ---- Game Server Nodes ----

const NODE_ORDER = [
  "offline",
  "cs2_failed",
  "overprovisioned",
  "plugin_unsupported",
  "disk_full",
  "cpu_governor:danger",
  "not_ready_region",
  "not_ready_ports",
  "not_ready_cs2",
  "cs2_behind",
  "disk_filling",
  "cpu_slow",
  "cpu_governor:warning",
  "cpu_warning",
];

const NODE_MESSAGE: Record<string, string> = {
  "cpu_governor:danger": "cpu_governor",
  "cpu_governor:warning": "cpu_governor",
};

export const nodeLink = (id: string) =>
  `/game-server-nodes?node=${encodeURIComponent(id)}`;

/** GPU Nodes with that GPU's panel open. */
export const gpuNodeLink = (id: string) =>
  `${AREA_ROUTES.gpus}?node=${encodeURIComponent(id)}`;

/** System Metrics with its services narrowed to the node. */
export const metricsNodeLink = (id: string) =>
  `${AREA_ROUTES.metrics}?node=${encodeURIComponent(id)}`;

/** The database explorer with one statement's detail open. */
export const queryLink = (queryid: string) =>
  `${AREA_ROUTES.database}?tab=queries&query=${encodeURIComponent(queryid)}`;

/**
 * The nodes console's attention items, one row per kind of problem across the
 * fleet. A GPU-only node that drops offline is the GPU page's to report.
 */
export function nodeSignals(
  nodes: NodeLike[],
  context: IssueContext,
  nameOf: (node: NodeLike) => string,
): Signal[] {
  const buckets = new Map<string, Bucket>();

  for (const node of nodes) {
    const subject = (weight = 0, detail?: string) => ({
      id: node.id,
      label: nameOf(node),
      detail,
      to: nodeLink(node.id),
      weight,
    });

    for (const item of nodeAttention(node, context)) {
      const severity = toneSeverity(item.tone);
      if (!severity) {
        continue;
      }
      switch (item.key) {
        case "offline":
          if (!isGpuOnly(node)) {
            add(buckets, "offline", "danger", subject());
          }
          break;
        case "update_failed":
          add(buckets, "cs2_failed", "danger", subject());
          break;
        case "overprovisioned":
          add(buckets, "overprovisioned", "danger", subject());
          break;
        case "plugin_unsupported":
          add(buckets, "plugin_unsupported", "danger", subject());
          break;
        case "not_ready": {
          // One row per node, under the first thing it lacks -- the order a
          // fresh node is set up in.
          const need = (item.params?.needs as string[] | undefined)?.[0];
          if (need) {
            add(buckets, `not_ready_${need}`, "warning", subject());
          }
          break;
        }
        case "update_available":
          add(buckets, "cs2_behind", "warning", subject());
          break;
        case "cpu_frequency":
          add(buckets, "cpu_slow", "warning", subject());
          break;
        case "cpu_governor":
          add(buckets, `cpu_governor:${severity}`, severity, subject());
          break;
        case "disk": {
          const percent = Number(item.params?.percent ?? 0);
          add(
            buckets,
            severity === "danger" ? "disk_full" : "disk_filling",
            severity,
            subject(percent, `${Math.round(percent)}%`),
          );
          break;
        }
        case "cpu_warning":
          add(buckets, "cpu_warning", "warning", subject());
          break;
      }
    }
  }

  return collect(buckets, NODE_ORDER).map((key) =>
    signal(
      "nodes",
      key,
      buckets.get(key)!,
      `${MSG}.nodes.${NODE_MESSAGE[key] ?? key}`,
      AREA_ROUTES.nodes,
    ),
  );
}

/** Nodes the nodes console already flags for disk, so Metrics doesn't repeat it. */
export function diskFlaggedNodes(
  nodes: NodeLike[],
  context: IssueContext,
): Set<string> {
  return new Set(
    nodes
      .filter((node) =>
        nodeAttention(node, context).some((item) => item.key === "disk"),
      )
      .map((node) => node.id),
  );
}

// ---- GPU Nodes ----

type Account = {
  username: string;
  claims?: Array<{ purpose: string; node_id: string | null }>;
};

export type GpuInput = {
  /** game_server_nodes with gpu = true. */
  nodes: any[];
  accounts: Account[];
  /** Renders queued with no GPU yet. */
  waiting: number;
  nameOf: (node: any) => string;
};

export function gpuSignals(input: GpuInput): Signal[] {
  const { nodes, accounts, waiting, nameOf } = input;
  const out: Signal[] = [];
  const area = AREA_ROUTES.gpus;
  const health = poolHealth(nodes, accounts);

  if (health.key === "empty") {
    out.push({
      key: "gpus:pool_empty",
      area: "gpus",
      severity: "danger",
      message: `${MSG}.gpus.pool_empty`,
      count: 0,
      subjects: [],
      more: 0,
      to: area,
      action: "steam_accounts",
    });
  } else if (health.key === "short") {
    out.push({
      key: "gpus:pool_short",
      area: "gpus",
      severity: "warning",
      message: `${MSG}.gpus.pool_short`,
      count: health.short,
      subjects: [],
      more: 0,
      to: area,
      action: "steam_accounts",
    });
  }

  const buckets = new Map<string, Bucket>();
  const subject = (node: any) => ({
    id: node.id,
    label: nameOf(node),
    to: gpuNodeLink(node.id),
    weight: 0,
  });
  for (const node of nodes) {
    if (!node.enabled) {
      continue;
    }
    // A GPU that also hosts matches is reported with the other nodes.
    if (isOffline(node)) {
      if (isGpuOnly(node)) {
        add(buckets, "offline", "danger", subject(node));
      }
      continue;
    }
    if (node.status !== "Setup" && bakeFailed(node)) {
      add(buckets, "bake_failed", "warning", subject(node));
    }
  }
  for (const key of collect(buckets, ["offline", "bake_failed"])) {
    out.push(
      signal("gpus", key, buckets.get(key)!, `${MSG}.gpus.${key}`, area),
    );
  }

  // A queue that moves is not a problem; one nothing can take is. An empty
  // pool already says why.
  const renderers = nodes.filter(
    (node) =>
      node.enabled &&
      !isOffline(node) &&
      node.status !== "Setup" &&
      node.gpu_rendering_enabled,
  ).length;
  if (waiting > 0 && renderers === 0 && health.key !== "empty") {
    out.push({
      key: "gpus:renders_stuck",
      area: "gpus",
      severity: "warning",
      message: `${MSG}.gpus.renders_stuck`,
      count: waiting,
      subjects: [],
      more: 0,
      to: area,
    });
  }

  return out;
}

// ---- System Metrics ----

const METRIC_ORDER: MetricIssue["kind"][] = [
  "cpu",
  "memory",
  "disk",
  "gpu_util",
  "gpu_vram",
  "gpu_temp",
];

const gpuShort = (name?: string) =>
  (name ?? "").replace(/^NVIDIA\s+/, "").replace(/^GeForce\s+/, "");

/**
 * System Metrics' problem rows, one per metric and severity. CPU warnings are
 * the nodes console's (it reads the same field), and so is a disk it already
 * flags.
 */
export function metricSignals(
  issues: MetricIssue[],
  skipDiskFor: Set<string>,
  nodeName: (id: string) => string,
): Signal[] {
  const buckets = new Map<string, Bucket>();

  for (const issue of issues) {
    if (issue.kind === "cpu_warning") {
      continue;
    }
    if (issue.kind === "disk" && skipDiskFor.has(issue.nodeId)) {
      continue;
    }
    const severity: Severity =
      issue.severity === "critical" ? "danger" : "warning";
    const gpu = issue.gpuIndex != null;
    const value = issue.value ?? 0;
    add(
      buckets,
      `${issue.kind}:${severity}`,
      severity,
      {
        id: gpu ? `${issue.nodeId}|${issue.gpuIndex}` : issue.nodeId,
        label: gpu
          ? `${gpuShort(issue.gpuName) || `GPU ${issue.gpuIndex}`} · ${nodeName(issue.nodeId)}`
          : nodeName(issue.nodeId),
        detail: `${Math.round(value)}${issue.kind === "gpu_temp" ? " °C" : "%"}`,
        to: gpu ? gpuNodeLink(issue.nodeId) : nodeLink(issue.nodeId),
        weight: value,
      },
      { threshold: issue.threshold ?? 0 },
    );
  }

  const order = (["danger", "warning"] as Severity[]).flatMap((severity) =>
    METRIC_ORDER.map((kind) => `${kind}:${severity}`),
  );
  return collect(buckets, order).map((key) => {
    const bucket = buckets.get(key)!;
    const kind = key.split(":")[0];
    const sig = signal(
      "metrics",
      key,
      bucket,
      `${MSG}.metrics.${kind}`,
      AREA_ROUTES.metrics,
    );
    // One GPU: its panel, which charts it live. One node: Metrics, where its
    // row has the spark and the logs and the services on it are listed.
    const only = bucket.subjects.length === 1 ? bucket.subjects[0] : null;
    return {
      ...sig,
      to: !only
        ? AREA_ROUTES.metrics
        : kind.startsWith("gpu_")
          ? only.to!
          : metricsNodeLink(only.id),
    };
  });
}

// ---- Seasons ----

export function seasonSignals(
  seasons: Array<{
    id: string;
    number: number | null;
    needs_rebuild?: boolean;
  }>,
): Signal[] {
  return seasons
    .filter((season) => season.needs_rebuild)
    .map((season) => ({
      key: `seasons:rebuild:${season.id}`,
      area: "seasons" as const,
      severity: "warning" as const,
      message: `${MSG}.seasons.rebuild`,
      count: 1,
      params: { number: season.number ?? "?" },
      subjects: [],
      more: 0,
      to: AREA_ROUTES.seasons,
    }));
}

// ---- Render Queue ----

export type CoverageCounts = {
  version: number;
  total: number;
  current: number;
  missing: number;
  outdated: number;
};

export function renderSignals(input: {
  /** Clip renders and lineup renders that failed in the last day. */
  failed: number;
  coverage: CoverageCounts | null;
}): Signal[] {
  const out: Signal[] = [];
  const base = {
    area: "renders" as const,
    subjects: [],
    more: 0,
    to: AREA_ROUTES.renders,
  };

  if (input.failed > 0) {
    out.push({
      ...base,
      key: "renders:failed",
      severity: "warning",
      message: `${MSG}.renders.failed`,
      count: input.failed,
      to: `${AREA_ROUTES.renders}?tab=failed`,
    });
  }

  const coverage = input.coverage;
  if (!coverage) {
    return out;
  }
  if (coverage.missing > 0) {
    out.push({
      ...base,
      key: "renders:missing",
      severity: "warning",
      message: `${MSG}.renders.missing`,
      count: coverage.missing,
    });
  }
  if (coverage.outdated > 0) {
    out.push({
      ...base,
      key: "renders:outdated",
      severity: "warning",
      message: `${MSG}.renders.outdated`,
      count: coverage.outdated,
    });
  }
  return out;
}

// ---- Database ----

export function dbSignals(input: {
  queries: QueryStatLike[];
  active: ActiveQueryLike[];
  locks: Array<{ pid: number | null; granted: boolean | null }>;
  threshold: number;
}): Signal[] {
  const { queries, active, locks, threshold } = input;
  const out: Signal[] = [];
  const base = { area: "database" as const, subjects: [], more: 0 };
  const label = thresholdLabel(threshold);

  const waiting = lockWaitCount(locks);
  if (waiting > 0) {
    out.push({
      ...base,
      key: "database:locks",
      severity: "danger",
      message: `${MSG}.database.locks`,
      count: waiting,
      to: `${AREA_ROUTES.database}?tab=locks`,
    });
  }

  const slow = slowStats(queries, active, threshold);
  if (slow.run.length) {
    out.push({
      ...base,
      key: "database:running",
      severity: slow.run.some(
        (q) => runSeverity(q.duration_seconds, threshold) === "bad",
      )
        ? "danger"
        : "warning",
      message: `${MSG}.database.running`,
      count: slow.run.length,
      params: { threshold: label },
      // Connections lists the active queries, longest first.
      to: `${AREA_ROUTES.database}?tab=connections`,
    });
  }
  if (slow.avg.length) {
    out.push({
      ...base,
      key: "database:slow",
      severity: slow.avg.some((q) => q.mean_exec_time > threshold * 10)
        ? "danger"
        : "warning",
      message: `${MSG}.database.slow`,
      count: slow.avg.length,
      params: { threshold: label },
      to:
        slow.avg.length === 1
          ? queryLink(slow.avg[0].queryid)
          : `${AREA_ROUTES.database}?tab=queries&slow=1`,
    });
  }
  return out;
}

// ---- Alerts ----

export type AlertLike = {
  id: string;
  title?: string | null;
  message?: string | null;
  is_active: boolean;
  expires_at?: string | null;
};

/** Banners players see right now: switched on and not past their end. */
export function showingAlerts<T extends AlertLike>(alerts: T[], now: number) {
  return alerts.filter(
    (alert) =>
      alert.is_active &&
      (!alert.expires_at || Date.parse(alert.expires_at) > now),
  );
}

/** A banner is not a fault, so it is a notice: listed, never counted. */
export function alertSignals(alerts: AlertLike[], now: number): Signal[] {
  const showing = showingAlerts(alerts, now);
  if (!showing.length) {
    return [];
  }
  return [
    signal(
      "alerts",
      "showing",
      {
        severity: "notice",
        subjects: showing.map((alert) => ({
          id: alert.id,
          label: (alert.title || alert.message || "").trim(),
          to: null,
          weight: 0,
        })),
      },
      "pages.system_alerts.summary.showing",
      AREA_ROUTES.alerts,
    ),
  ].map((sig) => ({ ...sig, to: AREA_ROUTES.alerts }));
}

// ---- Plugins ----

export function pluginSignals(
  plugins: Array<DirectoryPlugin & { name?: string | null }>,
  desired: DesiredInstall[],
  runtime: string,
): Signal[] {
  const buckets = new Map<string, Bucket>();
  for (const plugin of plugins) {
    const state = pluginCardState(plugin, {
      runtime,
      desired: desired.find((row) => row.plugin_slug === plugin.slug) ?? null,
    });
    const subject = (detail?: string) => ({
      id: plugin.slug,
      label: plugin.name || plugin.slug,
      detail,
      to: `${AREA_ROUTES.plugins}/${plugin.slug}`,
      weight: 0,
    });
    if (state.key === "failed") {
      add(buckets, "failed", "danger", subject());
    } else if (state.key === "update") {
      add(
        buckets,
        "update",
        "warning",
        subject(`${state.current} → ${state.latest}`),
      );
    } else if (state.key === "manual") {
      add(buckets, "manual", "notice", subject());
    }
  }
  return collect(buckets, ["failed", "update", "manual"]).map((key) =>
    signal(
      "plugins",
      key,
      buckets.get(key)!,
      `${MSG}.plugins.${key}`,
      `${AREA_ROUTES.plugins}?tab=attention`,
    ),
  );
}

// ---- App Settings ----

/** Sections the settings rail marks "Not set up". Optional, so a notice. */
export function settingsSignals(
  sections: Array<{ path: string; label: string; attention: boolean }>,
): Signal[] {
  const missing = sections.filter((section) => section.attention);
  if (!missing.length) {
    return [];
  }
  return [
    signal(
      "settings",
      "not_set_up",
      {
        severity: "notice",
        subjects: missing.map((section) => ({
          id: section.path,
          label: section.label,
          to: section.path,
          weight: 0,
        })),
      },
      `${MSG}.settings.not_set_up`,
      AREA_ROUTES.settings,
    ),
  ];
}

// ---- Dedicated Servers ----

/** The server list's "attention" state, split by its two reasons. */
export function serverSignals(servers: any[], ctx: FleetContext): Signal[] {
  const buckets = new Map<string, Bucket>();
  for (const server of servers) {
    if (!server?.enabled || !server.connected) {
      continue;
    }
    const subject = {
      id: server.id,
      label: server.label || server.id,
      to: `${AREA_ROUTES.servers}/${server.id}`,
      weight: 0,
    };
    if (!server.rcon_status) {
      add(buckets, "no_rcon", "warning", subject);
    } else if (pluginOutdated(server, ctx)) {
      add(buckets, "plugin_outdated", "warning", subject);
    }
  }
  return collect(buckets, ["no_rcon", "plugin_outdated"]).map((key) =>
    signal(
      "servers",
      key,
      buckets.get(key)!,
      `${MSG}.servers.${key}`,
      AREA_ROUTES.servers,
    ),
  );
}

// ---- Ordering and grouping ----

/** Worst first; then the area that stops matches first; then as emitted. */
export function sortSignals(signals: Signal[]): Signal[] {
  return signals
    .map((sig, index) => ({ sig, index }))
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.sig.severity] - SEVERITY_RANK[b.sig.severity] ||
        AREA_PRIORITY.indexOf(a.sig.area) - AREA_PRIORITY.indexOf(b.sig.area) ||
        a.index - b.index,
    )
    .map(({ sig }) => sig);
}

export type SignalGroup = {
  /** Null when the list is short enough to read without headings. */
  area: AreaKey | null;
  worst: Severity;
  signals: Signal[];
};

/**
 * Up to GROUP_AFTER rows read as one list. Past that, rows gather under their
 * area, the area with the worst row first.
 */
export function groupSignals(
  sorted: Signal[],
  after = GROUP_AFTER,
): SignalGroup[] {
  if (!sorted.length) {
    return [];
  }
  if (sorted.length <= after) {
    return [{ area: null, worst: sorted[0].severity, signals: sorted }];
  }
  const groups: SignalGroup[] = [];
  for (const sig of sorted) {
    let group = groups.find((entry) => entry.area === sig.area);
    if (!group) {
      // Sorted input: an area's first row is its worst.
      group = { area: sig.area, worst: sig.severity, signals: [] };
      groups.push(group);
    }
    group.signals.push(sig);
  }
  return groups;
}

/** What the headline counts: notices are listed, not counted. */
export function needCount(signals: Signal[]): number {
  return signals.filter((sig) => sig.severity !== "notice").length;
}

export type AreaTone = "bad" | "warn" | "ok";

export function areaTone(signals: Signal[], area: AreaKey): AreaTone {
  const mine = signals.filter((sig) => sig.area === area);
  if (mine.some((sig) => sig.severity === "danger")) {
    return "bad";
  }
  if (mine.some((sig) => sig.severity === "warning")) {
    return "warn";
  }
  return "ok";
}
