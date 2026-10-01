<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { useNow } from "@vueuse/core";
import { History, Search } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import SanctionPlayer from "~/components/SanctionPlayer.vue";
import PlayerSanctions from "~/components/PlayerSanctions.vue";
import CommunityPlayerCell from "~/components/community/CommunityPlayerCell.vue";
import CommunityPlayerMenu from "~/components/community/CommunityPlayerMenu.vue";
import CommunityIp from "~/components/community/CommunityIp.vue";
import {
  COMMUNITY_OPTIONAL,
  SERVER_RECENT_PLAYERS_QUERY,
  SERVER_RECENT_TOTALS_QUERY,
  SERVER_SESSIONS_ON_IPS_QUERY,
} from "~/graphql/communityGraphql";
import { useCommunityFormat } from "~/composables/useCommunityFormat";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import debounce from "~/utilities/debounce";

const props = defineProps<{
  serverId: string;
  rosterRevision?: number;
}>();

const PAGE_SIZE = 25;
const DAY_MS = 24 * 60 * 60 * 1000;
const ROSTER_REFETCH_MS = 2000;
const ROSTER_REFETCH_MAX_MS = 6000;

const { t } = useI18n();
const nuxtApp = useNuxtApp();
const format = useCommunityFormat();
const applicationSettings = useApplicationSettingsStore();
const now = useNow({ interval: 60 * 1000 });

type RecentRow = {
  player_steam_id: string | number;
  name: string | null;
  ip: string | null;
  sessions: number;
  seconds_played: number;
  kills: number;
  first_seen_at: string;
  last_seen_at: string;
  online: boolean;
  player: Record<string, any> | null;
};

type IpAccount = { steamId: string; name: string };

const available = ref(true);
const loaded = ref(false);
const rows = ref<RecentRow[]>([]);
const total = ref(0);
const totals = ref({ day: 0, week: 0, sessions: 0, seconds: 0 });
const ipAccounts = ref<Record<string, IpAccount[]>>({});
const search = ref("");
const appliedSearch = ref("");
const windowKey = ref<string>("7d");
const historyTarget = ref<Record<string, any> | null>(null);
const historyOpen = ref(false);
const refreshesInFlight = ref(0);
let generation = 0;

const windowOptions = computed(() => [
  { key: "24h", label: t("community.recent.window_24h") },
  { key: "7d", label: t("community.recent.window_7d") },
]);

const retentionDays = computed(() => {
  const value = applicationSettings.settings?.find(
    (setting: { name: string }) =>
      setting.name === "player_session_retention_days",
  )?.value;

  return value ? Number(value) : null;
});

const averageSession = computed(() =>
  totals.value.sessions > 0 ? totals.value.seconds / totals.value.sessions : 0,
);

const tiles = computed(() => [
  {
    key: "day",
    label: t("community.recent.unique_24h"),
    value: format.count(totals.value.day),
    sub: t("community.recent.players"),
  },
  {
    key: "week",
    label: t("community.recent.unique_7d"),
    value: format.count(totals.value.week),
    sub: t("community.recent.players"),
  },
  {
    key: "sessions",
    label: t("community.recent.sessions_7d"),
    value: format.count(totals.value.sessions),
    sub: t("community.recent.joins"),
  },
  {
    key: "average",
    label: t("community.recent.avg_session"),
    value: format.played(averageSession.value),
    sub: t("community.recent.per_visit"),
  },
]);

const refreshing = computed(() => refreshesInFlight.value > 0);

function rowId(row: RecentRow) {
  return String(row.player_steam_id);
}

// The view hands back text and the sessions table inet; only the /32 or
// /128 suffix can differ between the two spellings of one address.
function ipKey(ip: string) {
  return ip.replace(/\/(32|128)$/, "");
}

function accountName(
  player: Record<string, any> | null,
  name: string | null,
  steamId: string,
) {
  return (player?.is_registered ? player.name : null) || name || steamId;
}

const displayRows = computed(() =>
  rows.value.map((row) => {
    const steamId = rowId(row);
    const player = row.player
      ? { ...row.player, steam_id: String(row.player.steam_id) }
      : null;
    const displayName = accountName(player, row.name, steamId);
    const others = row.ip
      ? (ipAccounts.value[ipKey(row.ip)] ?? [])
          .filter((account) => account.steamId !== steamId)
          .map((account) => account.name)
      : [];

    return {
      ...row,
      steamId,
      player,
      displayName,
      others,
      target: player
        ? { ...player, name: displayName }
        : { steam_id: steamId, name: displayName },
    };
  }),
);

function since(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

function buildWhere() {
  const conditions: Record<string, any>[] = [
    {
      _or: [
        { online: { _eq: true } },
        {
          last_seen_at: {
            _gte: since(windowKey.value === "24h" ? DAY_MS : 7 * DAY_MS),
          },
        },
      ],
    },
  ];
  const query = appliedSearch.value.trim();

  if (query) {
    const like = `%${query}%`;
    const matches: Record<string, any>[] = [
      { name: { _ilike: like } },
      { ip: { _ilike: like } },
      { player: { name: { _ilike: like } } },
    ];

    if (/^\d{1,18}$/.test(query)) {
      matches.push({ player_steam_id: { _eq: query } });
    }

    conditions.push({ _or: matches });
  }

  return { server_id: { _eq: props.serverId }, _and: conditions };
}

async function query(document: any, variables: Record<string, any>) {
  const { data } = await nuxtApp.$apollo.defaultClient.query({
    query: document,
    variables,
    fetchPolicy: "network-only",
    context: COMMUNITY_OPTIONAL,
  });

  return data;
}

async function loadSharedIps(list: RecentRow[], request: number) {
  const ips = [
    ...new Set(
      list
        .map((row) => row.ip)
        .filter((ip): ip is string => !!ip)
        .map(ipKey),
    ),
  ];

  if (ips.length === 0) {
    ipAccounts.value = {};
    return;
  }

  const data = await query(SERVER_SESSIONS_ON_IPS_QUERY, {
    serverId: props.serverId,
    ips,
    week: since(7 * DAY_MS),
  });

  if (request !== generation) {
    return;
  }

  const byIp: Record<string, IpAccount[]> = {};

  for (const session of data?.server_player_sessions ?? []) {
    const steamId = String(session.player_steam_id);
    const accounts = (byIp[ipKey(session.ip)] ??= []);

    if (!accounts.some((account) => account.steamId === steamId)) {
      accounts.push({
        steamId,
        name: accountName(session.player, session.name, steamId),
      });
    }
  }

  ipAccounts.value = byIp;
}

async function loadTotals() {
  const data = await query(SERVER_RECENT_TOTALS_QUERY, {
    serverId: props.serverId,
    day: since(DAY_MS),
    week: since(7 * DAY_MS),
  });

  const week = data?.week?.aggregate;

  totals.value = {
    day: data?.day?.aggregate?.count ?? 0,
    week: week?.count ?? 0,
    sessions: week?.sum?.sessions ?? 0,
    seconds: week?.sum?.seconds_played ?? 0,
  };
}

function uniqueRows(list: RecentRow[], existing: RecentRow[] = []) {
  const seen = new Set(existing.map(rowId));

  return list.filter((row) => {
    const id = rowId(row);

    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

async function loadRows(options: { keep?: boolean } = {}) {
  const request = ++generation;
  const limit = options.keep
    ? Math.max(PAGE_SIZE, rows.value.length)
    : PAGE_SIZE;

  const data = await query(SERVER_RECENT_PLAYERS_QUERY, {
    where: buildWhere(),
    limit,
    offset: 0,
  });

  if (request !== generation) {
    return;
  }

  const next = uniqueRows(data?.server_recent_players ?? []);

  rows.value = next;
  total.value =
    data?.server_recent_players_aggregate?.aggregate?.count ?? next.length;
  loaded.value = true;

  await loadSharedIps(next, request);
}

async function refresh(options: { keep?: boolean } = {}) {
  refreshesInFlight.value++;

  try {
    await Promise.all([loadTotals(), loadRows(options)]);
  } catch {
    if (!loaded.value) {
      available.value = false;
    }
  } finally {
    refreshesInFlight.value--;
  }
}

// Appends to whatever the last refresh produced; a refresh starting meanwhile
// owns the list, so a page fetched for the old filter is dropped.
async function loadMore() {
  if (refreshing.value) {
    return;
  }

  const request = generation;

  try {
    const data = await query(SERVER_RECENT_PLAYERS_QUERY, {
      where: buildWhere(),
      limit: PAGE_SIZE,
      offset: rows.value.length,
    });

    if (request !== generation) {
      return;
    }

    const next = [
      ...rows.value,
      ...uniqueRows(data?.server_recent_players ?? [], rows.value),
    ];

    rows.value = next;
    total.value =
      data?.server_recent_players_aggregate?.aggregate?.count ?? total.value;

    await loadSharedIps(next, request);
  } catch {
    return;
  }
}

const applySearch = debounce(() => {
  appliedSearch.value = search.value;
}, 300);

watch(search, () => applySearch());

watch([appliedSearch, windowKey], () => {
  void refresh();
});

const refetchForRoster = debounce(
  () => {
    void refresh({ keep: true });
  },
  ROSTER_REFETCH_MS,
  { maxWait: ROSTER_REFETCH_MAX_MS },
);

watch(
  () => props.rosterRevision,
  () => refetchForRoster(),
);

function openHistory(target: Record<string, any>) {
  historyTarget.value = target;
  historyOpen.value = true;
}

onMounted(() => {
  void refresh();
});

onBeforeUnmount(() => {
  generation++;
  applySearch.cancel();
  refetchForRoster.cancel();
});
</script>

<template>
  <section
    v-if="available"
    class="rounded-md border p-4"
    aria-labelledby="recent-players-title"
  >
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <History class="h-4 w-4 text-muted-foreground" />
        <h3 id="recent-players-title" class="text-lg font-semibold">
          {{ $t("community.recent.title") }}
        </h3>
      </div>
      <span
        v-if="retentionDays"
        class="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        {{ $t("community.recent.retention", { days: retentionDays }) }}
      </span>
    </div>

    <div class="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
      <div
        v-for="tile in tiles"
        :key="tile.key"
        class="min-w-0 rounded-md border border-border bg-card/40 px-3 py-2.5"
      >
        <div
          class="flex items-center gap-1.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          <span
            class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
          />
          {{ tile.label }}
        </div>
        <div
          class="mt-2 text-2xl font-bold leading-none tabular-nums"
          :data-tile="tile.key"
        >
          <AnimatedStat :value="tile.value" />
        </div>
        <div class="mt-1 font-mono text-[0.7rem] text-muted-foreground">
          {{ tile.sub }}
        </div>
      </div>
    </div>

    <div class="mb-2 flex flex-wrap items-center gap-2">
      <div class="relative min-w-0 flex-[1_1_220px]">
        <Search
          class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="search"
          type="search"
          class="h-8 pl-8"
          autocomplete="off"
          :placeholder="$t('community.recent.search')"
          :aria-label="$t('community.recent.search')"
        />
      </div>
      <AnimatedFilters v-model="windowKey" square :options="windowOptions" />
    </div>

    <div class="overflow-x-auto">
      <table class="w-full min-w-[820px] table-fixed border-collapse text-sm">
        <colgroup>
          <col />
          <col class="w-[7.5rem]" />
          <col class="w-[7.5rem]" />
          <col class="w-[9rem]" />
          <col class="w-[11rem]" />
          <col class="w-[6rem]" />
        </colgroup>
        <thead>
          <tr
            class="whitespace-nowrap border-b border-border font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            <th class="px-2 py-2.5 text-left font-semibold">
              {{ $t("community.recent.player") }}
            </th>
            <th class="px-2 py-2.5 text-left font-semibold">
              {{ $t("community.last_seen") }}
            </th>
            <th class="px-2 py-2.5 text-right font-semibold">
              {{ $t("community.recent.sessions_7d") }}
            </th>
            <th class="px-2 py-2.5 text-right font-semibold">
              {{ $t("community.recent.time_played_7d") }}
            </th>
            <th class="px-2 py-2.5 text-left font-semibold">
              {{ $t("community.ip.label") }}
            </th>
            <th class="px-2 py-2.5">
              <span class="sr-only">{{ $t("community.actions") }}</span>
            </th>
          </tr>
        </thead>
        <TransitionGroup
          tag="tbody"
          enter-active-class="transition-opacity duration-300 motion-reduce:transition-none"
          enter-from-class="opacity-0"
          move-class="transition-transform duration-300 motion-reduce:transition-none"
        >
          <tr
            v-for="row in displayRows"
            :key="row.steamId"
            class="border-b border-border"
            :data-steam-id="row.steamId"
          >
            <td class="px-2 py-2">
              <CommunityPlayerCell
                :steam-id="row.steamId"
                :name="row.name"
                :player="row.player"
                :dim="!row.online"
              />
            </td>
            <td class="px-2 py-2">
              <span
                v-if="row.online"
                class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-success"
              >
                <span class="h-[7px] w-[7px] rounded-full bg-current" />
                {{ $t("community.online") }}
              </span>
              <time
                v-else
                :datetime="row.last_seen_at"
                :title="format.exact(row.last_seen_at)"
                class="whitespace-nowrap font-mono text-xs"
              >
                {{ format.ago(row.last_seen_at, { now: now.getTime() }) }}
              </time>
            </td>
            <td class="px-2 py-2 text-right font-mono tabular-nums">
              {{ format.count(row.sessions) }}
            </td>
            <td class="px-2 py-2 text-right font-mono tabular-nums">
              {{ format.played(row.seconds_played) }}
            </td>
            <td class="min-w-0 px-2 py-2">
              <CommunityIp :ip="row.ip" :others="row.others" scope="week" />
            </td>
            <td class="px-2 py-2">
              <div class="flex items-center justify-end gap-2">
                <SanctionPlayer :player="row.target" :server-id="serverId" />
                <CommunityPlayerMenu
                  :steam-id="row.steamId"
                  :name="row.displayName"
                  :has-account="!!row.player?.is_registered"
                  @history="openHistory(row.target)"
                />
              </div>
            </td>
          </tr>
        </TransitionGroup>
      </table>
      <p
        v-if="loaded && displayRows.length === 0"
        class="py-6 text-center text-sm text-muted-foreground"
      >
        {{
          appliedSearch.trim()
            ? $t("community.recent.no_matches")
            : $t("community.recent.empty")
        }}
      </p>
    </div>

    <div
      class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
    >
      <span v-if="loaded">
        {{
          $t("community.recent.showing", {
            shown: format.count(displayRows.length),
            total: format.count(total),
          })
        }}
      </span>
      <Button
        v-if="displayRows.length < total"
        variant="outline"
        size="sm"
        :disabled="refreshing"
        @click="loadMore"
      >
        {{ $t("community.recent.load_more") }}
      </Button>
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
