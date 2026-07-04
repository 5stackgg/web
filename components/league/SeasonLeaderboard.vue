<script setup lang="ts">
import gql from "graphql-tag";
import { ref, computed, watch, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import StatLabel from "~/components/common/StatLabel.vue";
import StatChevron from "~/components/StatChevron.vue";
import Pagination from "~/components/Pagination.vue";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Skeleton } from "~/components/ui/skeleton";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-vue-next";
import { usePerPage } from "~/composables/usePerPage";
import {
  HLTV_TIER,
  ADR_TIER,
  KAST_TIER,
  type StatTierConfig,
} from "~/utils/statTiers";

// Same rate-stat tiers the global leaderboard uses for chevrons.
const KPR_TIER: StatTierConfig = { dir: "high", cuts: [0.8, 0.7, 0.6, 0.5] };
const DPR_TIER: StatTierConfig = { dir: "low", cuts: [0.6, 0.65, 0.7, 0.75] };
const UDR_TIER: StatTierConfig = { dir: "high", cuts: [8, 6, 4, 2.5] };

// Matches the app's tab-content fade (leaderboard / system-logs / database).
const tabFade = {
  enterActiveClass: "transition-all duration-150 ease-out",
  leaveActiveClass: "transition-all duration-150 ease-out",
  enterFromClass: "translate-y-[2px] opacity-0",
  leaveToClass: "translate-y-[2px] opacity-0",
};

const props = defineProps<{ seasonId: string }>();
const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

type SortField =
  | "value"
  | "secondary_value"
  | "tertiary_value"
  | "matches_played";

// Only the performance categories the league leaderboard function supports.
const CATEGORY_CONFIG: Record<
  string,
  {
    columns: Partial<Record<SortField, string>> & { value: string };
    glossary?: Partial<Record<SortField, string>>;
    tiers?: Partial<Record<SortField, StatTierConfig>>;
  }
> = {
  best_rating: {
    columns: {
      value: "pages.leaderboard.col.rating",
      secondary_value: "pages.leaderboard.col.adr",
      tertiary_value: "pages.leaderboard.col.rounds",
      matches_played: "pages.leaderboard.columns.matches",
    },
    glossary: { value: "hltv", secondary_value: "adr" },
    tiers: { value: HLTV_TIER, secondary_value: ADR_TIER },
  },
  best_adr: {
    columns: {
      value: "pages.leaderboard.col.adr",
      secondary_value: "pages.leaderboard.col.rating",
      tertiary_value: "pages.leaderboard.col.rounds",
      matches_played: "pages.leaderboard.columns.matches",
    },
    glossary: { value: "adr", secondary_value: "hltv" },
    tiers: { value: ADR_TIER, secondary_value: HLTV_TIER },
  },
  best_kast: {
    columns: {
      value: "pages.leaderboard.col.kast",
      secondary_value: "pages.leaderboard.col.rating",
      tertiary_value: "pages.leaderboard.col.rounds",
      matches_played: "pages.leaderboard.columns.matches",
    },
    glossary: { value: "kast", secondary_value: "hltv" },
    tiers: { value: KAST_TIER, secondary_value: HLTV_TIER },
  },
  best_kpr: {
    columns: {
      value: "pages.leaderboard.col.kpr",
      secondary_value: "pages.leaderboard.col.dpr",
      tertiary_value: "pages.leaderboard.col.rounds",
      matches_played: "pages.leaderboard.columns.matches",
    },
    glossary: { value: "kpr", secondary_value: "dpr" },
    tiers: { value: KPR_TIER, secondary_value: DPR_TIER },
  },
  best_udr: {
    columns: {
      value: "pages.leaderboard.col.udr",
      secondary_value: "pages.leaderboard.col.util_damage",
      tertiary_value: "pages.leaderboard.col.rounds",
      matches_played: "pages.leaderboard.columns.matches",
    },
    glossary: { value: "udr" },
    tiers: { value: UDR_TIER },
  },
};

const categories = Object.keys(CATEGORY_CONFIG);
const category = ref<string>("best_rating");
const config = computed(() => CATEGORY_CONFIG[category.value]);

const LEAGUE_LEADERBOARD_QUERY = gql`
  query LeagueSeasonLeaderboard(
    $season_id: uuid!
    $category: String!
    $limit: Int
    $offset: Int
    $order_by: [leaderboard_entries_order_by!]
  ) {
    get_league_season_leaderboard(
      args: { _league_season_id: $season_id, _category: $category }
      limit: $limit
      offset: $offset
      order_by: $order_by
    ) {
      player_steam_id
      player_name
      player_avatar_url
      player_country
      value
      secondary_value
      tertiary_value
      matches_played
    }
    get_league_season_leaderboard_aggregate(
      args: { _league_season_id: $season_id, _category: $category }
    ) {
      aggregate {
        count
      }
    }
  }
`;

const entries = ref<any[]>([]);
const total = ref(0);
const loading = ref(true);
const page = ref(1);
const perPage = usePerPage("league-leaderboard");
const sortBy = ref<SortField | null>(null);
const sortDir = ref<"asc" | "desc">("desc");
const offset = computed(() => (page.value - 1) * perPage.value);

const orderBy = computed(() =>
  sortBy.value ? [{ [sortBy.value]: sortDir.value }] : [{ value: "desc" }],
);

const columnLabels = computed(() => {
  const cols = config.value.columns;
  return {
    value: t(cols.value),
    secondary_value: cols.secondary_value ? t(cols.secondary_value) : null,
    tertiary_value: cols.tertiary_value ? t(cols.tertiary_value) : null,
    matches_played: cols.matches_played ? t(cols.matches_played) : null,
  };
});
const columnGlossary = computed<Partial<Record<SortField, string>>>(
  () => config.value.glossary ?? {},
);
function statTier(field: SortField) {
  return config.value.tiers?.[field];
}
function sortIcon(field: SortField) {
  if (sortBy.value !== field) return ArrowUpDown;
  return sortDir.value === "asc" ? ArrowUp : ArrowDown;
}
function toggleSort(field: SortField) {
  if (sortBy.value === field) {
    if (sortDir.value === "desc") sortDir.value = "asc";
    else {
      sortBy.value = null;
      sortDir.value = "desc";
    }
  } else {
    sortBy.value = field;
    sortDir.value = "desc";
  }
  page.value = 1;
  fetchLeaderboard();
}

function formatValue(v: number | null): string {
  if (v == null) return "—";
  switch (category.value) {
    case "best_rating":
    case "best_kpr":
      return v.toFixed(2);
    case "best_adr":
    case "best_udr":
      return v.toFixed(1);
    case "best_kast":
      return v.toFixed(1) + "%";
    default:
      return String(v);
  }
}
function formatSecondary(v: number | null): string {
  if (v == null) return "—";
  switch (category.value) {
    case "best_rating":
      return v.toFixed(1); // ADR
    case "best_adr":
    case "best_kast":
      return v.toFixed(2); // rating
    case "best_kpr":
      return v.toFixed(2); // DPR
    default:
      return Math.round(v).toLocaleString(); // util damage
  }
}

async function fetchLeaderboard() {
  loading.value = true;
  try {
    const { data } = await apolloClient.query({
      query: LEAGUE_LEADERBOARD_QUERY,
      variables: {
        season_id: props.seasonId,
        category: category.value,
        limit: perPage.value,
        offset: offset.value,
        order_by: orderBy.value,
      },
      fetchPolicy: "network-only",
    });
    const rows = data?.get_league_season_leaderboard ?? [];
    entries.value = rows.map((r: any, i: number) => ({
      ...r,
      rank: offset.value + i + 1,
      value: Number(r.value),
      secondary_value:
        r.secondary_value != null ? Number(r.secondary_value) : null,
      tertiary_value:
        r.tertiary_value != null ? Number(r.tertiary_value) : null,
      matches_played:
        r.matches_played != null ? Number(r.matches_played) : null,
    }));
    total.value =
      Number(data?.get_league_season_leaderboard_aggregate?.aggregate?.count) ||
      0;
  } catch (error) {
    console.error("league leaderboard fetch failed", error);
    entries.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

watch(category, () => {
  sortBy.value = null;
  sortDir.value = "desc";
  page.value = 1;
  fetchLeaderboard();
});

onMounted(fetchLeaderboard);
</script>

<template>
  <div class="space-y-4">
    <!-- Category selector -->
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="cat in categories"
        :key="cat"
        class="inline-flex h-8 items-center rounded-md border px-3 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.12em] transition-colors"
        :class="
          category === cat
            ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
            : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground'
        "
        @click="category = cat"
      >
        {{ $t(`pages.leaderboard.categories.${cat}`) }}
      </button>
    </div>

    <Transition v-bind="tabFade" mode="out-in">
      <div v-if="loading" key="loading" class="space-y-3 p-2">
        <div v-for="i in 6" :key="i" class="flex items-center gap-4">
          <Skeleton class="h-6 w-8" />
          <Skeleton class="h-9 w-9 rounded" />
          <Skeleton class="h-6 flex-1" />
          <Skeleton class="h-6 w-16" />
        </div>
      </div>

      <p
        v-else-if="!entries.length"
        key="empty"
        class="py-8 text-center text-sm text-muted-foreground"
      >
        {{ $t("league.stats.empty") }}
      </p>

      <div
        v-else
        key="table"
        class="overflow-x-auto rounded-lg border border-border"
      >
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead class="w-12 text-center">{{
                $t("pages.leaderboard.columns.rank")
              }}</TableHead>
              <TableHead>{{ $t("common.player") }}</TableHead>
              <TableHead
                class="cursor-pointer select-none text-right hover:text-foreground"
                @click="toggleSort('value')"
              >
                <div class="flex items-center justify-end gap-1">
                  <StatLabel
                    v-if="columnGlossary.value"
                    :stat="columnGlossary.value"
                    :label="columnLabels.value"
                    header
                  />
                  <template v-else>{{ columnLabels.value }}</template>
                  <component :is="sortIcon('value')" class="h-3.5 w-3.5" />
                </div>
              </TableHead>
              <TableHead
                v-if="columnLabels.secondary_value"
                class="cursor-pointer select-none text-right hover:text-foreground"
                @click="toggleSort('secondary_value')"
              >
                <div class="flex items-center justify-end gap-1">
                  <StatLabel
                    v-if="columnGlossary.secondary_value"
                    :stat="columnGlossary.secondary_value"
                    :label="columnLabels.secondary_value ?? ''"
                    header
                  />
                  <template v-else>{{ columnLabels.secondary_value }}</template>
                  <component
                    :is="sortIcon('secondary_value')"
                    class="h-3.5 w-3.5"
                  />
                </div>
              </TableHead>
              <TableHead
                v-if="columnLabels.tertiary_value"
                class="cursor-pointer select-none text-right hover:text-foreground"
                @click="toggleSort('tertiary_value')"
              >
                <div class="flex items-center justify-end gap-1">
                  {{ columnLabels.tertiary_value }}
                  <component
                    :is="sortIcon('tertiary_value')"
                    class="h-3.5 w-3.5"
                  />
                </div>
              </TableHead>
              <TableHead
                v-if="columnLabels.matches_played"
                class="cursor-pointer select-none text-right hover:text-foreground"
                @click="toggleSort('matches_played')"
              >
                <div class="flex items-center justify-end gap-1">
                  {{ columnLabels.matches_played }}
                  <component
                    :is="sortIcon('matches_played')"
                    class="h-3.5 w-3.5"
                  />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="entry in entries"
              :key="entry.player_steam_id"
              class="cursor-pointer"
            >
              <NuxtLink
                :to="{
                  name: 'players-id',
                  params: { id: entry.player_steam_id },
                }"
                class="contents"
              >
                <TableCell
                  class="text-center font-mono text-sm text-muted-foreground"
                >
                  {{ entry.rank }}
                </TableCell>
                <TableCell>
                  <PlayerDisplay
                    :player="{
                      steam_id: entry.player_steam_id,
                      name: entry.player_name,
                      avatar_url: entry.player_avatar_url,
                      country: entry.player_country,
                    }"
                    :show-elo="false"
                    :show-online="false"
                    :show-role="false"
                    :linkable="false"
                    size="xs"
                  />
                </TableCell>
                <TableCell
                  class="text-right font-mono font-semibold tabular-nums"
                >
                  <span class="inline-flex items-center justify-end gap-1">
                    {{ formatValue(entry.value) }}
                    <StatChevron
                      v-if="statTier('value')"
                      :cfg="statTier('value')"
                      :value="entry.value"
                    />
                  </span>
                </TableCell>
                <TableCell
                  v-if="columnLabels.secondary_value"
                  class="text-right font-mono tabular-nums text-muted-foreground"
                >
                  <span class="inline-flex items-center justify-end gap-1">
                    {{ formatSecondary(entry.secondary_value) }}
                    <StatChevron
                      v-if="statTier('secondary_value')"
                      :cfg="statTier('secondary_value')"
                      :value="entry.secondary_value"
                    />
                  </span>
                </TableCell>
                <TableCell
                  v-if="columnLabels.tertiary_value"
                  class="text-right font-mono tabular-nums text-muted-foreground"
                >
                  {{ entry.tertiary_value ?? "—" }}
                </TableCell>
                <TableCell
                  v-if="columnLabels.matches_played"
                  class="text-right font-mono tabular-nums text-muted-foreground"
                >
                  {{ entry.matches_played ?? "—" }}
                </TableCell>
              </NuxtLink>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Transition>

    <Pagination
      v-if="total > perPage || perPage !== 10"
      :page="page"
      :per-page="perPage"
      :total="total"
      :show-per-page-selector="true"
      @page="(p: number) => ((page = p), fetchLeaderboard())"
      @update:perPage="
        (v: number) => ((perPage = v), (page = 1), fetchLeaderboard())
      "
    />
  </div>
</template>
