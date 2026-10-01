<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import gql from "graphql-tag";
import {
  RefreshCw,
  Users,
  TriangleAlert,
  Download,
  Eye,
  EyeOff,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import SanctionPlayer from "~/components/SanctionPlayer.vue";
import PlayerSanctions from "~/components/PlayerSanctions.vue";
import KickPlayer from "~/components/KickPlayer.vue";
import ClipBoard from "~/components/ClipBoard.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import CommunityPlayerCell from "~/components/community/CommunityPlayerCell.vue";
import CommunityPlayerMenu from "~/components/community/CommunityPlayerMenu.vue";
import CommunityIp from "~/components/community/CommunityIp.vue";
import {
  COMMUNITY_OPTIONAL,
  SERVER_ROSTER_SUBSCRIPTION,
} from "~/graphql/communityGraphql";
import { ipPeers, sinceSeconds } from "~/utilities/communityStats";
import { useCommunityFormat } from "~/composables/useCommunityFormat";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { effectivePluginRuntime } from "~/constants/rconCommands";
import {
  PLAYER_MANAGEMENT_CONFIG_PATHS,
  playerManagementConfig,
  playerManagementDownloadUrl,
} from "~/constants/gameServerReleases";

// Only an administrator can read the api password, so only they get the
// install steps; everyone else is told the plugin is missing and nothing more.
const props = defineProps<{
  serverId: string;
  gameServerNodeId?: string | null;
  apiPassword?: string | null;
  pluginRuntime?: string | null;
  online?: boolean;
}>();

const emit = defineEmits<{ (e: "roster-change"): void }>();

const { t } = useI18n();
const format = useCommunityFormat();
const nuxtApp = useNuxtApp();
const authStore = useAuthStore();
const applicationSettings = useApplicationSettingsStore();

// The plugin syncs every 30s and the api keeps at most one heartbeat a minute.
const PLUGIN_STALE_MS = 3 * 60 * 1000;

// Same window the api's sweep uses before it closes a silent server's
// sessions: past it the plugin roster is history, not the server.
const ROSTER_STALE_MS = 3 * 60 * 1000;

// How long the roster subscription gets to answer before RCON polling starts
// anyway, so a dead websocket can't leave the card empty.
const ROSTER_DECIDE_MS = 5 * 1000;

const RUNTIME_LABELS: Record<string, string> = {
  swiftlys2: "SwiftlyS2",
  counterstrikesharp: "CounterStrikeSharp",
};

const pluginSubscription = gql`
  subscription ServerPlayerManagementPlugin($serverId: uuid!) {
    servers_by_pk(id: $serverId) {
      id
      type
      game
      is_dedicated
      player_management_version
      player_management_runtime
      player_management_seen_at
    }
  }
`;

const pluginState = ref<{
  type: string;
  game: string;
  is_dedicated: boolean;
  player_management_version: string | null;
  player_management_runtime: string | null;
  player_management_seen_at: string | null;
} | null>(null);
const now = ref(Date.now());
const showConfig = ref(false);
const selectedRuntime = ref<string | null>(null);
let pluginSub: { unsubscribe: () => void } | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

// A Ranked server's sanctions ride its match payload and a Practice server has
// no public players, so only community servers need the plugin.
const isCommunityServer = computed(() => {
  const server = pluginState.value;

  return (
    !!server &&
    server.is_dedicated &&
    server.game !== "csgo" &&
    server.type !== "Ranked" &&
    server.type !== "Practice"
  );
});

const pluginActive = computed(() => {
  const seenAt = pluginState.value?.player_management_seen_at;

  return !!seenAt && now.value - new Date(seenAt).getTime() < PLUGIN_STALE_MS;
});

const pluginVersionLabel = computed(() => {
  const version = pluginState.value?.player_management_version;

  return version && /^\d/.test(version) ? `v${version}` : version;
});

const runtimeLabel = computed(() => {
  const runtime = pluginState.value?.player_management_runtime;

  return runtime ? RUNTIME_LABELS[runtime] : null;
});

// An offline server can't check in either way, and the status pill already
// says it is offline, so a missing plugin is only worth flagging once RCON is up.
const showPluginStatus = computed(
  () => isCommunityServer.value && (pluginActive.value || props.online),
);

const pluginStatusLabel = computed(() =>
  t(
    pluginActive.value
      ? "pages.dedicated_servers.detail.player_management_plugin.active"
      : "pages.dedicated_servers.detail.player_management_plugin.not_detected_title",
  ),
);

const canInstall = computed(
  () => props.gameServerNodeId === null && authStore.isAdmin,
);

const notDetectedMessage = computed(() => {
  if (props.gameServerNodeId === null) {
    return t(
      "pages.dedicated_servers.detail.player_management_plugin.not_detected_external",
    );
  }

  if (props.gameServerNodeId) {
    return t(
      "pages.dedicated_servers.detail.player_management_plugin.not_detected_node",
    );
  }

  return t(
    "pages.dedicated_servers.detail.player_management_plugin.not_detected",
  );
});

const installRuntime = computed({
  get: () =>
    selectedRuntime.value ??
    effectivePluginRuntime(
      pluginState.value?.player_management_runtime ?? props.pluginRuntime,
      applicationSettings.gameServerPluginRuntime,
    ),
  set: (runtime: string) => {
    selectedRuntime.value = runtime;
  },
});

const downloadUrl = computed(() =>
  playerManagementDownloadUrl(
    installRuntime.value,
    applicationSettings.latestPluginVersion(installRuntime.value),
  ),
);

const downloadName = computed(() => {
  const file = downloadUrl.value.split("/").pop() ?? "";

  return file.endsWith(".zip") ? file : null;
});

const configPath = computed(
  () => PLAYER_MANAGEMENT_CONFIG_PATHS[installRuntime.value],
);

const config = computed(() =>
  playerManagementConfig(installRuntime.value, {
    apiDomain: `https://${useRuntimeConfig().public.apiDomain}`,
    serverId: props.serverId,
    apiPassword: props.apiPassword,
  }),
);

const loading = ref(false);
const roster = ref<Array<{ steam_id: string; name: string }>>([]);
const registeredPlayers = ref<Record<string, any>>({});
let pollTimer: ReturnType<typeof setInterval> | null = null;

type RosterSession = {
  id: string | number;
  player_steam_id: string | number;
  name: string | null;
  ip: string | null;
  kills: number;
  deaths: number;
  started_at: string;
  player: Record<string, any> | null;
};

type RosterRow = {
  steamId: string;
  name: string | null;
  ip: string | null;
  startedAt: string | null;
  player: Record<string, any> | null;
  displayName: string;
  target: Record<string, any>;
};

const liveRoster = ref<{
  reported_at: string;
  sessions: RosterSession[];
} | null>(null);
const rosterResolved = ref(false);
const listReady = ref(false);
const freshAt = ref<number | null>(null);
const historyTarget = ref<Record<string, any> | null>(null);
const historyOpen = ref(false);
let rosterSub: { unsubscribe: () => void } | null = null;
let rosterDecideTimer: ReturnType<typeof setTimeout> | null = null;
let rosterSignature: string | null = null;
let lastReportedAt: string | null = null;

// Measured on this browser's clock from the last push that carried a new
// reported_at, so a skewed client clock can't flip the card between modes.
const rosterLive = computed(
  () => freshAt.value !== null && now.value - freshAt.value < ROSTER_STALE_MS,
);

function toRow(
  steamId: string,
  name: string | null,
  player: Record<string, any> | null,
  ip: string | null,
  startedAt: string | null,
): RosterRow {
  const displayName =
    (player?.is_registered ? player.name : null) ||
    name ||
    player?.name ||
    steamId;

  return {
    steamId,
    name,
    ip,
    startedAt,
    player,
    displayName,
    target: player
      ? { ...player, name: displayName }
      : { steam_id: steamId, name: displayName },
  };
}

const liveRows = computed(() =>
  (liveRoster.value?.sessions ?? []).map((session) =>
    toRow(
      String(session.player_steam_id),
      session.name,
      session.player
        ? { ...session.player, steam_id: String(session.player.steam_id) }
        : null,
      session.ip,
      session.started_at,
    ),
  ),
);

const pollRows = computed(() =>
  roster.value.map((entry) =>
    toRow(
      String(entry.steam_id),
      entry.name,
      registeredPlayers.value[entry.steam_id] ?? null,
      null,
      null,
    ),
  ),
);

const rows = computed(() =>
  rosterLive.value ? liveRows.value : pollRows.value,
);

const livePeers = computed(() =>
  ipPeers(
    liveRows.value,
    (row) => row.steamId,
    (row) => row.ip,
  ),
);

function peerNames(steamId: string) {
  return (livePeers.value.get(steamId) ?? []).map((row) => row.displayName);
}

const showPollNotice = computed(
  () =>
    isCommunityServer.value &&
    !rosterLive.value &&
    (pluginActive.value || props.online),
);

function applyRoster(next: typeof liveRoster.value) {
  const reportedAt = next?.reported_at ?? null;
  const pushedAt = Date.now();

  if (!reportedAt) {
    freshAt.value = null;
  } else if (lastReportedAt === null) {
    const age = pushedAt - Date.parse(reportedAt);

    freshAt.value = age < ROSTER_STALE_MS ? pushedAt - Math.max(0, age) : null;
  } else if (reportedAt !== lastReportedAt) {
    freshAt.value = pushedAt;
  }

  lastReportedAt = reportedAt;
  now.value = pushedAt;
  liveRoster.value = next;
  rosterResolved.value = true;

  if (rosterLive.value) {
    listReady.value = true;
  }

  const signature = (next?.sessions ?? [])
    .map((session) => String(session.id))
    .sort()
    .join(",");

  if (rosterSignature !== null && signature !== rosterSignature) {
    emit("roster-change");
  }

  rosterSignature = signature;
}

// Carries the last plugin roster over while RCON answers, so the rows stay
// put instead of leaving and re-entering when the card changes mode.
function seedFromLiveRoster() {
  const sessions = liveRoster.value?.sessions ?? [];

  if (sessions.length === 0) {
    return;
  }

  const registered: Record<string, any> = {};

  for (const session of sessions) {
    if (session.player) {
      registered[String(session.player_steam_id)] = session.player;
    }
  }

  roster.value = sessions.map((session) => ({
    steam_id: String(session.player_steam_id),
    name: session.name ?? String(session.player_steam_id),
  }));
  registeredPlayers.value = registered;
}

function onRowAction() {
  if (!rosterLive.value) {
    void fetchRoster();
  }
}

function openHistory(target: Record<string, any>) {
  historyTarget.value = target;
  historyOpen.value = true;
}

const playersQuery = gql`
  query ServerManagementPlayers($serverId: String!) {
    getDedicatedServerPlayers(serverId: $serverId) {
      steam_id
      name
    }
  }
`;

const registeredQuery = gql`
  query RegisteredServerPlayers($steamIds: [bigint!]) {
    players(where: { steam_id: { _in: $steamIds } }) {
      steam_id
      name
      avatar_url
      is_registered
      is_banned
      is_muted
      is_gagged
      vac_banned
      vac_ban_count
      game_ban_count
      days_since_last_ban
    }
  }
`;

function getErrorMessage(error: any) {
  return (
    error?.graphQLErrors?.[0]?.message ||
    error?.networkError?.result?.errors?.[0]?.message ||
    error?.message ||
    t("common.error")
  );
}

async function fetchRoster() {
  if (loading.value) {
    return;
  }

  loading.value = true;

  try {
    const { data } = await nuxtApp.$apollo.defaultClient.query({
      query: playersQuery,
      variables: { serverId: props.serverId },
      fetchPolicy: "network-only",
    });

    const fetched: Array<{ steam_id: string; name: string }> =
      data?.getDedicatedServerPlayers ?? [];
    const map: Record<string, any> = {};

    if (fetched.length > 0) {
      const { data: registeredData } =
        await nuxtApp.$apollo.defaultClient.query({
          query: registeredQuery,
          variables: { steamIds: fetched.map((player) => player.steam_id) },
          fetchPolicy: "network-only",
        });

      for (const player of registeredData?.players ?? []) {
        map[`${player.steam_id}`] = player;
      }
    }

    roster.value = fetched;
    registeredPlayers.value = map;
  } catch (error: any) {
    const message = getErrorMessage(error);
    // RCON being unavailable is already surfaced by the server status + RCON
    // console (both read "disconnected"), so don't spam a toast for it —
    // especially since this fetch polls every 30s. Just clear the roster.
    if (/unable to connect to rcon/i.test(message)) {
      roster.value = [];
      registeredPlayers.value = {};
    } else {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: message,
      });
    }
  } finally {
    loading.value = false;
    listReady.value = true;
  }
}

function startPolling() {
  if (pollTimer) {
    return;
  }

  void fetchRoster();
  pollTimer = setInterval(() => {
    void fetchRoster();
  }, 30 * 1000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

watch(
  () => rosterResolved.value && !rosterLive.value,
  (shouldPoll) => {
    if (shouldPoll) {
      seedFromLiveRoster();
      startPolling();
    } else {
      stopPolling();
    }
  },
);

onMounted(() => {
  rosterSub = getGraphqlClient()
    .subscribe({
      query: SERVER_ROSTER_SUBSCRIPTION,
      variables: { serverId: props.serverId },
      context: COMMUNITY_OPTIONAL,
    })
    .subscribe({
      next: ({ data }: any) => {
        applyRoster(data?.server_rosters_by_pk ?? null);
      },
      error: () => {
        liveRoster.value = null;
        rosterResolved.value = true;
      },
    });

  rosterDecideTimer = setTimeout(() => {
    rosterResolved.value = true;
  }, ROSTER_DECIDE_MS);

  // Optional: the columns only exist once the api has migrated, and until then
  // the card simply says nothing about the plugin.
  pluginSub = getGraphqlClient()
    .subscribe({
      query: pluginSubscription,
      variables: { serverId: props.serverId },
      context: { optional: true },
    })
    .subscribe({
      next: ({ data }: any) => {
        pluginState.value = data?.servers_by_pk ?? null;
      },
      error: () => {
        pluginState.value = null;
      },
    });

  clockTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  stopPolling();

  if (clockTimer) {
    clearInterval(clockTimer);
  }

  if (rosterDecideTimer) {
    clearTimeout(rosterDecideTimer);
  }

  pluginSub?.unsubscribe();
  rosterSub?.unsubscribe();
});
</script>

<template>
  <div class="rounded-md border p-4">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <Users class="h-4 w-4 text-muted-foreground" />
        <h3 class="text-lg font-semibold">
          {{ $t("pages.dedicated_servers.detail.player_management") }}
        </h3>
        <Badge variant="secondary">{{ rows.length }}</Badge>
      </div>
      <div class="flex items-center gap-2">
        <Popover
          v-if="showPluginStatus"
          @update:open="(open: boolean) => !open && (showConfig = false)"
        >
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              :size="pluginActive ? 'default' : 'icon'"
              :aria-label="pluginStatusLabel"
              :class="
                pluginActive
                  ? 'gap-2 px-3 font-mono text-xs font-normal text-muted-foreground'
                  : 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)] hover:text-[hsl(var(--tac-amber))]'
              "
            >
              <template v-if="pluginActive">
                <span class="h-2 w-2 shrink-0 rounded-full bg-success" />
                {{ pluginVersionLabel }}
                <span v-if="runtimeLabel" class="max-sm:hidden">
                  · {{ runtimeLabel }}
                </span>
              </template>
              <TriangleAlert v-else />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            :collision-padding="16"
            class="max-h-[var(--reka-popover-content-available-height)] w-[26rem] max-w-[calc(100vw-2rem)] overflow-y-auto p-0"
          >
            <div class="space-y-1.5 p-4">
              <div
                class="flex items-center gap-2 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em]"
                :class="
                  pluginActive ? 'text-success' : 'text-[hsl(var(--tac-amber))]'
                "
              >
                <span
                  v-if="pluginActive"
                  class="h-1.5 w-1.5 shrink-0 rounded-full bg-success"
                />
                <TriangleAlert v-else class="h-3.5 w-3.5 shrink-0" />
                {{ pluginStatusLabel }}
              </div>
              <template v-if="pluginActive">
                <p class="font-mono text-xs text-muted-foreground">
                  {{ pluginVersionLabel }}
                  <template v-if="runtimeLabel"> · {{ runtimeLabel }}</template>
                </p>
                <p
                  v-if="pluginState?.player_management_seen_at"
                  class="text-xs text-muted-foreground"
                >
                  {{
                    $t(
                      "pages.dedicated_servers.detail.player_management_plugin.last_check_in",
                    )
                  }}
                  <TimeAgo
                    :date="pluginState.player_management_seen_at"
                    hide-icon
                    class="text-foreground"
                  />
                </p>
              </template>
              <p v-else class="text-sm text-muted-foreground">
                {{ notDetectedMessage }}
              </p>
            </div>

            <div v-if="canInstall" class="border-t border-border/60 p-4">
              <div
                class="mb-4 inline-flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground"
              >
                <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]" />
                {{
                  $t(
                    "pages.dedicated_servers.detail.player_management_plugin.install_steps",
                  )
                }}
              </div>
              <ol class="space-y-4">
                <li class="flex gap-3">
                  <span
                    class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border/60 font-mono text-[0.65rem] text-muted-foreground"
                    >1</span
                  >
                  <div class="min-w-0 flex-1 space-y-3">
                    <p class="text-sm">
                      {{
                        $t(
                          "pages.dedicated_servers.detail.player_management_plugin.step_download",
                        )
                      }}
                    </p>
                    <Tabs v-model="installRuntime" :scroll-floor="false">
                      <TabsList>
                        <TabsTrigger value="swiftlys2">SwiftlyS2</TabsTrigger>
                        <TabsTrigger value="counterstrikesharp">
                          CounterStrikeSharp
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <Button as-child variant="outline" size="sm">
                      <a
                        :href="downloadUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download class="mr-2 h-4 w-4" />
                        <span v-if="downloadName" class="font-mono text-xs">
                          {{ downloadName }}
                        </span>
                        <template v-else>{{ $t("common.download") }}</template>
                      </a>
                    </Button>
                  </div>
                </li>
                <li class="flex gap-3">
                  <span
                    class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border/60 font-mono text-[0.65rem] text-muted-foreground"
                    >2</span
                  >
                  <p class="flex-1 text-sm">
                    {{
                      $t(
                        "pages.dedicated_servers.detail.player_management_plugin.step_extract",
                      )
                    }}
                  </p>
                </li>
                <li class="flex gap-3">
                  <span
                    class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border/60 font-mono text-[0.65rem] text-muted-foreground"
                    >3</span
                  >
                  <div class="min-w-0 flex-1 space-y-2">
                    <p class="text-sm">
                      {{
                        $t(
                          "pages.dedicated_servers.detail.player_management_plugin.step_config",
                        )
                      }}
                    </p>
                    <div class="flex items-center gap-2">
                      <code
                        class="min-w-0 break-all rounded bg-secondary px-1.5 py-0.5 text-xs"
                      >
                        {{ configPath }}
                      </code>
                      <ClipBoard :data="configPath" />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      :aria-expanded="showConfig"
                      @click="showConfig = !showConfig"
                    >
                      <Eye v-if="!showConfig" class="mr-2 h-4 w-4" />
                      <EyeOff v-else class="mr-2 h-4 w-4" />
                      {{
                        showConfig
                          ? $t("pages.dedicated_servers.detail.hide_config")
                          : $t("pages.dedicated_servers.detail.show_config")
                      }}
                    </Button>
                    <div v-if="showConfig" class="relative">
                      <pre
                        class="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 pr-14 font-mono text-xs"
                      ><code>{{ config }}</code></pre>
                      <div class="absolute right-2 top-2">
                        <ClipBoard :data="config" />
                      </div>
                    </div>
                  </div>
                </li>
                <li class="flex gap-3">
                  <span
                    class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border/60 font-mono text-[0.65rem] text-muted-foreground"
                    >4</span
                  >
                  <p class="flex-1 text-sm">
                    {{
                      $t(
                        "pages.dedicated_servers.detail.player_management_plugin.step_restart",
                      )
                    }}
                  </p>
                </li>
              </ol>
            </div>
          </PopoverContent>
        </Popover>
        <FiveStackToolTip v-if="rosterLive" as-child :delay-duration="120">
          <template #trigger>
            <span
              class="inline-flex h-9 items-center gap-2 px-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-success"
              tabindex="0"
              data-testid="roster-live"
            >
              <span class="relative flex h-2 w-2 shrink-0">
                <span
                  class="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none"
                />
                <span
                  class="relative inline-flex h-2 w-2 rounded-full bg-success"
                />
              </span>
              {{ $t("community.roster.live") }}
            </span>
          </template>
          {{ $t("community.roster.live_description") }}
        </FiveStackToolTip>
        <TooltipProvider v-else>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                :disabled="loading"
                :aria-label="$t('common.refresh')"
                @click="fetchRoster"
              >
                <RefreshCw
                  class="h-4 w-4"
                  :class="loading && 'animate-spin motion-reduce:animate-none'"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ $t("common.refresh") }}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>

    <div
      v-if="showPollNotice"
      class="mb-3 flex items-start gap-2.5 rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-2.5 text-sm text-[hsl(var(--tac-amber))]"
      data-testid="poll-notice"
    >
      <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {{
          pluginActive
            ? $t("community.roster.not_reporting")
            : $t("community.roster.not_detected")
        }}
      </span>
    </div>

    <div
      v-if="listReady"
      class="relative"
      :data-testid="rosterLive ? 'live-roster' : 'polled-roster'"
    >
      <TransitionGroup
        tag="div"
        name="roster-row"
        class="relative flex flex-col"
      >
        <div
          v-for="row in rows"
          :key="row.steamId"
          class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-border px-1.5 py-2 last:border-b-0 md:grid-cols-[minmax(0,1fr)_6.5rem_11rem_auto]"
          :data-steam-id="row.steamId"
        >
          <CommunityPlayerCell
            :steam-id="row.steamId"
            :name="row.name"
            :player="row.player"
          />
          <div class="font-mono text-xs tabular-nums whitespace-nowrap">
            <span
              class="mb-0.5 block text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ $t("community.roster.connected") }}
            </span>
            <template v-if="row.startedAt">
              {{ format.played(sinceSeconds(row.startedAt, now)) }}
            </template>
            <span v-else class="text-muted-foreground">
              {{ $t("community.roster.not_available") }}
            </span>
          </div>
          <div class="min-w-0 font-mono text-xs">
            <span
              class="mb-0.5 block text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ $t("community.ip.label") }}
            </span>
            <CommunityIp
              v-if="rosterLive"
              :ip="row.ip"
              :others="peerNames(row.steamId)"
              scope="now"
            />
            <span v-else class="text-muted-foreground">
              {{ $t("community.roster.not_available") }}
            </span>
          </div>
          <div class="flex items-center justify-end gap-2">
            <KickPlayer
              :player="row.target"
              :server-id="serverId"
              @kicked="onRowAction"
            />
            <SanctionPlayer
              :player="row.target"
              :server-id="serverId"
              @sanctioned="onRowAction"
            />
            <CommunityPlayerMenu
              :steam-id="row.steamId"
              :name="row.displayName"
              :has-account="!!row.player?.is_registered"
              @history="openHistory(row.target)"
            />
          </div>
        </div>
      </TransitionGroup>
      <Transition
        enter-active-class="transition-opacity duration-300 motion-reduce:transition-none"
        enter-from-class="opacity-0"
      >
        <div
          v-if="rows.length === 0"
          class="py-8 text-center text-muted-foreground"
        >
          {{ $t("pages.dedicated_servers.detail.no_players") }}
        </div>
      </Transition>
    </div>

    <PlayerSanctions
      v-if="historyTarget"
      :key="historyTarget.steam_id"
      :player-id="historyTarget.steam_id"
      :player="historyTarget"
      :server-id="serverId"
      variant="external"
      v-model:open="historyOpen"
    />
  </div>
</template>

<style scoped>
.roster-row-enter-active {
  animation: roster-row-join 1.6s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes roster-row-join {
  0% {
    opacity: 0;
    transform: translateY(-6px);
    background-color: hsl(var(--tac-amber) / 0.16);
  }
  18% {
    opacity: 1;
    transform: none;
    background-color: hsl(var(--tac-amber) / 0.16);
  }
  100% {
    opacity: 1;
    transform: none;
    background-color: transparent;
  }
}

.roster-row-leave-active {
  position: absolute;
  left: 0;
  right: 0;
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.roster-row-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

.roster-row-move {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .roster-row-enter-active {
    animation: none;
  }

  .roster-row-leave-active,
  .roster-row-move {
    transition: none;
  }
}
</style>
