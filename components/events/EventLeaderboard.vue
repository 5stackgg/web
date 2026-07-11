<script setup lang="ts">
import gql from "graphql-tag";
import { ref, computed, watch, onMounted } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import EventPlayerProfile from "~/components/events/EventPlayerProfile.vue";
import Pagination from "~/components/Pagination.vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import {
  tacticalTabsListClasses,
  tacticalTabsTriggerClasses,
} from "~/utilities/tacticalClasses";

// refreshKey bumps when the event's tournaments/teams/players change so the
// board recomputes retroactively as members are attached.
const props = defineProps<{ eventId: string; refreshKey?: string | number }>();

type Category = "rating" | "adr" | "kdr" | "kills" | "wins";

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

// `get_event_leaderboard` always returns `secondary_value = kills` and
// `tertiary_value = deaths`, unlike the global `get_leaderboard` where those
// columns shift meaning per category. Only the primary "value" column label
// changes with the selected category.
const CATEGORIES: Category[] = ["rating", "adr", "kdr", "kills", "wins"];

const VALUE_LABEL_KEYS: Record<Category, string> = {
  rating: "event.leaderboard.col.rating",
  adr: "event.leaderboard.col.adr",
  kdr: "event.leaderboard.col.kdr",
  kills: "event.leaderboard.col.kills",
  wins: "event.leaderboard.col.wins",
};

const EVENT_LEADERBOARD_QUERY = gql`
  query GetEventLeaderboard(
    $eventId: uuid!
    $category: String!
    $matchType: String
    $minRounds: Int
    $limit: Int
    $offset: Int
  ) {
    get_event_leaderboard(
      args: {
        _event_id: $eventId
        _category: $category
        _match_type: $matchType
        _min_rounds: $minRounds
      }
      order_by: [{ value: desc }]
      limit: $limit
      offset: $offset
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
    get_event_leaderboard_aggregate(
      args: {
        _event_id: $eventId
        _category: $category
        _match_type: $matchType
        _min_rounds: $minRounds
      }
    ) {
      aggregate {
        count
      }
    }
  }
`;

// Same cross-fade the main leaderboard uses so switching category/page
// doesn't blink (old content fades out, new fades in via mode="out-in").
const leaderboardFadeTransition = {
  enterActiveClass: "transition-all duration-150 ease-out",
  leaveActiveClass: "transition-all duration-150 ease-out",
  enterFromClass: "translate-y-[2px] opacity-0",
  leaveToClass: "translate-y-[2px] opacity-0",
};

const { client: apolloClient } = useApolloClient();

// This selector is intentionally a plain ref (not `useRouteTab`), because the
// event detail page already owns the `?tab=` query param for its own
// leaderboard/standings/tournaments/teams tabs; a second `useRouteTab` call
// here with the same default param would collide with it.
const category = ref<Category>("rating");
const page = ref(1);
const perPage = usePerPage("event-leaderboard");
const entries = ref<LeaderboardEntry[]>([]);
const total = ref(0);
const loading = ref(true);

// Row click expands the event-scoped mini profile inline beneath the row
// (Concept B — no modal). A second click on the same row collapses it.
const expandedSteamId = ref<string | null>(null);

const collapsingSteamId = ref<string | null>(null);
function togglePlayer(entry: LeaderboardEntry) {
  const id = entry.player_steam_id;
  if (expandedSteamId.value === id) {
    // Collapse: play the leave animation, then unmount.
    collapsingSteamId.value = id;
    window.setTimeout(() => {
      if (collapsingSteamId.value === id) {
        expandedSteamId.value = null;
        collapsingSteamId.value = null;
      }
    }, 150);
  } else if (expandedSteamId.value) {
    // Switch: collapse the current dossier first, then open the new one so
    // there's no instant pop between rows.
    collapsingSteamId.value = expandedSteamId.value;
    window.setTimeout(() => {
      expandedSteamId.value = id;
      collapsingSteamId.value = null;
    }, 150);
  } else {
    collapsingSteamId.value = null;
    expandedSteamId.value = id;
  }
}

const offset = computed(() => (page.value - 1) * perPage.value);
const valueLabelKey = computed(() => VALUE_LABEL_KEYS[category.value]);

function formatValue(value: number): string {
  switch (category.value) {
    case "rating":
    case "kdr":
      return value.toFixed(2);
    case "adr":
      return value.toFixed(1);
    default:
      return Math.round(value).toLocaleString();
  }
}

function formatCount(value: number | null): string {
  if (value == null) return "-";
  return Math.round(value).toLocaleString();
}

let fetchGeneration = 0;
async function fetchLeaderboard() {
  loading.value = true;
  const gen = ++fetchGeneration;
  try {
    const { data } = await apolloClient.query({
      query: EVENT_LEADERBOARD_QUERY,
      variables: {
        eventId: props.eventId,
        category: category.value,
        matchType: null,
        minRounds: 0,
        limit: perPage.value,
        offset: offset.value,
      },
      fetchPolicy: "network-only",
    });
    if (gen !== fetchGeneration) return;
    const rows = (data as any)?.get_event_leaderboard || [];
    entries.value = rows.map(
      (row: any, index: number): LeaderboardEntry => ({
        ...row,
        rank: offset.value + index + 1,
        value: Number(row.value),
        secondary_value:
          row.secondary_value != null ? Number(row.secondary_value) : null,
        tertiary_value:
          row.tertiary_value != null ? Number(row.tertiary_value) : null,
        matches_played:
          row.matches_played != null ? Number(row.matches_played) : null,
      }),
    );
    total.value =
      Number(
        (data as any)?.get_event_leaderboard_aggregate?.aggregate?.count,
      ) || 0;
  } catch (error) {
    if (gen !== fetchGeneration) return;
    console.error("Error fetching event leaderboard:", error);
    entries.value = [];
    total.value = 0;
  } finally {
    if (gen === fetchGeneration) {
      loading.value = false;
    }
  }
}

function resetAndFetch() {
  page.value = 1;
  fetchLeaderboard();
}

function onPageChange(newPage: number) {
  page.value = newPage;
  fetchLeaderboard();
}

function onPerPageChange(value: number) {
  perPage.value = value;
  page.value = 1;
  fetchLeaderboard();
}

watch(category, resetAndFetch);
watch(
  () => props.eventId,
  () => resetAndFetch(),
);
watch(
  () => props.refreshKey,
  () => resetAndFetch(),
);

onMounted(fetchLeaderboard);
</script>

<template>
  <div>
    <div class="mb-4">
      <!-- Mobile: dropdown -->
      <Select v-model="category">
        <SelectTrigger class="h-9 w-full md:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="cat in CATEGORIES" :key="cat" :value="cat">
            {{ $t(`event.leaderboard.categories.${cat}`) }}
          </SelectItem>
        </SelectContent>
      </Select>
      <!-- Desktop: animated underline tabs (matches the main leaderboard). -->
      <Tabs v-model="category" class="hidden md:block">
        <TabsList variant="underline" :class="tacticalTabsListClasses">
          <TabsTrigger
            v-for="cat in CATEGORIES"
            :key="cat"
            :value="cat"
            :class="tacticalTabsTriggerClasses"
          >
            {{ $t(`event.leaderboard.categories.${cat}`) }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <Transition v-bind="leaderboardFadeTransition" mode="out-in">
      <div v-if="loading" key="loading" class="space-y-3">
        <Skeleton v-for="i in perPage" :key="i" class="h-10 w-full" />
      </div>

      <Empty v-else-if="entries.length === 0" key="empty" class="min-h-[160px]">
        <p class="text-muted-foreground">
          {{ $t("event.leaderboard.no_results") }}
        </p>
      </Empty>

      <Table v-else key="table">
        <TableHeader>
          <TableRow>
            <TableHead class="w-16">{{
              $t("pages.leaderboard.columns.rank")
            }}</TableHead>
            <TableHead>{{ $t("common.player") }}</TableHead>
            <TableHead class="text-right">{{ $t(valueLabelKey) }}</TableHead>
            <TableHead class="text-right">{{
              $t("event.leaderboard.col.kills_short")
            }}</TableHead>
            <TableHead class="text-right">{{
              $t("event.leaderboard.col.deaths_short")
            }}</TableHead>
            <TableHead class="text-right">{{
              $t("event.leaderboard.col.matches")
            }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-for="entry in entries" :key="entry.player_steam_id">
            <TableRow
              class="cursor-pointer"
              :class="{
                'bg-[hsl(var(--tac-amber)/0.08)]':
                  expandedSteamId === entry.player_steam_id,
              }"
              @click="togglePlayer(entry)"
            >
              <TableCell>
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
              </TableCell>
              <TableCell>
                <PlayerDisplay
                  :player="{
                    steam_id: entry.player_steam_id,
                    name: entry.player_name,
                    avatar_url: entry.player_avatar_url,
                    country: entry.player_country,
                  }"
                  size="xs"
                  :show-elo="false"
                  :show-online="false"
                  :show-role="false"
                  :linkable="false"
                />
              </TableCell>
              <TableCell
                class="text-right font-mono font-semibold tabular-nums"
              >
                {{ formatValue(entry.value) }}
              </TableCell>
              <TableCell
                class="text-right font-mono tabular-nums text-muted-foreground"
              >
                {{ formatCount(entry.secondary_value) }}
              </TableCell>
              <TableCell
                class="text-right font-mono tabular-nums text-muted-foreground"
              >
                {{ formatCount(entry.tertiary_value) }}
              </TableCell>
              <TableCell
                class="text-right font-mono tabular-nums text-muted-foreground"
              >
                {{ formatCount(entry.matches_played) }}
              </TableCell>
            </TableRow>
            <TableRow
              v-if="expandedSteamId === entry.player_steam_id"
              class="hover:bg-transparent"
            >
              <TableCell colspan="6" class="bg-card/40 p-0">
                <div
                  class="overflow-hidden p-4"
                  :class="
                    collapsingSteamId === entry.player_steam_id
                      ? 'event-dossier-collapsing'
                      : 'event-dossier-reveal'
                  "
                >
                  <EventPlayerProfile
                    :event-id="eventId"
                    :steam-id="entry.player_steam_id"
                    :name="entry.player_name"
                    :avatar-url="entry.player_avatar_url"
                    :country="entry.player_country"
                    :rank="entry.rank"
                    compact
                  />
                </div>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </Transition>

    <Pagination
      v-if="!loading && total > perPage"
      class="mt-4"
      :page="page"
      :per-page="perPage"
      :total="total"
      :show-per-page-selector="true"
      @page="onPageChange"
      @update:per-page="onPerPageChange"
    />
  </div>
</template>

<style scoped>
/* Reveal when a leaderboard row expands into the dossier. Table rows can't
   host a Vue <Transition> cleanly, so the enter is a keyframe; the leave is
   handled by the parent toggling with a short fade (see toggle handler). */
.event-dossier-reveal {
  animation: dossier-reveal 0.22s ease-out;
}
@keyframes dossier-reveal {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.event-dossier-collapsing {
  animation: dossier-collapse 0.16s ease-in forwards;
}
@keyframes dossier-collapse {
  from {
    opacity: 1;
    transform: none;
  }
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .event-dossier-reveal,
  .event-dossier-collapsing {
    animation: none;
  }
}
</style>
