import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type Ref,
} from "vue";
import { useI18n } from "vue-i18n";
import { $, order_by } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { utilityRendersInFlightBriefSubscription } from "~/graphql/utilityRenderGraphql";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useSystemAlertsStore } from "~/stores/SystemAlertsStore";
import { useGpuPoolStatusStore } from "~/stores/GpuPoolStatusStore";
import { useSettingsNav } from "~/composables/useSettingsNav";
import { settingsItemStatus } from "~/composables/useSettingsStatus";
import {
  fleetSummary,
  maxServers,
  nodeSettings,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";
import { poolHealth, rendersWaiting } from "~/components/gpu-nodes/gpuSessions";
import {
  collectIssues,
  fleetSummary as metricsSummary,
  isOnline,
  shortNodeId,
  type MetricsNode,
  type NodeStats,
} from "~/components/system-metrics/metricRules";
import {
  readSlowThreshold,
  slowStats,
  lockWaitCount,
  thresholdLabel,
  type ActiveQueryLike,
  type QueryStatLike,
} from "~/components/database/dbHealth";
import {
  isPluginInstalled,
  pluginCardState,
  type DesiredInstall,
} from "~/components/plugins/pluginDirectoryState";
import {
  activeSeason,
  daysUntil,
  seasonDay,
  seasonLengthDays,
  upcomingSeasons,
} from "~/components/seasons/seasonPhase";
import {
  AREAS,
  AREA_LABEL_KEYS,
  AREA_ROUTES,
  alertSignals,
  areaTone,
  dbSignals,
  diskFlaggedNodes,
  gpuSignals,
  metricSignals,
  needCount,
  nodeSignals,
  pluginSignals,
  renderSignals,
  seasonSignals,
  serverSignals,
  settingsSignals,
  showingAlerts,
  sortSignals,
  type AreaKey,
  type CoverageCounts,
  type Signal,
} from "~/components/admin-home/adminSignals";
import type { Tone } from "~/components/admin/tone";

const DAY_MS = 86_400_000;
// The cheap, live sources paint first; the ones that cost a round trip per
// node or a pass over the database wait until the page has settled.
const LAZY_MS = 1200;
const DB_POLL_MS = 60_000;
// A source that never answers must not hide the problems already found.
const READY_FALLBACK_MS = 8000;

type Sub = { unsubscribe: () => void };

export type AreaCard = {
  area: AreaKey;
  label: string;
  to: string;
  tone: Tone;
  toneLabel: string;
  /** Null shows "—" while the area is still being read. */
  value: number | string | null;
  aside?: string;
  sub?: string;
};

const nodesSubscription = generateSubscription({
  game_server_nodes: [
    { order_by: [{ label: order_by.asc }, { id: order_by.asc }] },
    {
      id: true,
      label: true,
      status: true,
      region: true,
      enabled: true,
      enabled_for_match_making: true,
      build_id: true,
      pin_build_id: true,
      plugin_supported: true,
      start_port_range: true,
      end_port_range: true,
      supports_cpu_pinning: true,
      update_status: true,
      update_failed_at: true,
      gpu: true,
      gpu_info: true,
      gpu_streaming_enabled: true,
      gpu_demos_enabled: true,
      gpu_rendering_enabled: true,
      shader_bake_status: true,
      cpu_sockets: true,
      cpu_cores_per_socket: true,
      cpu_threads_per_core: true,
      cpu_frequency_info: true,
      cpu_governor_info: true,
      cpu_warnings: true,
      offline_at: true,
      total_server_count: true,
      available_server_count: true,
      disk_used_percent: true,
      disk_available_gb: true,
    },
  ],
} as any);

const currentVersionSubscription = generateSubscription({
  game_versions: [{ where: { current: { _eq: true } } }, { build_id: true }],
} as any);

const serversSubscription = generateSubscription({
  servers: [
    {},
    {
      id: true,
      label: true,
      type: true,
      enabled: true,
      connected: true,
      rcon_status: true,
      plugin_version: true,
      plugin_runtime: true,
    },
  ],
} as any);

const accountsSubscription = generateSubscription({
  steam_accounts: [
    { order_by: [{ created_at: order_by.asc }] },
    {
      id: true,
      username: true,
      claims: [{}, { purpose: true, node_id: true, created_at: true }],
    },
  ],
} as any);

const seasonsSubscription = generateSubscription({
  seasons: [
    { order_by: [{ starts_at: order_by.desc }] },
    {
      id: true,
      number: true,
      starts_at: true,
      ends_at: true,
      needs_rebuild: true,
    },
  ],
} as any);

const pluginsSubscription = generateSubscription({
  game_plugins: [
    {},
    {
      slug: true,
      kind: true,
      name: true,
      install_state: true,
      installed_node_count: true,
      target_node_count: true,
      versions: [{}, { runtime: true, version: true, published_at: true }],
    },
  ],
} as any);

const desiredSubscription = generateSubscription({
  game_plugin_installs: [
    {},
    { plugin_slug: true, version: true, channel: true },
  ],
} as any);

// Row-level, like the render queue's own badge: in flight is bounded by the
// batches running.
const clipsInFlightSubscription = generateSubscription({
  clip_render_jobs: [
    { where: { status: { _in: ["queued", "rendering", "uploading"] } } },
    { id: true, status: true, game_server_node_id: true },
  ],
} as any);

// Failures are history, so only the last day counts; a clip marked done with
// no clip behind it lost its upload and is a failure too.
const clipsFailedSubscription = generateSubscription({
  clip_render_jobs: [
    {
      where: {
        last_status_at: { _gte: $("since", "timestamptz!") },
        _or: [
          { status: { _eq: "error" } },
          { status: { _eq: "done" }, clip_id: { _is_null: true } },
        ],
      },
      limit: 200,
    },
    { id: true },
  ],
} as any);

const lineupsFailedSubscription = generateSubscription({
  utility_lineup_renders: [
    {
      where: {
        last_status_at: { _gte: $("since", "timestamptz!") },
        status: { _eq: "error" },
      },
      limit: 200,
    },
    { id: true },
  ],
} as any);

// The counts only: the render queue's own query also lists up to 500 lineups.
const coverageQuery = generateQuery({
  utilityLineupRenderCoverage: [
    { map_name: $("map_name", "String") },
    {
      version: true,
      total: true,
      current: true,
      missing: true,
      outdated: true,
    },
  ],
} as any);

// No statement text: only what the slow and lock rules read.
const dbQuery = generateQuery({
  getQueryStats: [
    {},
    {
      queryid: true,
      calls: true,
      mean_exec_time: true,
      max_exec_time: true,
      total_exec_time: true,
    },
  ],
  getActiveQueries: [{}, { pid: true, state: true, duration_seconds: true }],
  getCurrentLocks: [{}, { pid: true, granted: true }],
} as any);

/**
 * Everything the admin home reads, live where the area is live. Collected
 * here so the page is layout only.
 */
export function useAdminHome() {
  const client = getGraphqlClient();
  const settings = useApplicationSettingsStore();
  const alertsStore = useSystemAlertsStore();
  const gpuPool = useGpuPoolStatusStore();
  const { t } = useI18n();
  const { items: settingsItems } = useSettingsNav();

  gpuPool.subscribeToPool();

  const now = ref(Date.now());
  const updatedAt = ref<number | null>(null);
  const heard = () => {
    updatedAt.value = Date.now();
  };

  const nodes = shallowRef<Array<NodeLike & MetricsNode & Record<string, any>>>(
    [],
  );
  const nodesLoaded = ref(false);
  const currentBuildId = ref<number | string | null>(null);
  const versionLoaded = ref(false);
  const servers = shallowRef<any[]>([]);
  const serversLoaded = ref(false);
  const accounts = shallowRef<any[]>([]);
  const accountsLoaded = ref(false);
  const seasons = shallowRef<any[]>([]);
  const seasonsLoaded = ref(false);
  const plugins = shallowRef<any[]>([]);
  const pluginsLoaded = ref(false);
  const desired = shallowRef<DesiredInstall[]>([]);
  const desiredLoaded = ref(false);
  const clipsInFlight = shallowRef<any[]>([]);
  const clipsInFlightLoaded = ref(false);
  const lineupsInFlight = shallowRef<any[]>([]);
  const lineupsInFlightLoaded = ref(false);
  const failedClips = ref(0);
  const failedClipsLoaded = ref(false);
  const failedLineups = ref(0);
  const failedLineupsLoaded = ref(false);
  const coverage = shallowRef<CoverageCounts | null>(null);
  const coverageLoaded = ref(false);
  const db = shallowRef<{
    queries: QueryStatLike[];
    active: ActiveQueryLike[];
    locks: Array<{ pid: number | null; granted: boolean | null }>;
  } | null>(null);
  const dbLoaded = ref(false);
  const dbThreshold = ref(readSlowThreshold());
  const metricsOn = ref(false);
  const nodeStats = ref<Record<string, NodeStats | null>>({});
  const forceReady = ref(false);

  /* ---------------- subscriptions ---------------- */

  const subs = new Set<Sub>();

  function live(
    query: unknown,
    next: (data: any) => void,
    options: {
      variables?: Record<string, unknown>;
      loaded?: Ref<boolean>;
    } = {},
  ): Sub {
    const sub = client
      .subscribe({ query: query as any, variables: options.variables })
      .subscribe({
        next: ({ data }: any) => {
          next(data);
          if (options.loaded) {
            options.loaded.value = true;
          }
          heard();
        },
        error: (error: unknown) => {
          console.error("[admin-home] subscription:", error);
          // Still counts as answered, so the verdict does not wait on it
          // forever.
          if (options.loaded) {
            options.loaded.value = true;
          }
        },
      });
    subs.add(sub);
    return sub;
  }

  // A feature switched off reads nothing and asks for nothing.
  function liveWhile(on: () => boolean, start: () => Sub[], reset: () => void) {
    let running: Sub[] = [];
    watch(
      on,
      (value) => {
        if (value && !running.length) {
          running = start();
        } else if (!value && running.length) {
          for (const sub of running) {
            sub.unsubscribe();
            subs.delete(sub);
          }
          running = [];
          reset();
        }
      },
      { immediate: true },
    );
  }

  live(
    nodesSubscription,
    (data) => {
      nodes.value = data?.game_server_nodes ?? [];
    },
    { loaded: nodesLoaded },
  );
  live(
    currentVersionSubscription,
    (data) => {
      currentBuildId.value = data?.game_versions?.[0]?.build_id ?? null;
    },
    { loaded: versionLoaded },
  );
  live(
    serversSubscription,
    (data) => {
      servers.value = data?.servers ?? [];
    },
    { loaded: serversLoaded },
  );
  live(
    accountsSubscription,
    (data) => {
      accounts.value = data?.steam_accounts ?? [];
    },
    { loaded: accountsLoaded },
  );
  live(
    clipsInFlightSubscription,
    (data) => {
      clipsInFlight.value = data?.clip_render_jobs ?? [];
    },
    { loaded: clipsInFlightLoaded },
  );
  live(
    utilityRendersInFlightBriefSubscription,
    (data) => {
      lineupsInFlight.value = data?.utility_lineup_renders ?? [];
    },
    { loaded: lineupsInFlightLoaded },
  );

  const since = new Date(Date.now() - DAY_MS).toISOString();
  live(
    clipsFailedSubscription,
    (data) => {
      failedClips.value = data?.clip_render_jobs?.length ?? 0;
    },
    { variables: { since }, loaded: failedClipsLoaded },
  );
  live(
    lineupsFailedSubscription,
    (data) => {
      failedLineups.value = data?.utility_lineup_renders?.length ?? 0;
    },
    { variables: { since }, loaded: failedLineupsLoaded },
  );

  const seasonsEnabled = computed(() => settings.seasonsEnabled);
  const pluginsEnabled = computed(() => settings.gamePluginsEnabled);

  liveWhile(
    () => seasonsEnabled.value,
    () => [
      live(
        seasonsSubscription,
        (data) => {
          seasons.value = data?.seasons ?? [];
        },
        { loaded: seasonsLoaded },
      ),
    ],
    () => {
      seasons.value = [];
      seasonsLoaded.value = false;
    },
  );

  liveWhile(
    () => pluginsEnabled.value,
    () => [
      live(
        pluginsSubscription,
        (data) => {
          plugins.value = data?.game_plugins ?? [];
        },
        { loaded: pluginsLoaded },
      ),
      live(
        desiredSubscription,
        (data) => {
          desired.value = data?.game_plugin_installs ?? [];
        },
        { loaded: desiredLoaded },
      ),
    ],
    () => {
      plugins.value = [];
      desired.value = [];
      pluginsLoaded.value = false;
      desiredLoaded.value = false;
    },
  );

  /* ---------------- lazy reads ---------------- */

  let coverageAsked = 0;
  async function refreshCoverage() {
    const mine = ++coverageAsked;
    try {
      const { data } = await client.query({
        query: coverageQuery as any,
        variables: { map_name: null },
        fetchPolicy: "network-only",
      });
      if (mine !== coverageAsked) {
        return;
      }
      coverage.value = (data as any)?.utilityLineupRenderCoverage ?? null;
      heard();
    } catch (error) {
      console.error("[admin-home] coverage:", error);
    } finally {
      if (mine === coverageAsked) {
        coverageLoaded.value = true;
      }
    }
  }

  async function pollDb() {
    if (typeof document !== "undefined" && document.hidden && db.value) {
      return;
    }
    dbThreshold.value = readSlowThreshold();
    try {
      const { data } = await client.query({
        query: dbQuery as any,
        fetchPolicy: "network-only",
        errorPolicy: "all",
      });
      const result = data as any;
      db.value = {
        queries: (result?.getQueryStats ?? []).filter(Boolean),
        active: (result?.getActiveQueries ?? []).filter(Boolean),
        locks: (result?.getCurrentLocks ?? []).filter(Boolean),
      };
      heard();
    } catch (error) {
      console.error("[admin-home] database:", error);
    } finally {
      dbLoaded.value = true;
    }
  }

  // A lineup render that starts or finishes changes coverage; bursts settle
  // into one ask.
  let coverageTimer: ReturnType<typeof setTimeout> | null = null;
  watch(
    () =>
      lineupsInFlight.value
        .map((row: any) => row.id)
        .sort()
        .join(","),
    (ids, before) => {
      if (!coverageLoaded.value || ids === before) {
        return;
      }
      if (coverageTimer) clearTimeout(coverageTimer);
      coverageTimer = setTimeout(() => void refreshCoverage(), 1500);
    },
  );

  let lazyTimer: ReturnType<typeof setTimeout> | null = null;
  let readyTimer: ReturnType<typeof setTimeout> | null = null;
  let dbTimer: ReturnType<typeof setInterval> | null = null;
  let ticker: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    ticker = setInterval(() => (now.value = Date.now()), 30_000);
    readyTimer = setTimeout(() => (forceReady.value = true), READY_FALLBACK_MS);
    lazyTimer = setTimeout(() => {
      metricsOn.value = true;
      void refreshCoverage();
      void pollDb();
      dbTimer = setInterval(() => void pollDb(), DB_POLL_MS);
    }, LAZY_MS);
  });

  onBeforeUnmount(() => {
    for (const sub of subs) {
      sub.unsubscribe();
    }
    subs.clear();
    coverageAsked++;
    for (const timer of [lazyTimer, readyTimer, coverageTimer]) {
      if (timer) clearTimeout(timer);
    }
    for (const timer of [dbTimer, ticker]) {
      if (timer) clearInterval(timer);
    }
  });

  /* ---------------- derived ---------------- */

  const nodesById = computed(
    () => new Map(nodes.value.map((node) => [node.id, node])),
  );
  const nodeName = (node: { id: string; label?: string | null }) =>
    node.label || shortNodeId(node.id);
  const nodeNameById = (id: string) => {
    const node = nodesById.value.get(id);
    return node ? nodeName(node) : shortNodeId(id);
  };

  const issueContext = computed(() => {
    const { pinning, disk } = nodeSettings(settings.settings);
    return {
      currentBuildId: currentBuildId.value,
      maxServers: (node: NodeLike) => maxServers(node, pinning),
      diskThresholds: disk,
    };
  });

  const gpuNodes = computed(() => nodes.value.filter((node) => node.gpu));
  const gpuHealth = computed(() => poolHealth(gpuNodes.value, accounts.value));

  // System Metrics' own reads: one getNodeStats poll per online node.
  const onlineNodes = computed(() => nodes.value.filter(isOnline));
  const statNodeIds = computed(() =>
    metricsOn.value ? onlineNodes.value.map((node) => node.id) : [],
  );
  function onNodeStats(id: string, stats: NodeStats | null) {
    nodeStats.value = { ...nodeStats.value, [id]: stats };
    heard();
  }
  // The verdict waits for every online node, so it never calls a node fine
  // before it has read it.
  const metricsReady = computed(
    () =>
      metricsOn.value &&
      nodesLoaded.value &&
      onlineNodes.value.every((node) => node.id in nodeStats.value),
  );
  const metricIssues = computed(() =>
    metricsReady.value
      ? collectIssues(onlineNodes.value, nodeStats.value, nodeName)
      : [],
  );

  const settingsSections = computed(() =>
    settingsItems.value.map((item) => ({
      path: item.path,
      label: item.label,
      attention: settingsItemStatus(item, {
        settings: settings.settings,
        loaded: settings.settingsLoaded,
        jobs: {},
      }).attention,
    })),
  );

  const fleetCtx = computed(() => ({
    currentPluginVersion: settings.currentPluginVersion,
    pluginRuntime: settings.gameServerPluginRuntime,
  }));

  const signals = computed<Signal[]>(() => {
    const list: Signal[] = [];
    if (nodesLoaded.value) {
      list.push(...nodeSignals(nodes.value, issueContext.value, nodeName));
    }
    if (nodesLoaded.value && accountsLoaded.value) {
      list.push(
        ...gpuSignals({
          nodes: gpuNodes.value,
          accounts: accounts.value,
          waiting: rendersWaiting(
            clipsInFlight.value.filter((job: any) => job.status === "queued")
              .length,
            clipsInFlight.value,
          ),
          nameOf: nodeName,
        }),
      );
    }
    list.push(...serverSignals(servers.value, fleetCtx.value));
    if (metricsReady.value) {
      list.push(
        ...metricSignals(
          metricIssues.value,
          diskFlaggedNodes(nodes.value, issueContext.value),
          nodeNameById,
        ),
      );
    }
    if (db.value) {
      list.push(...dbSignals({ ...db.value, threshold: dbThreshold.value }));
    }
    list.push(
      ...renderSignals({
        failed: failedClips.value + failedLineups.value,
        coverage: coverage.value,
      }),
    );
    if (seasonsEnabled.value) {
      list.push(...seasonSignals(seasons.value));
    }
    if (pluginsEnabled.value) {
      list.push(
        ...pluginSignals(
          plugins.value,
          desired.value,
          settings.gameServerPluginRuntime,
        ),
      );
    }
    list.push(...alertSignals(alertsStore.alerts, now.value));
    list.push(...settingsSignals(settingsSections.value));
    return sortSignals(list);
  });

  // An area is called fine only once everything its rules read has answered.
  const areaRead = computed<Record<AreaKey, boolean>>(() => ({
    seasons: !seasonsEnabled.value || seasonsLoaded.value,
    nodes: nodesLoaded.value && versionLoaded.value && settings.settingsLoaded,
    servers: serversLoaded.value && settings.settingsLoaded,
    gpus:
      nodesLoaded.value && accountsLoaded.value && clipsInFlightLoaded.value,
    renders:
      clipsInFlightLoaded.value &&
      lineupsInFlightLoaded.value &&
      failedClipsLoaded.value &&
      failedLineupsLoaded.value &&
      coverageLoaded.value,
    metrics: metricsReady.value,
    database: dbLoaded.value,
    // Banners are notices: they never change the verdict.
    alerts: true,
    plugins:
      !pluginsEnabled.value || (pluginsLoaded.value && desiredLoaded.value),
    settings: settings.settingsLoaded,
  }));

  // "All clear" waits for every area. A source that never answers only holds
  // that back: the problems already found still show.
  const ready = computed(
    () =>
      AREAS.every((area) => areaRead.value[area]) ||
      (forceReady.value && needCount(signals.value) > 0),
  );

  /* ---------------- area cards ---------------- */

  const toneLabel = (tone: Tone) =>
    tone === "bad"
      ? t("system_alerts.types.critical")
      : tone === "warn"
        ? t("system_alerts.types.warning")
        : tone === "ok"
          ? t("pages.admin_home.card.no_problems")
          : t("pages.admin_home.card.checking");

  function card(
    area: AreaKey,
    body: Omit<AreaCard, "area" | "label" | "to" | "tone" | "toneLabel">,
    state: "read" | "checking" | "empty" = "read",
  ): AreaCard {
    const tone: Tone =
      state === "read" && areaRead.value[area]
        ? areaTone(signals.value, area)
        : "off";
    return {
      area,
      label: t(AREA_LABEL_KEYS[area]),
      to: AREA_ROUTES[area],
      tone,
      toneLabel:
        state === "empty" ? t("pages.admin_home.card.none") : toneLabel(tone),
      ...body,
    };
  }

  const checking = () => ({
    value: null,
    sub: t("pages.admin_home.card.checking"),
  });

  const cards = computed<AreaCard[]>(() => {
    const out: AreaCard[] = [];
    const none = () => ({ value: t("pages.admin_home.card.none") });

    if (seasonsEnabled.value) {
      if (!seasonsLoaded.value) {
        out.push(card("seasons", checking(), "checking"));
      } else {
        const active = activeSeason(seasons.value, now.value);
        const next = upcomingSeasons(seasons.value, now.value)[0];
        if (active) {
          const total = seasonLengthDays(active);
          const day = seasonDay(active, now.value);
          out.push(
            card("seasons", {
              value: t("pages.seasons.season_number", {
                number: active.number ?? "?",
              }),
              sub: total
                ? t("pages.seasons.hero.day_of", { day, total })
                : t("event.header.day", { day }),
            }),
          );
        } else {
          const days = next ? daysUntil(next.starts_at, now.value) : 0;
          out.push(
            card("seasons", {
              value: t("pages.seasons.off.title"),
              sub: next
                ? t(
                    "pages.admin_home.card.season_starts",
                    { number: next.number ?? "?", count: days },
                    days,
                  )
                : t("pages.seasons.off.nothing"),
            }),
          );
        }
      }
    }

    if (!nodesLoaded.value) {
      out.push(card("nodes", checking(), "checking"));
    } else if (!nodes.value.length) {
      out.push(card("nodes", none(), "empty"));
    } else {
      const summary = fleetSummary(nodes.value, issueContext.value);
      out.push(
        card("nodes", {
          value: summary.online,
          aside: t("pages.admin_home.card.of_online", { total: summary.total }),
          sub: summary.capacity
            ? t("pages.admin_home.card.servers_free", {
                free: summary.free,
                capacity: summary.capacity,
              })
            : undefined,
        }),
      );
    }

    const enabledServers = servers.value.filter((server) => server.enabled);
    if (!serversLoaded.value) {
      out.push(card("servers", checking(), "checking"));
    } else if (!enabledServers.length) {
      out.push(card("servers", none(), "empty"));
    } else {
      const connected = enabledServers.filter(
        (server) => server.connected,
      ).length;
      const offline = enabledServers.length - connected;
      out.push(
        card("servers", {
          value: connected,
          aside: t("pages.admin_home.card.of_connected", {
            total: enabledServers.length,
          }),
          sub: offline
            ? t("pages.admin_home.card.offline", { count: offline }, offline)
            : undefined,
        }),
      );
    }

    const enabledGpus = gpuNodes.value.filter((node) => node.enabled).length;
    if (!nodesLoaded.value || !accountsLoaded.value) {
      out.push(card("gpus", checking(), "checking"));
    } else if (!gpuNodes.value.length) {
      out.push(card("gpus", none(), "empty"));
    } else {
      const status = gpuPool.status;
      const health = gpuHealth.value;
      out.push(
        card("gpus", {
          value: status ? status.free_gpu_nodes : null,
          aside: t("pages.admin_home.card.of_free", {
            total: status ? status.total_gpu_nodes : enabledGpus,
          }),
          sub: t("pages.admin_home.card.accounts_free", {
            free: health.free,
            total: health.total,
          }),
        }),
      );
    }

    const inFlight = clipsInFlight.value.length + lineupsInFlight.value.length;
    out.push(
      card("renders", {
        value: inFlight,
        aside: t("pages.admin_home.card.in_flight"),
        sub: coverage.value
          ? t("pages.admin_home.card.previews_current", {
              current: coverage.value.current,
              total: coverage.value.total,
            })
          : coverageLoaded.value
            ? undefined
            : t("pages.admin_home.card.checking"),
      }),
    );

    if (!metricsReady.value) {
      out.push(card("metrics", checking(), "checking"));
    } else {
      const summary = metricsSummary(
        nodes.value,
        nodeStats.value,
        metricIssues.value,
      );
      out.push(
        summary.online
          ? card("metrics", {
              value: summary.fine,
              aside: t("pages.admin_home.card.of_within", {
                total: summary.online,
              }),
              sub: summary.gpuOnline
                ? t("pages.system_metrics.attention.gpus_fine", {
                    fine: summary.gpuFine,
                    total: summary.gpuOnline,
                  })
                : undefined,
            })
          : card(
              "metrics",
              {
                value: null,
                sub: t("pages.admin_home.card.no_online"),
              },
              "empty",
            ),
      );
    }

    if (!db.value) {
      out.push(card("database", checking(), "checking"));
    } else {
      const slow = slowStats(db.value.queries, [], dbThreshold.value).avg
        .length;
      const waiting = lockWaitCount(db.value.locks);
      out.push(
        card("database", {
          value: slow,
          aside: t("pages.admin_home.card.slow_statements", {}, slow),
          sub: waiting
            ? t(
                "pages.admin_home.signal.database.locks",
                { count: waiting },
                waiting,
              )
            : t("pages.admin_home.card.threshold", {
                threshold: thresholdLabel(dbThreshold.value),
              }),
        }),
      );
    }

    const showing = showingAlerts(alertsStore.alerts, now.value).length;
    out.push(
      card("alerts", {
        value: showing,
        aside: t("pages.admin_home.card.banners_showing", {}, showing),
      }),
    );

    if (pluginsEnabled.value) {
      if (!pluginsLoaded.value) {
        out.push(card("plugins", checking(), "checking"));
      } else {
        const runtime = settings.gameServerPluginRuntime;
        const installed = plugins.value.filter((plugin) =>
          isPluginInstalled(plugin, false),
        ).length;
        const updates = plugins.value.filter(
          (plugin) =>
            pluginCardState(plugin, {
              runtime,
              desired:
                desired.value.find((row) => row.plugin_slug === plugin.slug) ??
                null,
            }).key === "update",
        ).length;
        out.push(
          card("plugins", {
            value: installed,
            aside: t("pages.admin_home.card.installed"),
            sub: updates
              ? t("pages.admin_home.card.updates", { count: updates }, updates)
              : installed
                ? t("pages.admin_home.card.up_to_date")
                : undefined,
          }),
        );
      }
    }

    const notSetUp = settingsSections.value.filter(
      (section) => section.attention,
    ).length;
    out.push(
      card("settings", {
        value: notSetUp || t("pages.admin_home.card.all_set_up"),
        aside: notSetUp
          ? t("layouts.application_settings.status.not_set_up")
          : undefined,
      }),
    );

    return out;
  });

  return {
    ready,
    signals,
    cards,
    updatedAt,
    // Metrics reads, rendered by the page as NodeStatsPoller components.
    statNodeIds,
    onNodeStats,
    // The Steam account sheet the pool rows open.
    accounts,
    accountsLoaded,
    gpuNodes,
    gpuHealth,
  };
}
