<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import Pagination from "~/components/Pagination.vue";
import { Trophy } from "lucide-vue-next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
</script>

<template>
  <PageTransition>
    <PageHeading>
      <template #title>
        <div class="flex items-center gap-2">
          <Trophy class="w-6 h-6" />
          {{ $t("pages.leaderboard.title") }}
        </div>
      </template>
      <template #description>{{ $t("pages.leaderboard.description") }}</template>
    </PageHeading>
  </PageTransition>

  <!-- Filters -->
  <PageTransition :delay="100" class="mt-6">
    <div class="flex flex-col md:flex-row gap-4 mb-4">
      <div class="flex-1">
        <Select v-model="windowDays">
          <SelectTrigger class="w-full md:w-[200px]">
            <SelectValue :placeholder="$t('pages.leaderboard.time_periods.last_30_days')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{{ $t("pages.leaderboard.time_periods.last_7_days") }}</SelectItem>
            <SelectItem value="30">{{ $t("pages.leaderboard.time_periods.last_30_days") }}</SelectItem>
            <SelectItem value="0">{{ $t("pages.leaderboard.time_periods.all_time") }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Select v-model="matchType">
          <SelectTrigger class="w-full md:w-[200px]">
            <SelectValue :placeholder="$t('pages.leaderboard.match_types.all')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ $t("pages.leaderboard.match_types.all") }}</SelectItem>
            <SelectItem value="Competitive">{{ $t("pages.leaderboard.match_types.competitive") }}</SelectItem>
            <SelectItem value="Wingman">{{ $t("pages.leaderboard.match_types.wingman") }}</SelectItem>
            <SelectItem value="Duel">{{ $t("pages.leaderboard.match_types.duel") }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex items-center gap-2">
        <Switch
          id="exclude-tournaments"
          :model-value="excludeTournaments"
          @update:model-value="excludeTournaments = $event"
        />
        <Label for="exclude-tournaments" class="cursor-pointer">
          {{ $t("pages.leaderboard.exclude_tournaments") }}
        </Label>
      </div>
    </div>
  </PageTransition>

  <!-- Category Tabs -->
  <PageTransition :delay="200" class="mt-2">
    <Tabs v-model="category" class="w-full">
      <TabsList class="w-full flex flex-wrap h-auto gap-1">
        <TabsTrigger
          v-for="cat in categories"
          :key="cat.value"
          :value="cat.value"
          class="flex-1 min-w-[120px]"
        >
          {{ $t(`pages.leaderboard.categories.${cat.value}`) }}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  </PageTransition>

  <!-- Results -->
  <PageTransition :delay="300" class="mt-6">
    <div>
    <AnimatedCard variant="gradient" class="p-4 relative">
      <!-- Loading -->
      <div v-if="loading" class="space-y-4">
        <div v-for="i in perPage" :key="i" class="flex items-center gap-4">
          <Skeleton class="h-6 w-8" />
          <Skeleton class="h-10 w-10 rounded" />
          <Skeleton class="h-6 flex-1" />
          <Skeleton class="h-6 w-20" />
        </div>
      </div>

      <!-- Empty State -->
      <Empty v-else-if="!entries || entries.length === 0">
        <p class="text-muted-foreground">
          {{ $t("pages.leaderboard.no_results") }}
        </p>
      </Empty>

      <!-- Results Table -->
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead class="w-16">{{ $t("pages.leaderboard.columns.rank") }}</TableHead>
            <TableHead>{{ $t("pages.leaderboard.columns.player") }}</TableHead>
            <TableHead class="text-right">{{ valueColumnLabel }}</TableHead>
            <TableHead class="text-right" v-if="showSecondaryColumn">{{ secondaryColumnLabel }}</TableHead>
            <TableHead class="text-right" v-if="showMatchesColumn">{{ $t("pages.leaderboard.columns.matches") }}</TableHead>
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
              <TableCell class="text-right font-mono font-semibold">
                {{ formatValue(entry.value) }}
              </TableCell>
              <TableCell class="text-right text-muted-foreground" v-if="showSecondaryColumn">
                {{ formatSecondaryValue(entry.secondary_value) }}
              </TableCell>
              <TableCell class="text-right text-muted-foreground" v-if="showMatchesColumn">
                {{ entry.matches_played ?? "—" }}
              </TableCell>
            </NuxtLink>
          </TableRow>
        </TableBody>
      </Table>
    </AnimatedCard>

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
  query GetLeaderboard($category: String!, $window_days: Int!, $match_type: String, $limit: Int, $offset: Int, $exclude_tournaments: Boolean) {
    getLeaderboard(category: $category, window_days: $window_days, match_type: $match_type, limit: $limit, offset: $offset, exclude_tournaments: $exclude_tournaments) {
      entries {
        rank
        player_steam_id
        player_name
        player_avatar_url
        player_country
        value
        secondary_value
        matches_played
      }
      total
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
  matches_played: number | null;
}

export default {
  data() {
    return {
      category: "highest_elo",
      windowDays: "30",
      matchType: "all",
      excludeTournaments: false,
      entries: [] as LeaderboardEntry[],
      total: 0,
      page: 1,
      perPage: 10,
      loading: true,
      categories: [
        { value: "highest_elo" },
        { value: "most_elo_gained" },
        { value: "most_kills" },
        { value: "best_kdr" },
        { value: "best_win_rate" },
        { value: "most_matches" },
        { value: "highest_hs_pct" },
      ],
    };
  },
  computed: {
    queryVariables() {
      return {
        category: this.category,
        window_days: parseInt(this.windowDays),
        match_type: this.matchType === "all" ? null : this.matchType,
        limit: this.perPage,
        offset: (this.page - 1) * this.perPage,
        exclude_tournaments: this.excludeTournaments || null,
      };
    },
    valueColumnLabel(): string {
      const labels: Record<string, string> = {
        highest_elo: this.$t("pages.leaderboard.value_labels.elo"),
        most_elo_gained: this.$t("pages.leaderboard.value_labels.elo_gained"),
        most_kills: this.$t("pages.leaderboard.value_labels.kills"),
        best_kdr: this.$t("pages.leaderboard.value_labels.kdr"),
        best_win_rate: this.$t("pages.leaderboard.value_labels.win_rate"),
        most_matches: this.$t("pages.leaderboard.value_labels.matches"),
        highest_hs_pct: this.$t("pages.leaderboard.value_labels.hs_pct"),
      };
      return labels[this.category] || this.$t("pages.leaderboard.columns.value");
    },
    secondaryColumnLabel(): string {
      const labels: Record<string, string> = {
        highest_elo: this.$t("pages.leaderboard.secondary_labels.last_change"),
        best_kdr: this.$t("pages.leaderboard.secondary_labels.kills"),
        best_win_rate: this.$t("pages.leaderboard.secondary_labels.wins"),
        highest_hs_pct: this.$t("pages.leaderboard.secondary_labels.total_kills"),
      };
      return labels[this.category] || "";
    },
    showSecondaryColumn(): boolean {
      return ["highest_elo", "best_kdr", "best_win_rate", "highest_hs_pct"].includes(this.category);
    },
    showMatchesColumn(): boolean {
      return ["most_elo_gained", "most_kills", "best_kdr", "best_win_rate", "highest_hs_pct"].includes(this.category);
    },
  },
  watch: {
    category() {
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
    onFilterChange() {
      this.page = 1;
      this.fetchLeaderboard();
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
      try {
        const { data } = await this.$apollo.query({
          query: LEADERBOARD_QUERY,
          variables: this.queryVariables,
          fetchPolicy: "network-only",
        });
        this.entries = data?.getLeaderboard?.entries || [];
        this.total = data?.getLeaderboard?.total || 0;
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
        this.entries = [];
        this.total = 0;
      } finally {
        this.loading = false;
      }
    },
    formatValue(value: number): string {
      if (value == null) return "—";
      switch (this.category) {
        case "highest_elo":
        case "most_elo_gained":
        case "most_kills":
        case "most_matches":
          return Math.round(value).toLocaleString();
        case "best_kdr":
          return value.toFixed(2);
        case "best_win_rate":
        case "highest_hs_pct":
          return value.toFixed(1) + "%";
        default:
          return String(value);
      }
    },
    formatSecondaryValue(value: number | null): string {
      if (value == null) return "—";
      switch (this.category) {
        case "highest_elo":
          const num = Number(value);
          return (num >= 0 ? "+" : "") + Math.round(num).toLocaleString();
        default:
          return Math.round(value).toLocaleString();
      }
    },
  },
};
</script>
