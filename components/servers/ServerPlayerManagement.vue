<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import gql from "graphql-tag";
import { RefreshCw, Users, TriangleAlert } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
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

const props = defineProps<{
  serverId: string;
}>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();

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
});

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
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

    <div
      class="mb-4 flex items-start gap-3 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm"
    >
      <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
      <div>
        <p class="font-medium text-yellow-500">
          {{ $t("pages.dedicated_servers.detail.sanctions_wip_title") }}
        </p>
        <p class="text-muted-foreground">
          {{ $t("pages.dedicated_servers.detail.sanctions_wip") }}
        </p>
      </div>
    </div>

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
