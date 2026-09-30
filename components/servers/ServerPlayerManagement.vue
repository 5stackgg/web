<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import SanctionPlayer from "~/components/SanctionPlayer.vue";
import PlayerSanctions from "~/components/PlayerSanctions.vue";
import KickPlayer from "~/components/KickPlayer.vue";
import ClipBoard from "~/components/ClipBoard.vue";
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
}>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();
const authStore = useAuthStore();
const applicationSettings = useApplicationSettingsStore();

// The plugin syncs every 30s and the api keeps at most one heartbeat a minute.
const PLUGIN_STALE_MS = 3 * 60 * 1000;

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
const installOpen = ref(false);
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
      profile_url
      country
      role
      is_banned
      is_muted
      is_gagged
      elo
      premier_rank
      vac_banned
      vac_ban_count
      game_ban_count
      days_since_last_ban
    }
  }
`;

const players = computed(() =>
  roster.value.map((entry) => {
    const registered = registeredPlayers.value[entry.steam_id];
    return {
      steam_id: entry.steam_id,
      name: registered?.name || entry.name,
      avatar_url: registered?.avatar_url,
      profile_url: registered?.profile_url,
      country: registered?.country,
      role: registered?.role,
      is_banned: registered?.is_banned,
      is_muted: registered?.is_muted,
      is_gagged: registered?.is_gagged,
      elo: registered?.elo,
      premier_rank: registered?.premier_rank,
      vac_banned: registered?.vac_banned,
      vac_ban_count: registered?.vac_ban_count,
      game_ban_count: registered?.game_ban_count,
      days_since_last_ban: registered?.days_since_last_ban,
    };
  }),
);

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

    roster.value = data?.getDedicatedServerPlayers ?? [];

    const steamIds = roster.value.map((player) => player.steam_id);
    if (steamIds.length > 0) {
      const { data: registeredData } =
        await nuxtApp.$apollo.defaultClient.query({
          query: registeredQuery,
          variables: { steamIds },
          fetchPolicy: "network-only",
        });

      const map: Record<string, any> = {};
      for (const player of registeredData?.players ?? []) {
        map[`${player.steam_id}`] = player;
      }
      registeredPlayers.value = map;
    } else {
      registeredPlayers.value = {};
    }
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
  }
}

onMounted(() => {
  void fetchRoster();
  pollTimer = setInterval(() => {
    void fetchRoster();
  }, 30 * 1000);

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
  }, 15 * 1000);
});

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }

  if (clockTimer) {
    clearInterval(clockTimer);
  }

  pluginSub?.unsubscribe();
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
        <Badge variant="secondary">{{ players.length }}</Badge>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="icon"
              :disabled="loading"
              @click="fetchRoster"
            >
              <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ $t("common.refresh") }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <template v-if="isCommunityServer">
      <div
        v-if="pluginActive"
        class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
      >
        <span class="h-2 w-2 shrink-0 rounded-full bg-success" />
        <span class="text-foreground">
          {{
            $t("pages.dedicated_servers.detail.player_management_plugin.active")
          }}
        </span>
        <span class="font-mono text-xs">
          {{ pluginVersionLabel }}
          <template v-if="pluginState?.player_management_runtime">
            · {{ RUNTIME_LABELS[pluginState.player_management_runtime] }}
          </template>
        </span>
        <Button
          v-if="canInstall"
          variant="ghost"
          size="xs"
          class="ml-auto"
          :aria-expanded="installOpen"
          @click="installOpen = !installOpen"
        >
          {{
            $t(
              "pages.dedicated_servers.detail.player_management_plugin.install_steps",
            )
          }}
        </Button>
      </div>

      <div
        v-else
        class="mb-4 flex items-center gap-3 rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-2.5 text-sm text-[hsl(var(--tac-amber))] max-sm:flex-col max-sm:items-start"
      >
        <TriangleAlert class="h-4 w-4 shrink-0 max-sm:hidden" />
        <span class="flex-1">{{ notDetectedMessage }}</span>
        <Button
          v-if="canInstall"
          variant="outline"
          size="sm"
          class="shrink-0"
          :aria-expanded="installOpen"
          @click="installOpen = !installOpen"
        >
          {{
            $t(
              "pages.dedicated_servers.detail.player_management_plugin.install",
            )
          }}
        </Button>
      </div>

      <div v-if="canInstall && installOpen" class="mb-4 rounded-md border p-4">
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
                  class="overflow-x-auto rounded-md border bg-muted/40 p-3 pr-14 font-mono text-sm"
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
    </template>

    <div
      v-if="players.length === 0"
      class="text-center py-8 text-muted-foreground"
    >
      {{ $t("pages.dedicated_servers.detail.no_players") }}
    </div>

    <div v-else class="flex flex-col divide-y">
      <div
        v-for="player in players"
        :key="player.steam_id"
        class="flex items-center justify-between gap-2 py-2"
      >
        <PlayerDisplay
          :player="player"
          :linkable="true"
          :show-steam-id="true"
          size="sm"
        />
        <div class="flex items-center gap-2">
          <PlayerSanctions
            :player-id="player.steam_id"
            :player="player"
            :server-id="serverId"
          />
          <KickPlayer
            :player="player"
            :server-id="serverId"
            @kicked="fetchRoster"
          />
          <SanctionPlayer
            :player="player"
            :server-id="serverId"
            @sanctioned="fetchRoster"
          />
        </div>
      </div>
    </div>
  </div>
</template>
