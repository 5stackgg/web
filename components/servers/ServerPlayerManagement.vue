<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import gql from "graphql-tag";
import { RefreshCw, TriangleAlert } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
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
import { useServerPlayerManagementPlugin } from "~/composables/useServerPlayerManagementPlugin";
import type { ServerRosterStatus } from "~/types/serverOverview";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useAuthStore } from "~/stores/AuthStore";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = defineProps<{
  serverId: string;
  gameServerNodeId?: string | null;
  maxPlayers?: number | null;
  online?: boolean;
}>();

const emit = defineEmits<{
  (e: "roster-change"): void;
  (e: "status", status: ServerRosterStatus): void;
}>();

const { t } = useI18n();
const format = useCommunityFormat();
const nuxtApp = useNuxtApp();
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

// Same window the api's sweep uses before it closes a silent server's
// sessions: past it the plugin roster is history, not the server.
const ROSTER_STALE_MS = 3 * 60 * 1000;

// How long the roster subscription gets to answer before RCON polling starts
// anyway, so a dead websocket can't leave the card empty.
const ROSTER_DECIDE_MS = 5 * 1000;

const plugin = useServerPlayerManagementPlugin(() => props.serverId);
const now = plugin.now;
const isCommunityServer = plugin.isCommunityServer;
const pluginActive = plugin.active;

// The install steps live in the server settings, which only an administrator
// can open; a server on a node gets the plugin baked into its image.
const canOpenInstall = computed(
  () =>
    authStore.isAdmin &&
    !pluginActive.value &&
    props.gameServerNodeId === null,
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

const pluginWarning = computed(() => {
  if (pluginActive.value) {
    return [t("community.roster.not_reporting")];
  }

  return [
    t("community.roster.not_detected"),
    notDetectedMessage.value,
    ...(canOpenInstall.value
      ? [
          t(
            "pages.dedicated_servers.detail.player_management_plugin.open_install",
          ),
        ]
      : []),
  ];
});

function openInstall() {
  if (!canOpenInstall.value) {
    return;
  }

  void router.push({
    query: { ...route.query, tab: "settings", settings: "player-management" },
  });
}

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

const showPluginWarning = computed(
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


const SERVER_LAST_SEEN_QUERY = gql`
  query ServerLastSeen($serverId: uuid!) {
    server_recent_players(
      where: { server_id: { _eq: $serverId }, online: { _eq: false } }
      order_by: { last_seen_at: desc }
      limit: 1
    ) {
      last_seen_at
    }
  }
`;

const lastLeftAt = ref<string | null>(null);

// Only a community server keeps session history, so only it can say when the
// last player left.
async function loadLastLeft() {
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.query({
      query: SERVER_LAST_SEEN_QUERY,
      variables: { serverId: props.serverId },
      fetchPolicy: "network-only",
      context: COMMUNITY_OPTIONAL,
    });

    lastLeftAt.value = data?.server_recent_players?.[0]?.last_seen_at ?? null;
  } catch {
    lastLeftAt.value = null;
  }
}

watch(
  () => listReady.value && rows.value.length === 0 && isCommunityServer.value,
  (empty) => {
    if (empty) {
      void loadLastLeft();
    }
  },
  { immediate: true },
);

watch(
  (): ServerRosterStatus => ({
    count: rows.value.length,
    live: rosterLive.value,
    community: isCommunityServer.value,
    pluginActive: pluginActive.value,
    pluginVersion: plugin.versionLabel.value,
    pluginRuntime: plugin.runtimeLabel.value,
    pluginSeenAt: plugin.server.value?.player_management_seen_at ?? null,
  }),
  (status) => emit("status", status),
  { immediate: true },
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
});

onBeforeUnmount(() => {
  stopPolling();

  if (rosterDecideTimer) {
    clearTimeout(rosterDecideTimer);
  }

  rosterSub?.unsubscribe();
});
</script>

<template>
  <section aria-labelledby="online-now-title">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-baseline gap-3">
        <h3
          id="online-now-title"
          :class="[tacticalSectionLabelClasses, 'mb-0']"
        >
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("community.online_now") }}
        </h3>
        <span
          class="font-mono text-xs tabular-nums text-muted-foreground"
          data-testid="roster-count"
        >
          {{ rows.length
          }}<template v-if="maxPlayers"> / {{ maxPlayers }}</template>
        </span>
      </div>
      <div class="flex items-center gap-2">
        <FiveStackToolTip
          v-if="showPluginWarning"
          as-child
          :delay-duration="120"
        >
          <template #trigger>
            <Button
              variant="outline"
              size="icon"
              :as="canOpenInstall ? 'button' : 'span'"
              :tabindex="canOpenInstall ? undefined : 0"
              :aria-label="pluginWarning.join(' ')"
              class="border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)] hover:text-[hsl(var(--tac-amber))]"
              :class="!canOpenInstall && 'cursor-default'"
              data-testid="plugin-warning"
              @click="openInstall"
            >
              <TriangleAlert />
            </Button>
          </template>
          <div class="max-w-[18rem] space-y-1.5">
            <p v-for="line in pluginWarning" :key="line">{{ line }}</p>
          </div>
        </FiveStackToolTip>
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
      class="border border-border px-3 [background:linear-gradient(180deg,hsl(var(--card)/0.6)_0%,hsl(var(--card)/0.22)_100%)] max-sm:px-2"
    >
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
            class="flex flex-col gap-1 px-1.5 py-5"
            data-testid="roster-empty"
          >
            <span class="text-sm font-semibold">
              {{ $t("pages.dedicated_servers.detail.no_players") }}
            </span>
            <span
              v-if="lastLeftAt"
              class="font-mono text-xs text-muted-foreground"
              :title="format.exact(lastLeftAt)"
            >
              {{
                $t("community.roster.last_left", {
                  time: format.ago(lastLeftAt, { now }),
                })
              }}
            </span>
          </div>
        </Transition>
      </div>
      <div v-else class="h-14" aria-hidden="true"></div>
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
  </section>
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
