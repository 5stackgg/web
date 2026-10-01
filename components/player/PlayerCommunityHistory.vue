<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronRight, ShieldHalf, TriangleAlert } from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import CommunityPlayerCell from "~/components/community/CommunityPlayerCell.vue";
import SanctionStatusBadge from "~/components/SanctionStatusBadge.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import {
  tacticalSectionDescriptionClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  COMMUNITY_OPTIONAL,
  PLAYER_COMMUNITY_STATS_QUERY,
} from "~/graphql/communityGraphql";
import { killDeathRatio } from "~/utilities/communityStats";
import { useCommunityFormat } from "~/composables/useCommunityFormat";

const props = defineProps<{
  steamId: string;
  hideWhenEmpty?: boolean;
  heading?: string;
}>();

type Totals = {
  sessions: number;
  seconds: number;
  kills: number;
  deaths: number;
  servers: number;
  rank: number | null;
};

type CommunityServer = {
  server_id: string;
  label: string;
  region: string | null;
  type: string | null;
  online: boolean;
  last_seen_at: string | null;
  week: Totals;
  all_time: Totals;
  names: string[] | null;
  sessions: Array<{
    started_at: string;
    ended_at: string | null;
    ip: string | null;
  }> | null;
};

type CommunityStats = {
  week: Totals;
  all_time: Totals;
  last_seen_at: string | null;
  online_server_id: string | null;
  online_server_label: string | null;
  is_moderator_view: boolean;
  servers: CommunityServer[];
  ips: Array<{ ip: string; sessions: number }> | null;
  ip_matches: Array<{
    steam_id: string | number;
    name: string | null;
    avatar_url: string | null;
    has_account: boolean;
    is_banned: boolean;
    sessions: number;
    last_seen_at: string | null;
    online: boolean;
    ip: string;
  }> | null;
};

const { t } = useI18n();
const nuxtApp = useNuxtApp();
const format = useCommunityFormat();

const stats = ref<CommunityStats | null>(null);
const loading = ref(true);
const period = ref<string>("week");
const expanded = ref<string[]>([]);
let generation = 0;

const periodOptions = computed(() => [
  { key: "week", label: t("community.this_week") },
  { key: "all", label: t("community.all_time") },
]);

const isModerator = computed(() => !!stats.value?.is_moderator_view);

const totalsFor = (source: { week: Totals; all_time: Totals }) =>
  period.value === "week" ? source.week : source.all_time;

const totals = computed(() => (stats.value ? totalsFor(stats.value) : null));

const hasHistory = computed(
  () =>
    !!stats.value &&
    (stats.value.all_time.sessions > 0 || stats.value.servers.length > 0),
);

const servers = computed(() =>
  (stats.value?.servers ?? [])
    .filter((server) => server.online || totalsFor(server).sessions > 0)
    .sort((a, b) => totalsFor(b).seconds - totalsFor(a).seconds),
);

const isOnline = computed(() => !!stats.value?.online_server_id);

// Embedded under a profile with no matches, a player without community time
// should show nothing, not a skeleton that then vanishes.
const hidden = computed(
  () => !!props.hideWhenEmpty && (loading.value || !hasHistory.value),
);

const lastSeenServer = computed(() => {
  if (stats.value?.online_server_label) {
    return stats.value.online_server_label;
  }

  return [...(stats.value?.servers ?? [])]
    .filter((server) => server.last_seen_at)
    .sort(
      (a, b) =>
        Date.parse(b.last_seen_at as string) -
        Date.parse(a.last_seen_at as string),
    )[0]?.label;
});

const primaryIp = computed(
  () =>
    [...(stats.value?.ips ?? [])].sort((a, b) => b.sessions - a.sessions)[0]
      ?.ip ?? null,
);

const ipMatches = computed(() => stats.value?.ip_matches ?? []);

const showIpSection = computed(
  () =>
    isModerator.value &&
    (ipMatches.value.length > 0 || (stats.value?.ips?.length ?? 0) > 0),
);

const tiles = computed(() => {
  const current = totals.value;

  if (!current) {
    return [];
  }

  return [
    {
      key: "time",
      label: t("community.time_played"),
      value: format.played(current.seconds),
      sub: t("community.player_tab.avg_session", {
        duration: format.played(
          current.sessions > 0 ? current.seconds / current.sessions : 0,
        ),
      }),
    },
    {
      key: "kills",
      label: t("community.kills"),
      value: format.count(current.kills),
      sub: t("community.player_tab.kd", {
        ratio: killDeathRatio(current.kills, current.deaths),
      }),
    },
    {
      key: "sessions",
      label: t("community.sessions"),
      value: format.count(current.sessions),
      sub: t("community.recent.joins"),
    },
    {
      key: "servers",
      label: t("community.player_tab.servers"),
      value: format.count(current.servers),
      sub: t("community.player_tab.community_servers"),
    },
  ];
});

function lastSeenText(iso: string | null | undefined) {
  if (!iso) {
    return "—";
  }

  return isModerator.value
    ? format.exact(iso)
    : format.ago(iso, { coarse: true });
}

function serverSub(server: CommunityServer) {
  return [server.region, server.type].filter(Boolean).join(" · ");
}

function sessionsFor(server: CommunityServer) {
  return [...(server.sessions ?? [])].sort(
    (a, b) => Date.parse(b.started_at) - Date.parse(a.started_at),
  );
}

function sessionLength(session: {
  started_at: string;
  ended_at: string | null;
}) {
  const end = session.ended_at ? Date.parse(session.ended_at) : Date.now();

  return format.played((end - Date.parse(session.started_at)) / 1000);
}

function toggle(serverId: string) {
  expanded.value = expanded.value.includes(serverId)
    ? expanded.value.filter((id) => id !== serverId)
    : [...expanded.value, serverId];
}

async function load() {
  const request = ++generation;

  loading.value = true;

  try {
    const { data } = await nuxtApp.$apollo.defaultClient.query({
      query: PLAYER_COMMUNITY_STATS_QUERY,
      variables: { steamId: props.steamId },
      fetchPolicy: "network-only",
      context: COMMUNITY_OPTIONAL,
    });

    if (request === generation) {
      stats.value = data?.getPlayerCommunityStats ?? null;
    }
  } catch {
    if (request === generation) {
      stats.value = null;
    }
  } finally {
    if (request === generation) {
      loading.value = false;
    }
  }
}

watch(
  () => props.steamId,
  () => {
    expanded.value = [];
    void load();
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="!hidden">
    <h2 v-if="heading" :class="tacticalSectionLabelClasses">
      <span :class="tacticalSectionTickClasses"></span>
      {{ heading }}
    </h2>
    <FadeSwap>
      <div v-if="loading && !stats" key="loading" class="space-y-4">
        <Skeleton class="h-5 w-40" />
        <div class="grid grid-cols-2 gap-2.5 md:grid-cols-5">
          <Skeleton v-for="i in 5" :key="i" class="h-[5.25rem] w-full" />
        </div>
        <Skeleton class="h-48 w-full" />
      </div>

      <Empty
        v-else-if="!hasHistory"
        key="empty"
        class="min-h-[200px]"
        data-testid="community-empty"
      >
        <EmptyTitle>{{ $t("community.player_tab.empty_title") }}</EmptyTitle>
        <EmptyDescription>
          {{ $t("community.player_tab.empty_description") }}
        </EmptyDescription>
      </Empty>

      <div v-else key="content" class="flex flex-col gap-6">
        <section aria-labelledby="community-summary">
          <div class="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h2
              id="community-summary"
              :class="[tacticalSectionLabelClasses, 'mb-0']"
            >
              <span :class="tacticalSectionTickClasses"></span>
              {{
                period === "week"
                  ? $t("community.this_week")
                  : $t("community.all_time")
              }}
            </h2>
            <AnimatedFilters v-model="period" square :options="periodOptions" />
          </div>
          <p
            :class="tacticalSectionDescriptionClasses"
            class="flex items-center gap-2"
          >
            <ShieldHalf
              v-if="isModerator"
              class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
            />
            {{
              isModerator
                ? $t("community.player_tab.moderator_note")
                : $t("community.player_tab.public_note")
            }}
          </p>

          <div class="grid grid-cols-2 gap-2.5 md:grid-cols-5">
            <div
              v-for="tile in tiles"
              :key="tile.key"
              class="min-w-0 rounded-md border border-border bg-card/40 p-3"
              :data-tile="tile.key"
            >
              <div
                class="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{ tile.label }}
              </div>
              <div
                class="mt-2 whitespace-nowrap text-2xl font-bold leading-none tabular-nums"
              >
                <AnimatedStat :value="tile.value" />
              </div>
              <div
                class="mt-1.5 truncate font-mono text-[0.7rem] text-muted-foreground"
              >
                {{ tile.sub }}
              </div>
            </div>
            <div
              class="col-span-2 min-w-0 rounded-md border border-border bg-card/40 p-3 md:col-span-1"
              data-tile="last-seen"
            >
              <div
                class="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{ $t("community.last_seen") }}
              </div>
              <div
                class="mt-2 flex items-center gap-1.5 text-[1.05rem] font-bold leading-tight"
              >
                <template v-if="isOnline">
                  <span class="h-2 w-2 shrink-0 rounded-full bg-success" />
                  {{ $t("community.online_now") }}
                </template>
                <span v-else class="truncate">
                  {{ lastSeenText(stats?.last_seen_at) }}
                </span>
              </div>
              <div
                class="mt-1.5 truncate font-mono text-[0.7rem] text-muted-foreground"
              >
                {{ lastSeenServer }}
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="community-servers">
          <h2 id="community-servers" :class="tacticalSectionLabelClasses">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("community.player_tab.servers_seen_on") }}
          </h2>
          <div class="overflow-x-auto rounded-lg border border-border">
            <table class="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr
                  class="border-b border-border font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  <th v-if="isModerator" class="w-10 px-3 py-3">
                    <span class="sr-only">{{ $t("community.sessions") }}</span>
                  </th>
                  <th class="px-3 py-3 text-left font-semibold">
                    {{ $t("community.server") }}
                  </th>
                  <th class="px-3 py-3 text-left font-semibold">
                    {{ $t("community.last_seen") }}
                  </th>
                  <th class="px-3 py-3 text-right font-semibold">
                    {{ $t("community.sessions") }}
                  </th>
                  <th class="px-3 py-3 text-right font-semibold">
                    {{ $t("community.time_played") }}
                  </th>
                  <th class="px-3 py-3 text-right font-semibold">
                    {{ $t("community.kills") }}
                  </th>
                  <th class="px-3 py-3 text-right font-semibold">
                    {{ $t("community.rank") }}
                  </th>
                  <th
                    v-if="isModerator"
                    class="px-3 py-3 text-left font-semibold"
                  >
                    {{ $t("community.player_tab.names_used") }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <template v-for="server in servers" :key="server.server_id">
                  <tr
                    class="border-b border-border/60 transition-colors hover:bg-muted/30"
                    :data-server-id="server.server_id"
                  >
                    <td v-if="isModerator" class="px-3 py-2.5">
                      <button
                        type="button"
                        class="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        :aria-expanded="expanded.includes(server.server_id)"
                        :aria-label="
                          $t('community.player_tab.show_sessions', {
                            server: server.label,
                          })
                        "
                        @click="toggle(server.server_id)"
                      >
                        <ChevronRight
                          class="h-3.5 w-3.5 transition-transform duration-150 motion-reduce:transition-none"
                          :class="
                            expanded.includes(server.server_id) && 'rotate-90'
                          "
                        />
                      </button>
                    </td>
                    <td class="px-3 py-2.5">
                      <NuxtLink
                        :to="`/public-servers/${server.server_id}`"
                        class="font-semibold transition-colors hover:text-[hsl(var(--tac-amber))]"
                      >
                        {{ server.label }}
                      </NuxtLink>
                      <div
                        v-if="serverSub(server)"
                        class="font-mono text-[0.7rem] text-muted-foreground"
                      >
                        {{ serverSub(server) }}
                      </div>
                    </td>
                    <td class="px-3 py-2.5">
                      <span
                        v-if="server.online"
                        class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-success"
                      >
                        <span class="h-[7px] w-[7px] rounded-full bg-current" />
                        {{ $t("community.online") }}
                      </span>
                      <span v-else class="whitespace-nowrap font-mono text-xs">
                        {{ lastSeenText(server.last_seen_at) }}
                      </span>
                    </td>
                    <td class="px-3 py-2.5 text-right font-mono tabular-nums">
                      <AnimatedStat
                        :value="format.count(totalsFor(server).sessions)"
                      />
                    </td>
                    <td class="px-3 py-2.5 text-right font-mono tabular-nums">
                      <AnimatedStat
                        :value="format.played(totalsFor(server).seconds)"
                      />
                    </td>
                    <td class="px-3 py-2.5 text-right font-mono tabular-nums">
                      <AnimatedStat
                        :value="format.count(totalsFor(server).kills)"
                      />
                    </td>
                    <td
                      class="px-3 py-2.5 text-right font-mono text-xs font-semibold"
                    >
                      <span
                        v-if="totalsFor(server).rank"
                        class="text-[hsl(var(--tac-amber))]"
                        >#{{ totalsFor(server).rank }}</span
                      >
                      <span v-else class="text-muted-foreground">—</span>
                    </td>
                    <td v-if="isModerator" class="px-3 py-2.5">
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="name in server.names ?? []"
                          :key="name"
                          class="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs"
                          >{{ name }}</span
                        >
                      </div>
                    </td>
                  </tr>
                  <tr v-if="isModerator">
                    <td colspan="8" class="p-0">
                      <Fold :open="expanded.includes(server.server_id)">
                        <div
                          class="border-b border-border/60 bg-muted/20 py-2.5 pl-11 pr-3 max-sm:pl-3"
                          :data-sessions-for="server.server_id"
                        >
                          <div
                            class="mb-2 flex flex-wrap justify-between gap-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                          >
                            <span>{{
                              $t("community.player_tab.sessions_last_7_days")
                            }}</span>
                            <span
                              class="inline-flex items-center gap-1 text-[hsl(var(--tac-amber))]"
                            >
                              <ShieldHalf class="h-3 w-3" />
                              {{ $t("community.player_tab.moderators_only") }}
                            </span>
                          </div>
                          <p
                            v-if="sessionsFor(server).length === 0"
                            class="py-1 text-xs text-muted-foreground"
                          >
                            {{ $t("community.player_tab.no_recent_sessions") }}
                          </p>
                          <div
                            v-for="session in sessionsFor(server)"
                            :key="session.started_at"
                            class="grid grid-cols-[7rem_8.5rem_5rem_minmax(0,1fr)] gap-3 border-t border-border/40 py-1.5 font-mono text-xs tabular-nums first-of-type:border-t-0 max-sm:grid-cols-[6rem_minmax(0,1fr)]"
                          >
                            <span class="text-muted-foreground">
                              {{ format.day(session.started_at) }}
                            </span>
                            <span :class="!session.ended_at && 'text-success'">
                              {{ format.time(session.started_at) }} –
                              {{
                                session.ended_at
                                  ? format.time(session.ended_at)
                                  : $t("community.now")
                              }}
                            </span>
                            <span>{{ sessionLength(session) }}</span>
                            <span
                              class="truncate"
                              :class="
                                session.ip && session.ip !== primaryIp
                                  ? 'text-[hsl(var(--tac-amber))]'
                                  : 'text-muted-foreground'
                              "
                              :data-alt-ip="
                                session.ip && session.ip !== primaryIp
                                  ? ''
                                  : undefined
                              "
                            >
                              {{ session.ip ?? "—" }}
                            </span>
                          </div>
                        </div>
                      </Fold>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
            <p
              v-if="servers.length === 0"
              class="py-6 text-center text-sm text-muted-foreground"
            >
              {{ $t("community.player_tab.no_servers_this_week") }}
            </p>
          </div>
        </section>

        <section
          v-if="showIpSection"
          aria-labelledby="community-ips"
          data-testid="community-ip-section"
        >
          <h2 id="community-ips" :class="tacticalSectionLabelClasses">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("community.player_tab.also_on_ips") }}
          </h2>
          <div
            class="flex flex-col gap-3 rounded-lg border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.05)] px-4 py-3.5"
          >
            <div
              v-if="ipMatches.length"
              class="flex items-center gap-2.5 text-sm text-[hsl(var(--tac-amber))]"
            >
              <TriangleAlert class="h-4 w-4 shrink-0" />
              <span>{{ $t("community.player_tab.ip_matches_title") }}</span>
              <span
                class="rounded-sm bg-[hsl(var(--tac-amber)/0.12)] px-1.5 font-mono text-xs"
                >{{ ipMatches.length }}</span
              >
            </div>
            <div v-if="ipMatches.length" class="flex flex-col">
              <div
                v-for="match in ipMatches"
                :key="`${match.steam_id}-${match.ip}`"
                class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-5 gap-y-2 border-t border-[hsl(var(--tac-amber)/0.18)] py-2.5 first:border-t-0 max-sm:grid-cols-[minmax(0,1fr)_auto]"
                :data-match="String(match.steam_id)"
              >
                <div class="flex min-w-0 items-center gap-2">
                  <CommunityPlayerCell
                    :steam-id="String(match.steam_id)"
                    :name="match.name"
                    :player="
                      match.has_account
                        ? {
                            steam_id: String(match.steam_id),
                            name: match.name,
                            avatar_url: match.avatar_url,
                            is_registered: true,
                            is_banned: match.is_banned,
                          }
                        : null
                    "
                    :detail="match.ip"
                  />
                  <SanctionStatusBadge
                    v-if="match.is_banned && !match.has_account"
                    type="ban"
                  />
                </div>
                <div
                  class="text-right font-mono text-xs tabular-nums max-sm:hidden"
                >
                  <span
                    class="block text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                    >{{ $t("community.sessions") }}</span
                  >
                  {{ format.count(match.sessions) }}
                </div>
                <div class="text-right font-mono text-xs">
                  <span
                    class="block text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                    >{{ $t("community.last_seen") }}</span
                  >
                  <span
                    v-if="match.online"
                    class="font-sans font-semibold text-success"
                    >{{ $t("community.online") }}</span
                  >
                  <template v-else>
                    {{ format.exact(match.last_seen_at) || "—" }}
                  </template>
                </div>
              </div>
            </div>
            <div
              v-if="stats?.ips?.length"
              class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-muted-foreground"
              data-testid="community-ips"
            >
              <span>{{ $t("community.player_tab.ips_used") }}</span>
              <span
                v-for="entry in stats.ips"
                :key="entry.ip"
                class="whitespace-nowrap"
              >
                <span class="font-mono text-foreground">{{ entry.ip }}</span>
                ·
                {{
                  $t(
                    "community.player_tab.ip_sessions",
                    { count: entry.sessions },
                    entry.sessions,
                  )
                }}
              </span>
            </div>
          </div>
        </section>
      </div>
    </FadeSwap>
  </div>
</template>
