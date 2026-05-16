<script lang="ts" setup>
import { ref, watch, computed, onBeforeUnmount } from "vue";
import gql from "graphql-tag";
import { useApolloClient } from "@vue/apollo-composable";

const props = defineProps<{
  playerSteamId: string;
}>();

const { client: apolloClient } = useApolloClient();

const RANK_QUERY = gql`
  query PlayerLeaderboardRank(
    $category: String!
    $window_days: Int!
    $match_type: String
    $exclude_tournaments: Boolean!
    $player_steam_id: String!
  ) {
    get_player_leaderboard_rank(
      args: {
        _category: $category
        _window_days: $window_days
        _match_type: $match_type
        _exclude_tournaments: $exclude_tournaments
        _player_steam_id: $player_steam_id
      }
    ) {
      rank
      total
    }
  }
`;

const rank = ref<number | null>(null);
const total = ref<number | null>(null);
let fetchGen = 0;

async function fetchRank() {
  const gen = ++fetchGen;
  rank.value = null;
  total.value = null;

  if (!props.playerSteamId) return;

  try {
    const res = await apolloClient.query({
      query: RANK_QUERY,
      variables: {
        category: "elo",
        window_days: 0,
        match_type: "Competitive",
        exclude_tournaments: false,
        player_steam_id: props.playerSteamId,
      },
      fetchPolicy: "cache-first",
    });
    if (gen !== fetchGen) return;

    const row = (res.data as any)?.get_player_leaderboard_rank?.[0];
    if (!row) return;
    rank.value = row.rank;
    total.value = row.total;
  } catch (err) {
    console.error(
      `[PlayerLeaderboardRank] failed to fetch rank for ${props.playerSteamId}`,
      err,
    );
  }
}

watch(
  () => props.playerSteamId,
  () => {
    fetchRank();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  fetchGen++;
});

const percentile = computed(() => {
  if (!rank.value || !total.value) return null;
  return Math.max(1, Math.ceil((rank.value / total.value) * 100));
});

const rankLabel = computed(() =>
  rank.value !== null ? `#${rank.value.toLocaleString()}` : null,
);

const triggerClasses = [
  "group/rank relative inline-flex items-center gap-1.5 cursor-pointer select-none",
  "px-[0.55rem] py-[0.2rem] rounded",
  "border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--card)/0.55)]",
  "[backdrop-filter:blur(6px)]",
  "transition-[transform,border-color,box-shadow] duration-150",
  "hover:border-[hsl(var(--tac-amber)/0.85)] hover:-translate-y-px",
  "hover:shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.25),0_6px_18px_-8px_hsl(var(--tac-amber)/0.55)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.5)]",
].join(" ");

const notchClasses =
  "h-[6px] w-[6px] rounded-[1px] bg-[hsl(var(--tac-amber))] [box-shadow:0_0_8px_hsl(var(--tac-amber)/0.7)]";

const labelClasses =
  "font-mono text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground/85 group-hover/rank:text-[hsl(var(--tac-amber))]";

const sepClasses = "h-2.5 w-px bg-border/70";

const rankValueClasses =
  "font-mono text-[0.7rem] font-bold tabular-nums tracking-[0.04em] text-[hsl(var(--tac-amber))] [text-shadow:0_0_10px_hsl(var(--tac-amber)/0.35)]";

const percentileClasses =
  "font-mono text-[0.6rem] font-semibold uppercase tabular-nums tracking-[0.14em] text-[hsl(var(--tac-amber)/0.85)]";
</script>

<template>
  <NuxtLink
    v-if="rankLabel"
    :to="{
      path: '/leaderboard',
      query: {
        tab: 'elo',
        period: '0',
        type: 'Competitive',
        player: playerSteamId,
      },
    }"
    :class="triggerClasses"
    :aria-label="`${$t('pages.players.detail.global_rank')} ${rankLabel}`"
    :title="$t('pages.players.detail.global_rank')"
    @click.stop
  >
    <span :class="notchClasses" aria-hidden="true"></span>
    <span :class="labelClasses">{{ $t("pages.players.detail.rank") }}</span>
    <span :class="sepClasses" aria-hidden="true"></span>
    <span :class="rankValueClasses">{{ rankLabel }}</span>
    <span v-if="percentile" :class="sepClasses" aria-hidden="true"></span>
    <span v-if="percentile" :class="percentileClasses">
      {{ $t("pages.players.detail.top_percent", { percent: percentile }) }}
    </span>
  </NuxtLink>
</template>
