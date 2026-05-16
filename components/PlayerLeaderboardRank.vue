<script lang="ts" setup>
import { ref, watch, computed, onBeforeUnmount } from "vue";
import gql from "graphql-tag";
import { useApolloClient } from "@vue/apollo-composable";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "~/components/ui/hover-card";

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

const cardClasses = [
  "relative w-[260px] p-0 overflow-hidden",
  "border border-border/80 rounded-none",
  "bg-[hsl(240_8%_10%)] text-[hsl(var(--popover-foreground))]",
  "[font-family:'Oxanium',sans-serif]",
  "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04),0_0_0_1px_hsl(var(--tac-amber)/0.08),0_18px_40px_-12px_hsl(0_0%_0%/0.85)]",
  "[background-image:radial-gradient(circle_at_top_right,hsl(var(--tac-amber)/0.10)_0%,transparent_55%),linear-gradient(180deg,hsl(0_0%_100%/0.02)_0%,transparent_60%)]",
].join(" ");

const cardHeaderClasses =
  "flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-border/60 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.26em] text-muted-foreground";

const cardHeaderAccent = "text-[hsl(var(--tac-amber))]";

const cardRowClasses =
  "flex items-center justify-between px-3 py-2 font-mono text-[0.7rem] uppercase tracking-[0.14em]";

const cardRowLabel = "text-muted-foreground";

const cardRowValue =
  "tabular-nums text-[hsl(var(--tac-amber))] [text-shadow:0_0_8px_hsl(var(--tac-amber)/0.35)]";
</script>

<template>
  <HoverCard v-if="rankLabel" :open-delay="80" :close-delay="140">
    <HoverCardTrigger as-child>
      <button
        type="button"
        :class="triggerClasses"
        :aria-label="`${$t('pages.players.detail.global_rank')} ${rankLabel}`"
      >
        <span :class="notchClasses" aria-hidden="true"></span>
        <span :class="labelClasses">{{ $t("pages.players.detail.rank") }}</span>
        <span :class="sepClasses" aria-hidden="true"></span>
        <span :class="rankValueClasses">{{ rankLabel }}</span>
        <span v-if="percentile" :class="sepClasses" aria-hidden="true"></span>
        <span v-if="percentile" :class="percentileClasses">
          {{ $t("pages.players.detail.top_percent", { percent: percentile }) }}
        </span>
      </button>
    </HoverCardTrigger>
    <HoverCardContent
      :side-offset="8"
      :collision-padding="12"
      :class="cardClasses"
    >
      <header :class="cardHeaderClasses">
        <span>
          <span :class="cardHeaderAccent">◢</span>
          {{ $t("pages.players.detail.global_rank") }}
        </span>
        <span :class="cardHeaderAccent">
          {{ $t("pages.leaderboard.match_types.competitive") }}
        </span>
      </header>
      <div :class="cardRowClasses">
        <span :class="cardRowLabel">
          {{ $t("pages.leaderboard.time_periods.all_time") }}
        </span>
        <span :class="cardRowValue">
          {{
            $t("pages.players.detail.rank_of_total", {
              rank: rank!.toLocaleString(),
              total: total!.toLocaleString(),
            })
          }}
        </span>
      </div>
    </HoverCardContent>
  </HoverCard>
</template>
