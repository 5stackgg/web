<script lang="ts" setup>
import gql from "graphql-tag";
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import Pagination from "~/components/Pagination.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import StatChevron from "~/components/StatChevron.vue";
import StatLabel from "~/components/common/StatLabel.vue";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
} from "~/components/ui/empty";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { usePerPage } from "~/composables/usePerPage";
import { ADR_TIER, HLTV_TIER, KD_TIER } from "~/utils/statTiers";

const props = defineProps<{
  tournament: Record<string, any>;
}>();

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

// Raw gql rather than Zeus: `get_tournament_leaderboard` and its entry table
// only enter the generated schema after codegen, and the sort has to travel as
// a variable anyway — an inline enum literal on a table Zeus has never seen is
// emitted quoted and rejected. Same shape as SeasonLeaderboard.vue.
const TOURNAMENT_LEADERBOARD_QUERY = gql`
  query TournamentLeaderboard(
    $tournament_id: uuid!
    $limit: Int
    $offset: Int
    $order_by: [tournament_leaderboard_entries_order_by!]
  ) {
    get_tournament_leaderboard(
      args: { _tournament_id: $tournament_id }
      limit: $limit
      offset: $offset
      order_by: $order_by
    ) {
      player_steam_id
      player_name
      player_avatar_url
      player_custom_avatar_url
      player_country
      tournament_team_id
      team_name
      rating
      adr
      kills
      deaths
      assists
      kdr
      headshot_percentage
      rounds_played
      matches_played
    }
    get_tournament_leaderboard_aggregate(
      args: { _tournament_id: $tournament_id }
    ) {
      aggregate {
        count
        max {
          rating
        }
      }
    }
  }
`;

const entries = ref<Array<Record<string, any>>>([]);
const totalPlayers = ref(0);
const topRating = ref<number | null>(null);
const loading = ref(true);
const page = ref(1);
const perPage = usePerPage("tournament-leaderboard");
const sortBy = ref("rating");

const offset = computed(() => (page.value - 1) * perPage.value);

const sortOptions = computed(() => [
  { key: "rating", label: t("tournament.stats.col_rating") },
  { key: "adr", label: t("tournament.stats.col_adr") },
  { key: "kdr", label: t("tournament.stats.col_kd") },
  { key: "headshot_percentage", label: t("tournament.stats.col_hs") },
]);

// One order_by key only. A second one is what tips Zeus/vue-tsc into the
// TS2589 depth wall on this schema, and Hasura is stable enough on a single
// sort over a function result.
const orderBy = computed(() => [{ [sortBy.value]: "desc_nulls_last" }]);

// The bracket rows are already in memory from the page's tournament
// subscription — a second round-trip to count matches the reader can see on
// the results tab would be pure ceremony.
const playedTotals = computed(() => {
  let matches = 0;
  let rounds = 0;
  for (const stage of props.tournament?.stages ?? []) {
    for (const bracket of stage.brackets ?? []) {
      const match = bracket.match;
      if (!match) {
        continue;
      }
      if (["Finished", "Forfeit", "Surrendered", "Tie"].includes(match.status)) {
        matches += 1;
      }
      for (const map of match.match_maps ?? []) {
        rounds += Number(map.lineup_1_score ?? 0) + Number(map.lineup_2_score ?? 0);
      }
    }
  }
  return { matches, rounds };
});

const ribbonCells = computed(() => [
  {
    key: "matches",
    label: t("tournament.stats.matches"),
    value: String(playedTotals.value.matches),
  },
  {
    key: "rounds",
    label: t("tournament.stats.rounds"),
    value: String(playedTotals.value.rounds),
  },
  {
    key: "players",
    label: t("tournament.stats.players"),
    value: String(totalPlayers.value),
  },
  {
    key: "top_rating",
    label: t("tournament.stats.top_rating"),
    value: topRating.value === null ? "—" : topRating.value.toFixed(2),
    accent: true,
  },
]);

function number(value: unknown, digits = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "—";
  }
  return parsed.toFixed(digits);
}

async function fetchLeaderboard() {
  loading.value = true;
  try {
    const { data } = await apolloClient.query({
      query: TOURNAMENT_LEADERBOARD_QUERY,
      variables: {
        tournament_id: props.tournament.id,
        limit: perPage.value,
        offset: offset.value,
        order_by: orderBy.value,
      },
      fetchPolicy: "network-only",
    });
    const rows = data?.get_tournament_leaderboard ?? [];
    entries.value = rows.map((row: Record<string, any>, index: number) => ({
      ...row,
      rank: offset.value + index + 1,
    }));
    const aggregate = data?.get_tournament_leaderboard_aggregate?.aggregate;
    totalPlayers.value = Number(aggregate?.count) || 0;
    const max = aggregate?.max?.rating;
    topRating.value = max == null ? null : Number(max);
  } catch (error) {
    console.error("tournament leaderboard fetch failed", error);
    entries.value = [];
    totalPlayers.value = 0;
    topRating.value = null;
  } finally {
    loading.value = false;
  }
}

watch(sortBy, () => {
  page.value = 1;
  void fetchLeaderboard();
});

onMounted(fetchLeaderboard);
</script>

<template>
  <div class="flex flex-col gap-5">
    <div
      class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border/70 sm:grid-cols-4"
    >
      <div
        v-for="cell in ribbonCells"
        :key="cell.key"
        class="min-w-0 bg-card/60 px-5 py-3.5 [backdrop-filter:blur(6px)]"
      >
        <div
          class="font-mono text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70"
        >
          {{ cell.label }}
        </div>
        <div
          class="mt-1 truncate font-sans text-xl font-bold leading-tight tabular-nums"
          :class="cell.accent ? 'text-[hsl(var(--tac-amber))]' : 'text-foreground'"
        >
          {{ cell.value }}
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3
        class="m-0 font-sans text-[1.05rem] font-bold tracking-[0.01em] text-foreground"
      >
        {{ $t("tournament.stats.leaderboard_title") }}
      </h3>
      <AnimatedFilters v-model="sortBy" :options="sortOptions" square />
    </div>

    <FadeSwap>
      <div v-if="loading" key="loading" class="flex flex-col gap-3 p-2">
        <div v-for="row in 6" :key="row" class="flex items-center gap-4">
          <Skeleton class="h-6 w-8" />
          <Skeleton class="h-9 w-9 rounded" />
          <Skeleton class="h-6 flex-1" />
          <Skeleton class="h-6 w-16" />
        </div>
      </div>

      <Empty v-else-if="entries.length === 0" key="empty" class="min-h-[180px]">
        <EmptyTitle>{{ $t("tournament.stats.empty_title") }}</EmptyTitle>
        <EmptyDescription>
          {{ $t("tournament.stats.empty_description") }}
        </EmptyDescription>
      </Empty>

      <!-- Twelve columns never fit a phone: the table scrolls inside this box
           so the page itself never gains a horizontal scrollbar. -->
      <div
        v-else
        key="table"
        class="overflow-x-auto rounded-lg border border-border"
      >
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead class="w-12 text-center">#</TableHead>
              <TableHead>{{ $t("common.player") }}</TableHead>
              <TableHead>{{ $t("tournament.stats.col_team") }}</TableHead>
              <TableHead class="text-right">
                <StatLabel
                  stat="hltv"
                  :label="$t('tournament.stats.col_rating')"
                  header
                />
              </TableHead>
              <TableHead class="text-right">
                <StatLabel
                  stat="adr"
                  :label="$t('tournament.stats.col_adr')"
                  header
                />
              </TableHead>
              <TableHead class="text-right">
                {{ $t("tournament.stats.col_kills") }}
              </TableHead>
              <TableHead class="text-right">
                {{ $t("tournament.stats.col_deaths") }}
              </TableHead>
              <TableHead class="text-right">
                {{ $t("tournament.stats.col_assists") }}
              </TableHead>
              <TableHead class="text-right">
                {{ $t("tournament.stats.col_kd") }}
              </TableHead>
              <TableHead class="text-right">
                {{ $t("tournament.stats.col_hs") }}
              </TableHead>
              <TableHead class="text-right">
                {{ $t("tournament.stats.rounds") }}
              </TableHead>
              <!-- matches_played is COUNT(DISTINCT match_id) — a series, not a
                   map. A Bo3 player reads 1 here, so it must not say "Maps". -->
              <TableHead class="text-right">
                {{ $t("tournament.stats.matches") }}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="entry in entries" :key="entry.player_steam_id">
              <TableCell
                class="text-center font-mono text-sm tabular-nums text-muted-foreground"
              >
                {{ entry.rank }}
              </TableCell>
              <TableCell>
                <PlayerDisplay
                  :player="{
                    steam_id: entry.player_steam_id,
                    name: entry.player_name,
                    avatar_url: entry.player_avatar_url,
                    custom_avatar_url: entry.player_custom_avatar_url,
                    country: entry.player_country,
                  }"
                  size="xs"
                  :linkable="true"
                  :show-elo="false"
                  :show-online="false"
                  :show-role="false"
                />
              </TableCell>
              <TableCell
                class="max-w-[180px] truncate text-sm text-muted-foreground"
              >
                {{ entry.team_name ?? "—" }}
              </TableCell>
              <TableCell
                class="text-right font-mono font-semibold tabular-nums text-[hsl(var(--tac-amber))]"
              >
                <span class="inline-flex items-center justify-end gap-1">
                  {{ number(entry.rating, 2) }}
                  <StatChevron :cfg="HLTV_TIER" :value="Number(entry.rating)" />
                </span>
              </TableCell>
              <TableCell class="text-right font-mono tabular-nums">
                <span class="inline-flex items-center justify-end gap-1">
                  {{ number(entry.adr, 1) }}
                  <StatChevron :cfg="ADR_TIER" :value="Number(entry.adr)" />
                </span>
              </TableCell>
              <TableCell
                class="text-right font-mono tabular-nums text-muted-foreground"
              >
                {{ entry.kills }}
              </TableCell>
              <TableCell
                class="text-right font-mono tabular-nums text-muted-foreground"
              >
                {{ entry.deaths }}
              </TableCell>
              <TableCell
                class="text-right font-mono tabular-nums text-muted-foreground"
              >
                {{ entry.assists }}
              </TableCell>
              <TableCell class="text-right font-mono tabular-nums">
                <span class="inline-flex items-center justify-end gap-1">
                  {{ number(entry.kdr, 2) }}
                  <StatChevron :cfg="KD_TIER" :value="Number(entry.kdr)" />
                </span>
              </TableCell>
              <TableCell
                class="text-right font-mono tabular-nums text-muted-foreground"
              >
                {{ number(entry.headshot_percentage, 1) }}
              </TableCell>
              <TableCell
                class="text-right font-mono tabular-nums text-muted-foreground"
              >
                {{ entry.rounds_played }}
              </TableCell>
              <TableCell
                class="text-right font-mono tabular-nums text-muted-foreground"
              >
                {{ entry.matches_played }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </FadeSwap>

    <Pagination
      v-if="totalPlayers > perPage || perPage !== 10"
      :page="page"
      :per-page="perPage"
      :total="totalPlayers"
      :show-per-page-selector="true"
      @page="(value: number) => ((page = value), fetchLeaderboard())"
      @update:perPage="
        (value: number) => ((perPage = value), (page = 1), fetchLeaderboard())
      "
    />
  </div>
</template>
