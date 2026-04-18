<script setup lang="ts">
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import Pagination from "~/components/Pagination.vue";
import { Trophy, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-vue-next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import Empty from "~/components/ui/empty/Empty.vue";

const leaderboardFadeTransition = {
  enterActiveClass: "transition-all duration-150 ease-out",
  leaveActiveClass: "transition-all duration-150 ease-out",
  enterFromClass: "translate-y-[2px] opacity-0",
  leaveToClass: "translate-y-[2px] opacity-0",
};
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #title>{{ $t("pages.leaderboard.title") }}</template>
      <template #actions="{ tabs }">
        <Tabs v-model="category">
          <TabsList variant="underline" :class="tabs.listClass">
            <TabsTrigger
              v-for="cat in categories"
              :key="cat.value"
              :value="cat.value"
              :class="tabs.triggerClass"
            >
              {{ $t(`pages.leaderboard.categories.${cat.value}`) }}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <!-- Compact filter bar -->
  <PageTransition :delay="100" class="mt-6">
    <div
      class="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-card/40 backdrop-blur border border-border"
    >
      <div
        class="flex items-center gap-2 px-2 text-[0.65rem] font-mono tracking-[0.22em] uppercase text-muted-foreground"
      >
        <span
          class="inline-block h-[2px] w-2 bg-[hsl(var(--tac-amber))]"
        ></span>
        {{ $t("common.filters") }}
      </div>

      <Select v-model="windowDays">
        <SelectTrigger class="h-9 w-[180px]">
          <SelectValue
            :placeholder="$t('pages.leaderboard.time_periods.last_30_days')"
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">{{
            $t("pages.leaderboard.time_periods.last_7_days")
          }}</SelectItem>
          <SelectItem value="30">{{
            $t("pages.leaderboard.time_periods.last_30_days")
          }}</SelectItem>
          <SelectItem value="0">{{
            $t("pages.leaderboard.time_periods.all_time")
          }}</SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="matchType">
        <SelectTrigger class="h-9 w-[180px]">
          <SelectValue :placeholder="$t('pages.leaderboard.match_types.all')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{{
            $t("pages.leaderboard.match_types.all")
          }}</SelectItem>
          <SelectItem value="Competitive">{{
            $t("pages.leaderboard.match_types.competitive")
          }}</SelectItem>
          <SelectItem value="Wingman">{{
            $t("pages.leaderboard.match_types.wingman")
          }}</SelectItem>
          <SelectItem value="Duel">{{
            $t("pages.leaderboard.match_types.duel")
          }}</SelectItem>
        </SelectContent>
      </Select>

      <div
        class="ml-auto flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs tracking-[0.06em] transition-colors duration-150"
        :class="
          excludeTournaments
            ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.13)] text-[hsl(var(--tac-amber))]'
            : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
        "
        @click="toggleExcludeTournaments"
      >
        <Trophy class="h-3.5 w-3.5" />
        <span id="leaderboard-exclude-tournaments-label">
          {{ $t("pages.leaderboard.exclude_tournaments") }}
        </span>
        <Switch
          v-model="excludeTournaments"
          aria-labelledby="leaderboard-exclude-tournaments-label"
          class="ml-1 data-[state=checked]:bg-[hsl(var(--tac-amber))] data-[state=unchecked]:bg-muted/70"
          @click.stop
        />
      </div>
    </div>
  </PageTransition>

  <!-- Results -->
  <PageTransition :delay="300" class="mt-6">
    <div>
      <div class="p-4 relative">
        <Transition v-bind="leaderboardFadeTransition" mode="out-in">
          <!-- Loading -->
          <div v-if="loading" key="loading" class="space-y-4">
            <div v-for="i in perPage" :key="i" class="flex items-center gap-4">
              <Skeleton class="h-6 w-8" />
              <Skeleton class="h-10 w-10 rounded" />
              <Skeleton class="h-6 flex-1" />
              <Skeleton class="h-6 w-20" />
            </div>
          </div>

          <!-- Empty State -->
          <Empty v-else-if="!entries || entries.length === 0" key="empty">
            <p class="text-muted-foreground">
              {{ $t("pages.leaderboard.no_results") }}
            </p>
          </Empty>

          <!-- Results Table -->
          <Table v-else key="table">
            <TableHeader>
              <TableRow>
                <TableHead class="w-16">{{
                  $t("pages.leaderboard.columns.rank")
                }}</TableHead>
                <TableHead>{{ $t("common.player") }}</TableHead>
                <TableHead
                  class="text-right"
                  :class="{
                    'cursor-pointer select-none hover:text-foreground':
                      isSortable('value'),
                  }"
                  @click="toggleSort('value')"
                >
                  <div
                    class="flex items-center justify-end gap-1"
                    :style="trophyTierColor('value') ? { color: trophyTierColor('value') } : {}"
                  >
                    <span
                      v-if="trophyTierColor('value')"
                      class="inline-block h-1.5 w-1.5 rounded-full"
                      :style="{
                        background: trophyTierColor('value'),
                        boxShadow: `0 0 4px ${trophyTierColor('value')}`,
                      }"
                    ></span>
                    {{ columnLabels.value }}
                    <component
                      v-if="isSortable('value')"
                      :is="sortIcon('value')"
                      class="h-3.5 w-3.5"
                    />
                  </div>
                </TableHead>
                <TableHead
                  v-if="columnLabels.secondary_value"
                  class="text-right"
                  :class="{
                    'cursor-pointer select-none hover:text-foreground':
                      isSortable('secondary_value'),
                  }"
                  @click="toggleSort('secondary_value')"
                >
                  <div
                    class="flex items-center justify-end gap-1"
                    :style="
                      trophyTierColor('secondary_value')
                        ? { color: trophyTierColor('secondary_value') }
                        : {}
                    "
                  >
                    <span
                      v-if="trophyTierColor('secondary_value')"
                      class="inline-block h-1.5 w-1.5 rounded-full"
                      :style="{
                        background: trophyTierColor('secondary_value'),
                        boxShadow: `0 0 4px ${trophyTierColor('secondary_value')}`,
                      }"
                    ></span>
                    {{ columnLabels.secondary_value }}
                    <component
                      v-if="isSortable('secondary_value')"
                      :is="sortIcon('secondary_value')"
                      class="h-3.5 w-3.5"
                    />
                  </div>
                </TableHead>
                <TableHead
                  v-if="columnLabels.tertiary_value"
                  class="text-right"
                  :class="{
                    'cursor-pointer select-none hover:text-foreground':
                      isSortable('tertiary_value'),
                  }"
                  @click="toggleSort('tertiary_value')"
                >
                  <div
                    class="flex items-center justify-end gap-1"
                    :style="
                      trophyTierColor('tertiary_value')
                        ? { color: trophyTierColor('tertiary_value') }
                        : {}
                    "
                  >
                    <span
                      v-if="trophyTierColor('tertiary_value')"
                      class="inline-block h-1.5 w-1.5 rounded-full"
                      :style="{
                        background: trophyTierColor('tertiary_value'),
                        boxShadow: `0 0 4px ${trophyTierColor('tertiary_value')}`,
                      }"
                    ></span>
                    {{ columnLabels.tertiary_value }}
                    <component
                      v-if="isSortable('tertiary_value')"
                      :is="sortIcon('tertiary_value')"
                      class="h-3.5 w-3.5"
                    />
                  </div>
                </TableHead>
                <TableHead
                  v-if="columnLabels.matches_played"
                  class="text-right"
                  :class="{
                    'cursor-pointer select-none hover:text-foreground':
                      isSortable('matches_played'),
                  }"
                  @click="toggleSort('matches_played')"
                >
                  <div
                    class="flex items-center justify-end gap-1"
                    :style="
                      trophyTierColor('matches_played')
                        ? { color: trophyTierColor('matches_played') }
                        : {}
                    "
                  >
                    <span
                      v-if="trophyTierColor('matches_played')"
                      class="inline-block h-1.5 w-1.5 rounded-full"
                      :style="{
                        background: trophyTierColor('matches_played'),
                        boxShadow: `0 0 4px ${trophyTierColor('matches_played')}`,
                      }"
                    ></span>
                    {{ columnLabels.matches_played }}
                    <component
                      v-if="isSortable('matches_played')"
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
                  <TableCell>
                    <div class="flex items-center justify-center">
                      <span
                        :class="{
                          'text-yellow-400 font-bold': entry.rank === 1,
                          'text-gray-300 font-bold': entry.rank === 2,
                          'text-amber-600 font-bold': entry.rank === 3,
                          'text-muted-foreground': entry.rank > 3,
                        }"
                      >
                        {{ entry.rank }}
                      </span>
                    </div>
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
                    :style="
                      trophyTierColor('value') ? { color: trophyTierColor('value') } : {}
                    "
                  >
                    {{ formatValue(entry.value) }}
                  </TableCell>
                  <TableCell
                    v-if="columnLabels.secondary_value"
                    class="text-right font-mono tabular-nums"
                    :class="{ 'text-muted-foreground': !trophyTierColor('secondary_value') }"
                    :style="
                      trophyTierColor('secondary_value')
                        ? { color: trophyTierColor('secondary_value') }
                        : {}
                    "
                  >
                    {{ formatSecondary(entry.secondary_value) }}
                  </TableCell>
                  <TableCell
                    v-if="columnLabels.tertiary_value"
                    class="text-right font-mono tabular-nums"
                    :class="{ 'text-muted-foreground': !trophyTierColor('tertiary_value') }"
                    :style="
                      trophyTierColor('tertiary_value')
                        ? { color: trophyTierColor('tertiary_value') }
                        : {}
                    "
                  >
                    {{ formatTertiary(entry.tertiary_value) }}
                  </TableCell>
                  <TableCell
                    v-if="columnLabels.matches_played"
                    class="text-right font-mono tabular-nums"
                    :class="{ 'text-muted-foreground': !trophyTierColor('matches_played') }"
                    :style="
                      trophyTierColor('matches_played')
                        ? {
                            color: trophyTierColor('matches_played'),
                            fontWeight: category === 'trophies' ? 600 : 400,
                          }
                        : {}
                    "
                  >
                    {{ entry.matches_played ?? "\u2014" }}
                  </TableCell>
                </NuxtLink>
              </TableRow>
            </TableBody>
          </Table>
        </Transition>
      </div>

      <!-- Pagination -->
      <Pagination
        v-if="total > 0"
        :page="page"
        :per-page="perPage"
        :total="total"
        :show-per-page-selector="true"
        @page="onPageChange"
        @update:perPage="onPerPageChange"
      />
    </div>
  </PageTransition>
</template>

<script lang="ts">
import gql from "graphql-tag";

const LEADERBOARD_QUERY = gql`
  query GetLeaderboard(
    $category: String!
    $window_days: Int!
    $match_type: String
    $exclude_tournaments: Boolean!
    $limit: Int
    $offset: Int
    $order_by: [leaderboard_entries_order_by!]
  ) {
    get_leaderboard(
      args: {
        _category: $category
        _window_days: $window_days
        _match_type: $match_type
        _exclude_tournaments: $exclude_tournaments
      }
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
    get_leaderboard_aggregate(
      args: {
        _category: $category
        _window_days: $window_days
        _match_type: $match_type
        _exclude_tournaments: $exclude_tournaments
      }
    ) {
      aggregate {
        count
      }
    }
  }
`;

interface LeaderboardEntry {
  rank: number;
  player_steam_id: string;
  player_name: string;
  player_avatar_url: string | null;
  player_country: string | null;
  value: number;
  secondary_value: number | null;
  tertiary_value: number | null;
  matches_played: number | null;
}

type SortField =
  | "value"
  | "secondary_value"
  | "tertiary_value"
  | "matches_played";

// Per-category column configuration
const CATEGORY_CONFIG: Record<
  string,
  {
    columns: {
      value: string;
      secondary_value?: string;
      tertiary_value?: string;
      matches_played?: string;
    };
    sortable: SortField[];
  }
> = {
  elo: {
    columns: {
      value: "pages.leaderboard.col.elo",
      secondary_value: "pages.leaderboard.col.elo_change",
      tertiary_value: "pages.leaderboard.col.win_streak",
      matches_played: "pages.leaderboard.columns.matches",
    },
    sortable: ["value", "secondary_value", "tertiary_value", "matches_played"],
  },
  best_kdr: {
    columns: {
      value: "pages.leaderboard.col.kdr",
      secondary_value: "pages.leaderboard.col.kills",
      tertiary_value: "pages.leaderboard.col.deaths",
      matches_played: "pages.leaderboard.columns.matches",
    },
    sortable: ["value", "secondary_value", "tertiary_value", "matches_played"],
  },
  best_win_rate: {
    columns: {
      value: "common.stats.win_rate",
      secondary_value: "pages.leaderboard.col.wins",
      tertiary_value: "pages.leaderboard.col.losses",
      matches_played: "pages.leaderboard.columns.matches",
    },
    sortable: ["value", "secondary_value", "tertiary_value", "matches_played"],
  },
  highest_hs_pct: {
    columns: {
      value: "pages.leaderboard.col.hs_pct",
      secondary_value: "pages.leaderboard.col.total_kills",
      matches_played: "pages.leaderboard.columns.matches",
    },
    sortable: ["value", "secondary_value", "matches_played"],
  },
  trophies: {
    columns: {
      value: "pages.leaderboard.col.gold",
      secondary_value: "pages.leaderboard.col.silver",
      tertiary_value: "pages.leaderboard.col.bronze",
      matches_played: "pages.leaderboard.col.mvp",
    },
    sortable: ["value", "secondary_value", "tertiary_value", "matches_played"],
  },
};

const TIER_COLORS: Record<string, string> = {
  mvp: "hsl(195 85% 60%)",
  gold: "hsl(45 95% 60%)",
  silver: "hsl(0 0% 78%)",
  bronze: "hsl(28 70% 52%)",
};

export default {
  data() {
    return {
      category: "elo",
      windowDays: "30",
      matchType: "all",
      excludeTournaments: false,
      entries: [] as LeaderboardEntry[],
      total: 0,
      page: 1,
      perPage: 10,
      loading: true,
      fetchGeneration: 0,
      sortBy: null as SortField | null,
      sortDir: "desc" as "asc" | "desc",
      categories: [
        { value: "elo" },
        { value: "best_kdr" },
        { value: "best_win_rate" },
        { value: "highest_hs_pct" },
        { value: "trophies" },
      ],
    };
  },
  computed: {
    config() {
      return CATEGORY_CONFIG[this.category];
    },
    columnLabels() {
      const cols = this.config.columns;
      return {
        value: this.$t(cols.value),
        secondary_value: cols.secondary_value
          ? this.$t(cols.secondary_value)
          : null,
        tertiary_value: cols.tertiary_value
          ? this.$t(cols.tertiary_value)
          : null,
        matches_played: cols.matches_played
          ? this.$t(cols.matches_played)
          : null,
      };
    },
    offset() {
      return (this.page - 1) * this.perPage;
    },
    orderBy() {
      if (this.sortBy) {
        return [{ [this.sortBy]: this.sortDir }];
      }
      if (this.category === "trophies") {
        return [
          { matches_played: "desc" },
          { value: "desc" },
          { secondary_value: "desc" },
          { tertiary_value: "desc" },
        ];
      }
      return [{ value: "desc" }];
    },
    queryVariables() {
      return {
        category: this.category,
        window_days: parseInt(this.windowDays),
        match_type: this.matchType === "all" ? null : this.matchType,
        exclude_tournaments: Boolean(this.excludeTournaments),
        limit: this.perPage,
        offset: this.offset,
        order_by: this.orderBy,
      };
    },
  },
  watch: {
    category() {
      this.sortBy = null;
      this.sortDir = "desc";
      this.onFilterChange();
    },
    windowDays() {
      this.onFilterChange();
    },
    matchType() {
      this.onFilterChange();
    },
    excludeTournaments() {
      this.onFilterChange();
    },
  },
  mounted() {
    this.fetchLeaderboard();
  },
  methods: {
    isSortable(field: SortField): boolean {
      return this.config.sortable.includes(field);
    },
    sortIcon(field: SortField) {
      if (this.sortBy !== field) return ArrowUpDown;
      return this.sortDir === "asc" ? ArrowUp : ArrowDown;
    },
    toggleSort(field: SortField) {
      if (!this.isSortable(field)) return;
      if (this.sortBy === field) {
        if (this.sortDir === "desc") {
          this.sortDir = "asc";
        } else {
          this.sortBy = null;
          this.sortDir = "desc";
        }
      } else {
        this.sortBy = field;
        this.sortDir = "desc";
      }
      this.page = 1;
      this.fetchLeaderboard();
    },
    onFilterChange() {
      this.page = 1;
      this.fetchLeaderboard();
    },
    toggleExcludeTournaments() {
      this.excludeTournaments = !this.excludeTournaments;
    },
    onPageChange(newPage: number) {
      this.page = newPage;
      this.fetchLeaderboard();
    },
    onPerPageChange(value: number) {
      this.perPage = value;
      this.page = 1;
      this.fetchLeaderboard();
    },
    async fetchLeaderboard() {
      this.loading = true;
      const gen = ++this.fetchGeneration;
      try {
        const { data } = await this.$apollo.query({
          query: LEADERBOARD_QUERY,
          variables: this.queryVariables,
          fetchPolicy: "network-only",
        });
        if (gen !== this.fetchGeneration) return;
        const rows = data?.get_leaderboard || [];
        this.entries = rows.map(
          (row: any, index: number): LeaderboardEntry => ({
            ...row,
            rank: this.offset + index + 1,
            value: Number(row.value),
            secondary_value:
              row.secondary_value != null ? Number(row.secondary_value) : null,
            tertiary_value:
              row.tertiary_value != null ? Number(row.tertiary_value) : null,
            matches_played:
              row.matches_played != null ? Number(row.matches_played) : null,
          }),
        );
        this.total =
          Number(data?.get_leaderboard_aggregate?.aggregate?.count) || 0;
      } catch (error) {
        if (gen !== this.fetchGeneration) return;
        console.error("Error fetching leaderboard:", error);
        this.entries = [];
        this.total = 0;
      } finally {
        if (gen === this.fetchGeneration) {
          this.loading = false;
        }
      }
    },
    formatValue(value: number): string {
      if (value == null) return "\u2014";
      switch (this.category) {
        case "elo":
          return Math.round(value).toLocaleString();
        case "best_kdr":
          return value.toFixed(2);
        case "best_win_rate":
        case "highest_hs_pct":
          return value.toFixed(1) + "%";
        case "trophies":
          return Math.round(value).toLocaleString();
        default:
          return String(value);
      }
    },
    formatSecondary(value: number | null): string {
      if (value == null) return "\u2014";
      if (this.category === "elo") {
        const rounded = Math.round(value);
        return (rounded >= 0 ? "+" : "") + rounded.toLocaleString();
      }
      return Math.round(value).toLocaleString();
    },
    formatTertiary(value: number | null): string {
      if (value == null) return "\u2014";
      return Math.round(value).toLocaleString();
    },
    trophyTierColor(
      field: "value" | "secondary_value" | "tertiary_value" | "matches_played",
    ): string | null {
      if (this.category !== "trophies") return null;
      if (field === "value") return TIER_COLORS.gold;
      if (field === "secondary_value") return TIER_COLORS.silver;
      if (field === "tertiary_value") return TIER_COLORS.bronze;
      if (field === "matches_played") return TIER_COLORS.mvp;
      return null;
    },
  },
};
</script>
