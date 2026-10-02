<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import AnimatedStat from "~/components/AnimatedStat.vue";
import ServerActivityChart from "~/components/community/ServerActivityChart.vue";
import ServerLeaderboard from "~/components/community/ServerLeaderboard.vue";
import {
  COMMUNITY_OPTIONAL,
  DEDICATED_SERVER_INFO_QUERY,
  SERVER_COMMUNITY_STATS_QUERY,
} from "~/graphql/communityGraphql";
import { useCommunityFormat } from "~/composables/useCommunityFormat";
import {
  tacticalSectionDescriptionClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import type { HourBucket } from "~/utilities/communityStats";

export type ServerLiveInfo = { map: string | null; players: number | null };

type CommunityStats = {
  online: number;
  max_players: number | null;
  week_players: number;
  week_seconds: number;
  all_time_players: number;
  tracked_since: string | null;
  hourly: HourBucket[];
};

const props = defineProps<{
  serverId: string;
  label: string;
  maxPlayers?: number | null;
}>();

const emit = defineEmits<{
  info: [info: ServerLiveInfo | null];
}>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();
const format = useCommunityFormat();

// The api caches these for five minutes, so polling faster buys nothing.
const STATS_REFRESH_MS = 5 * 60 * 1000;
const INFO_REFRESH_MS = 60 * 1000;

const info = ref<ServerLiveInfo | null>(null);
const stats = ref<CommunityStats | null>(null);
let infoTimer: ReturnType<typeof setInterval> | null = null;
let statsTimer: ReturnType<typeof setInterval> | null = null;

const onlineNow = computed(
  () => info.value?.players ?? stats.value?.online ?? 0,
);

const maxPlayers = computed(
  () => props.maxPlayers ?? stats.value?.max_players ?? null,
);

const tiles = computed(() => [
  {
    key: "online",
    label: t("community.server_page.online_now"),
    value: format.count(onlineNow.value),
    suffix: maxPlayers.value ? `/ ${maxPlayers.value}` : null,
    sub: t("community.recent.players"),
  },
  {
    key: "week-players",
    label: t("community.server_page.players_this_week"),
    value: format.count(stats.value?.week_players),
    suffix: null,
    sub: t("community.server_page.different_players"),
  },
  {
    key: "week-hours",
    label: t("community.server_page.hours_this_week"),
    value: format.hours(stats.value?.week_seconds),
    suffix: null,
    sub: t("community.server_page.played_by_everyone"),
  },
  {
    key: "all-time",
    label: t("community.server_page.all_time_players"),
    value: format.count(stats.value?.all_time_players),
    suffix: null,
    sub: stats.value?.tracked_since
      ? t("community.server_page.since", {
          date: format.date(stats.value.tracked_since),
        })
      : t("community.recent.players"),
  },
]);

async function loadInfo() {
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.query({
      query: DEDICATED_SERVER_INFO_QUERY,
      fetchPolicy: "network-only",
      context: COMMUNITY_OPTIONAL,
    });

    const entry = (data?.getDedicatedServerInfo ?? []).find(
      (candidate: { id: string }) => candidate.id === props.serverId,
    );

    info.value = entry ? { map: entry.map, players: entry.players } : null;
    emit("info", info.value);
  } catch {
    return;
  }
}

async function loadStats() {
  try {
    const { data } = await nuxtApp.$apollo.defaultClient.query({
      query: SERVER_COMMUNITY_STATS_QUERY,
      variables: { serverId: props.serverId },
      fetchPolicy: "network-only",
      context: COMMUNITY_OPTIONAL,
    });

    stats.value = data?.getServerCommunityStats ?? null;
  } catch {
    return;
  }
}

watch(
  () => props.serverId,
  () => {
    stats.value = null;
    info.value = null;
    emit("info", null);
    void loadInfo();
    void loadStats();
  },
);

onMounted(() => {
  void loadInfo();
  void loadStats();
  infoTimer = setInterval(() => void loadInfo(), INFO_REFRESH_MS);
  statsTimer = setInterval(() => void loadStats(), STATS_REFRESH_MS);
});

onBeforeUnmount(() => {
  if (infoTimer) {
    clearInterval(infoTimer);
  }

  if (statsTimer) {
    clearInterval(statsTimer);
  }
});
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="grid grid-cols-2 gap-2.5 md:grid-cols-4">
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
        <div class="mt-2 text-[1.6rem] font-bold leading-none tabular-nums">
          <AnimatedStat :value="tile.value" />
          <small
            v-if="tile.suffix"
            class="ml-1 text-[0.95rem] font-semibold text-muted-foreground"
            >{{ tile.suffix }}</small
          >
        </div>
        <div class="mt-1.5 font-mono text-[0.7rem] text-muted-foreground">
          {{ tile.sub }}
        </div>
      </div>
    </div>

    <section aria-labelledby="server-activity" class="tac-section-sep">
      <h2 id="server-activity" :class="[tacticalSectionLabelClasses, 'mb-1']">
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("community.server_page.activity") }}
      </h2>
      <p :class="tacticalSectionDescriptionClasses">
        {{ $t("community.server_page.activity_description") }}
      </p>
      <div class="rounded-lg border border-border px-4 py-3.5">
        <ServerActivityChart
          :hourly="stats?.hourly ?? []"
          :server-label="label"
        />
      </div>
    </section>

    <div class="tac-section-sep">
      <ServerLeaderboard :server-id="serverId" />
    </div>
  </div>
</template>
