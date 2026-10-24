<script setup lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import gql from "graphql-tag";
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { isRestoringHistory } from "~/composables/useScrollRestoration";
import { useRestoredRefs } from "~/composables/useRestoredState";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import Pagination from "~/components/Pagination.vue";
import {
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Trophy,
} from "lucide-vue-next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Drawer, DrawerContent, DrawerTitle } from "~/components/ui/drawer";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import LeaderboardBoard from "~/components/leaderboard/LeaderboardBoard.vue";
import LeaderboardYouTag from "~/components/leaderboard/LeaderboardYouTag.vue";
import LeaderboardPlayerPanel, {
  type LeaderboardFilters,
  type LeaderboardPanelPlayer,
} from "~/components/leaderboard/LeaderboardPlayerPanel.vue";
import { useAuthStore } from "~/stores/AuthStore";
import {
  EXTERNAL_RANK_SOURCES,
  LEADERBOARD_CATEGORIES,
  ROLE_CATEGORIES,
  leaderboardOrderBy,
  type LeaderboardEntry,
} from "~/utilities/leaderboard";

// The player panel sits beside the board from this page width; narrower, it
// opens as a sheet.
const SIDE_PANEL_MIN_WIDTH = 1024;
// Wide enough for the board's full 1280px plus the panel, the panel opens in
// the gutter beside the board instead of taking width from it.
const GUTTER_MIN_WIDTH = 1664;
// The panel column's leave, so its content stays until the column is shut.
const PANEL_CLOSE_MS = 260;

const LEADERBOARD_QUERY = gql`
  query GetLeaderboard(
    $category: String!
    $window_days: Int!
    $match_type: String
    $exclude_tournaments: Boolean!
    $role: String
    $season_id: uuid
    $source: String
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
        _role: $role
        _season_id: $season_id
        _source: $source
      }
      limit: $limit
      offset: $offset
      order_by: $order_by
    ) {
      player_steam_id
      player_name
      player_avatar_url
      player_custom_avatar_url
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
        _role: $role
        _season_id: $season_id
        _source: $source
      }
    ) {
      aggregate {
        count
        max {
          value
        }
      }
    }
  }
`;

const PLAYER_RANK_QUERY = gql`
  query LeaderboardPlayerRank(
    $category: String!
    $window_days: Int!
    $match_type: String
    $exclude_tournaments: Boolean!
    $season_id: uuid
    $source: String
    $player_steam_id: String!
  ) {
    get_player_leaderboard_rank(
      args: {
        _category: $category
        _window_days: $window_days
        _match_type: $match_type
        _exclude_tournaments: $exclude_tournaments
        _season_id: $season_id
        _source: $source
        _player_steam_id: $player_steam_id
      }
    ) {
      rank
      total
    }
  }
`;

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();
const route = useRoute();
const auth = useAuthStore();
const loggedInSteamId = computed(() => auth.me?.steam_id ?? null);

const category = useRouteTab({
  defaultTab: "elo",
  tabs: Object.keys(LEADERBOARD_CATEGORIES),
});

const MATCH_TYPE_OPTIONS = [
  "all",
  "Competitive",
  "Wingman",
  "Duel",
  "Rush",
] as const;
const ROLE_OPTIONS = ["all", "Sniper", "Entry", "Support", "Rifler"] as const;
const SOURCE_OPTIONS = [
  "overall",
  "matchmaking",
  "tournament",
  "league",
] as const;

function readQueryParam<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = route.query[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

// Seasons power the unified "scope" selector. Scope is one of:
//   "0" (all time) | "7" | "30" | "season:<uuid>"
// Season and rolling-window scopes are mutually exclusive.
type Season = {
  id: string;
  number: number | null;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
};
const appSettings = useApplicationSettingsStore();

const seasonsEnabled = computed(
  () => useApplicationSettingsStore().seasonsEnabled,
);
const seasons = ref<Season[]>([]);
const activeSeason = computed(() => {
  const now = Date.now();
  return (
    seasons.value.find(
      (s) =>
        new Date(s.starts_at).getTime() <= now &&
        (!s.ends_at || new Date(s.ends_at).getTime() > now),
    ) || null
  );
});
const scope = ref<string>(
  typeof route.query.period === "string" ? route.query.period : "",
);
const derivedWindowDays = computed(() =>
  scope.value === "7" || scope.value === "30" ? parseInt(scope.value) : 0,
);
const derivedSeasonId = computed(() =>
  scope.value.startsWith("season:")
    ? scope.value.slice("season:".length)
    : null,
);
const scopeSeason = computed(
  () => seasons.value.find((s) => s.id === derivedSeasonId.value) ?? null,
);
const matchType = ref<string>(
  readQueryParam("type", MATCH_TYPE_OPTIONS, "Competitive"),
);
const excludeTournaments = ref(false);
const roleFilter = ref<string>(readQueryParam("role", ROLE_OPTIONS, "all"));
const sourceFilter = ref<string>(
  readQueryParam("source", SOURCE_OPTIONS, "overall"),
);

// FACEIT ratings and Premier ranks are snapshots we cache from elsewhere, so
// the bar stays where it is with its controls off.
const externalSource = computed(
  () => EXTERNAL_RANK_SOURCES[category.value] ?? null,
);
const isExternalRank = computed(() => externalSource.value !== null);
const supportsRole = computed(
  () => ROLE_CATEGORIES.has(category.value) && !isExternalRank.value,
);

// Default to the current season when seasons are on and one is active; otherwise
// fall back to All Time (systems without a current season).
const defaultScope = computed(() =>
  seasonsEnabled.value && activeSeason.value
    ? `season:${activeSeason.value.id}`
    : "0",
);
function seasonScopeLabel(s: Season): string {
  return t("pages.seasons.season_number", { number: s.number ?? "?" });
}
function formatDay(date: Date, withYear = true): string {
  return date.toLocaleDateString(dateLocale(), {
    year: withYear ? "numeric" : undefined,
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
function seasonRangeLabel(s: Season): string {
  const range = `${formatDay(new Date(s.starts_at))} – ${
    s.ends_at ? formatDay(new Date(s.ends_at)) : t("pages.seasons.ongoing")
  }`;
  return s.description ? `${range} · ${s.description}` : range;
}
const leaderboardFilterCount = computed(() => {
  let n = 0;
  if (scope.value && scope.value !== defaultScope.value) n++;
  if (matchType.value !== "Competitive") n++;
  if (excludeTournaments.value) n++;
  if (supportsRole.value && roleFilter.value !== "all") n++;
  if (sourceFilter.value !== "overall") n++;
  return n;
});
const scopeLabel = computed(() => {
  if (derivedSeasonId.value) {
    return scopeSeason.value
      ? seasonScopeLabel(scopeSeason.value)
      : t("pages.leaderboard.time_periods.all_time");
  }
  return (
    {
      "0": t("pages.leaderboard.time_periods.all_time"),
      "7": t("pages.leaderboard.time_periods.last_7_days"),
      "30": t("pages.leaderboard.time_periods.last_30_days"),
    }[scope.value] ?? t("pages.leaderboard.time_periods.all_time")
  );
});
// The bar's second line: the dates behind the scope picked.
const scopeDetail = computed(() => {
  if (scopeSeason.value) return seasonRangeLabel(scopeSeason.value);
  const days = derivedWindowDays.value;
  if (days) {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    return `${formatDay(from, from.getUTCFullYear() !== to.getUTCFullYear())} – ${formatDay(to)}`;
  }
  return seasonsEnabled.value ? t("pages.leaderboard.all_seasons") : "";
});

const entries = ref<LeaderboardEntry[]>([]);
const total = ref(0);
const leaderValue = ref<number | null>(null);
const page = ref(1);
const perPage = usePerPage("leaderboard");
const loading = ref(true);
const { skeleton, refreshing, loaded } = useDeferredLoading(
  () => loading.value,
);
// Back to the leaderboard lands on the same page.
useRestoredRefs("leaderboard", { page });
// Steam id from the URL — when set we look up that player's rank, jump
// to the page they sit on, and highlight their row on render.
const highlightedSteamId = computed(() => {
  const raw = route.query.player;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === "string" && v.length > 0 ? v : null;
});
let fetchGeneration = 0;

// The two external ratings are only offered where the platform actually
// collects them: FACEIT needs the import turned on, Premier ranks come out of
// imported Valve demos.
const categories = computed(() => [
  "elo",
  "best_rating",
  "best_adr",
  "best_kpr",
  "best_kast",
  "best_udr",
  "best_kdr",
  "best_win_rate",
  "highest_hs_pct",
  "awards",
  ...(appSettings.faceitEnabled ? ["faceit_elo"] : []),
  ...(appSettings.linkedAccountsEnabled ? ["premier_rank"] : []),
]);

const offset = computed(() => (page.value - 1) * perPage.value);

const filters = computed<LeaderboardFilters>(() => ({
  window_days: derivedWindowDays.value,
  season_id: derivedSeasonId.value,
  match_type: matchType.value === "all" ? null : matchType.value,
  exclude_tournaments: Boolean(excludeTournaments.value),
  role:
    supportsRole.value && roleFilter.value !== "all" ? roleFilter.value : null,
  source: sourceFilter.value,
}));

const rankVariables = computed(() => ({
  category: category.value,
  window_days: filters.value.window_days,
  season_id: filters.value.season_id,
  match_type: filters.value.match_type,
  exclude_tournaments: filters.value.exclude_tournaments,
  source: filters.value.source,
}));

const queryVariables = computed(() => ({
  category: category.value,
  ...filters.value,
  limit: perPage.value,
  offset: offset.value,
  order_by: leaderboardOrderBy(category.value),
}));

// Set by a jump to someone's rank on another board; the filter change that
// follows lands on that page instead of the first.
let pendingPage: number | null = null;

function onFilterChange() {
  // A filter settling while back/forward restores the page is not the user
  // changing it.
  if (isRestoringHistory()) {
    fetchLeaderboard();
    return;
  }
  page.value = pendingPage ?? 1;
  pendingPage = null;
  pageAlignedForSteamId = null;
  fetchLeaderboard();
}

function toggleExcludeTournaments() {
  if (isExternalRank.value) return;
  excludeTournaments.value = !excludeTournaments.value;
}

function onPageChange(newPage: number) {
  page.value = newPage;
  fetchLeaderboard();
}

function onPerPageChange(value: number) {
  perPage.value = value;
  page.value = 1;
  pageAlignedForSteamId = null;
  fetchLeaderboard();
}

// When the URL carries a player id and we haven't yet aligned the page
// to their rank, look up the player's rank under the current filters
// and snap to the page they sit on. Returning false means we changed
// page and the caller should re-enter the fetch (we update offset).
async function alignPageToHighlightedPlayer(): Promise<boolean> {
  const sid = highlightedSteamId.value;
  if (!sid || pageAlignedForSteamId === sid) return true;
  // The rank lookup can't scope by role, so for a role-filtered category it
  // would resolve the player's role-less rank and snap to the wrong page.
  // Skip the snap entirely while a role filter is active.
  if (filters.value.role) {
    pageAlignedForSteamId = sid;
    return true;
  }
  try {
    const { data } = await apolloClient.query({
      query: PLAYER_RANK_QUERY,
      variables: { ...rankVariables.value, player_steam_id: sid },
      fetchPolicy: "network-only",
    });
    const row = (data as any)?.get_player_leaderboard_rank?.[0];
    pageAlignedForSteamId = sid;
    const rank = Number(row?.rank);
    if (!Number.isFinite(rank) || rank <= 0) return true;
    const targetPage = Math.max(1, Math.ceil(rank / perPage.value));
    if (targetPage !== page.value) {
      page.value = targetPage;
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error looking up player leaderboard rank:", error);
    pageAlignedForSteamId = sid;
    return true;
  }
}

// Tracks which steam id we've already snapped the page for, so filter
// changes re-snap but a manual page change by the user sticks.
let pageAlignedForSteamId: string | null = null;

async function fetchLeaderboard() {
  loading.value = true;
  const gen = ++fetchGeneration;
  try {
    const aligned = await alignPageToHighlightedPlayer();
    if (gen !== fetchGeneration) return;
    if (!aligned) {
      // Page changed; the watcher will not re-fire fetchLeaderboard for
      // us, so kick it off again with the new page applied.
      void fetchLeaderboard();
      return;
    }
    const { data } = await apolloClient.query({
      query: LEADERBOARD_QUERY,
      variables: queryVariables.value,
      fetchPolicy: "network-only",
    });
    if (gen !== fetchGeneration) return;
    const rows = data?.get_leaderboard || [];
    entries.value = rows.map((row: any, index: number): LeaderboardEntry => ({
      ...row,
      rank: offset.value + index + 1,
      value: Number(row.value),
      secondary_value:
        row.secondary_value != null ? Number(row.secondary_value) : null,
      tertiary_value:
        row.tertiary_value != null ? Number(row.tertiary_value) : null,
      matches_played:
        row.matches_played != null ? Number(row.matches_played) : null,
    }));
    const aggregate = data?.get_leaderboard_aggregate?.aggregate;
    total.value = Number(aggregate?.count) || 0;
    leaderValue.value =
      aggregate?.max?.value != null ? Number(aggregate.max.value) : null;
    void fetchMyRank(gen);
  } catch (error) {
    if (gen !== fetchGeneration) return;
    console.error("Error fetching leaderboard:", error);
    entries.value = [];
    total.value = 0;
    leaderValue.value = null;
  } finally {
    if (gen === fetchGeneration) {
      loading.value = false;
    }
  }
}

// The signed-in player's rank, for the "You · #N" jump when they aren't on
// the page shown. Paging doesn't move it, so it's asked once per board and
// filter set.
const myRank = ref<number | null>(null);
let myRankKey = "";
async function fetchMyRank(gen: number) {
  const sid = loggedInSteamId.value;
  if (!sid || filters.value.role) {
    myRank.value = null;
    myRankKey = "";
    return;
  }
  const key = JSON.stringify([sid, rankVariables.value]);
  if (key === myRankKey) return;
  myRankKey = key;
  myRank.value = null;
  try {
    const { data } = await apolloClient.query({
      query: PLAYER_RANK_QUERY,
      variables: { ...rankVariables.value, player_steam_id: sid },
      fetchPolicy: "network-only",
    });
    if (gen !== fetchGeneration || key !== myRankKey) return;
    const rank = Number((data as any)?.get_player_leaderboard_rank?.[0]?.rank);
    myRank.value = Number.isFinite(rank) && rank > 0 ? rank : null;
  } catch {
    if (key === myRankKey) myRankKey = "";
  }
}

const myRankJump = computed(() => {
  const sid = loggedInSteamId.value;
  if (!sid || !myRank.value) return null;
  if (entries.value.some((e) => e.player_steam_id === sid)) return null;
  return {
    rank: myRank.value,
    page: Math.max(1, Math.ceil(myRank.value / perPage.value)),
  };
});

function jumpToMe() {
  const jump = myRankJump.value;
  if (!jump) return;
  scrollTarget = loggedInSteamId.value;
  onPageChange(jump.page);
}

function scrollToRow(sid: string) {
  rootEl.value
    ?.querySelector(`[data-steam-id="${CSS.escape(sid)}"]`)
    ?.scrollIntoView({ block: "center", behavior: "smooth" });
}

const boardLine = computed(() => {
  if (page.value > 1 && entries.value.length) {
    return {
      kind: "ranks",
      value: `${(offset.value + 1).toLocaleString()}–${(
        offset.value + entries.value.length
      ).toLocaleString()}`,
    };
  }
  return externalSource.value
    ? { kind: "top_on", value: externalSource.value }
    : { kind: "top_of", value: scopeLabel.value };
});

watch(category, () => {
  // Clear a stale role when moving to a category that has no role view, so it
  // doesn't silently reapply on return to a role category.
  if (!supportsRole.value && roleFilter.value !== "all") {
    roleFilter.value = "all";
  }
  onFilterChange();
});
watch(scope, onFilterChange);
watch(matchType, onFilterChange);
watch(excludeTournaments, onFilterChange);
watch(roleFilter, onFilterChange);
watch(sourceFilter, onFilterChange);
watch(highlightedSteamId, (sid) => {
  // A different player was deep-linked — re-resolve their page.
  if (sid && sid !== pageAlignedForSteamId) {
    pageAlignedForSteamId = null;
    scrollTarget = sid;
    fetchLeaderboard();
  }
});

// Brings a row into view once the entries holding it land: the deep-linked
// player, or whoever a jump went looking for.
const rootEl = ref<HTMLElement | null>(null);
let scrollTarget: string | null = highlightedSteamId.value;
watch(entries, (rows) => {
  const sid = scrollTarget;
  if (!sid || !rows.some((e) => e.player_steam_id === sid)) return;
  scrollTarget = null;
  void nextTick(() => scrollToRow(sid));
});

// The clicked player's stats: a column beside the board when there's room
// (in the gutter, when there's room for that too), a sheet when there isn't.
const layoutWidth = ref(0);
const sideFits = computed(() => layoutWidth.value >= SIDE_PANEL_MIN_WIDTH);
const gutterFits = computed(() => layoutWidth.value >= GUTTER_MIN_WIDTH);
const selected = ref<LeaderboardPanelPlayer | null>(null);
const panelOpen = ref(false);
const drawerOpen = ref(false);
let clearSelectedTimer: ReturnType<typeof setTimeout> | null = null;

const selectedEntry = computed(
  () =>
    entries.value.find((e) => e.player_steam_id === selected.value?.steam_id) ??
    null,
);
const selectedSteamId = computed(() =>
  panelOpen.value || drawerOpen.value
    ? (selected.value?.steam_id ?? null)
    : null,
);

function showPlayer(player: LeaderboardPanelPlayer) {
  if (clearSelectedTimer) clearTimeout(clearSelectedTimer);
  clearSelectedTimer = null;
  selected.value = player;
}

function forgetPlayerSoon() {
  if (clearSelectedTimer) clearTimeout(clearSelectedTimer);
  clearSelectedTimer = setTimeout(() => {
    if (!panelOpen.value && !drawerOpen.value) selected.value = null;
  }, PANEL_CLOSE_MS);
}

function onSelect(entry: LeaderboardEntry) {
  if (
    sideFits.value &&
    panelOpen.value &&
    selected.value?.steam_id === entry.player_steam_id
  ) {
    closePanel();
    return;
  }
  showPlayer({
    steam_id: entry.player_steam_id,
    name: entry.player_name,
    avatar_url: entry.player_avatar_url,
    custom_avatar_url: entry.player_custom_avatar_url,
    country: entry.player_country,
  });
  if (sideFits.value) {
    panelOpen.value = true;
  } else {
    drawerOpen.value = true;
  }
}

function closePanel() {
  panelOpen.value = false;
  drawerOpen.value = false;
  forgetPlayerSoon();
}

function onDrawerOpen(open: boolean) {
  drawerOpen.value = open;
  if (!open) forgetPlayerSoon();
}

// From the panel's every-board list: show that board, on the player's page.
function onPanelBoard(cat: string, rank: number | null) {
  const sid = selected.value?.steam_id ?? null;
  const rankPage =
    rank && !(ROLE_CATEGORIES.has(cat) && roleFilter.value !== "all")
      ? Math.max(1, Math.ceil(rank / perPage.value))
      : 1;
  drawerOpen.value = false;
  if (cat === category.value && rankPage === page.value) {
    if (sid) scrollToRow(sid);
    return;
  }
  scrollTarget = sid;
  if (cat === category.value) {
    onPageChange(rankPage);
    return;
  }
  pendingPage = rankPage;
  category.value = cat;
}

watch(sideFits, () => {
  if (panelOpen.value || drawerOpen.value) closePanel();
});

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape" || !panelOpen.value || event.defaultPrevented) {
    return;
  }
  // An open select or popover takes the Escape for itself.
  if (document.querySelector("[data-reka-popper-content-wrapper]")) return;
  closePanel();
}

let layoutObserver: ResizeObserver | null = null;

async function fetchSeasons() {
  try {
    const { data } = await apolloClient.query({
      query: gql`
        query LeaderboardSeasons {
          seasons(order_by: { starts_at: desc }) {
            id
            number
            description
            starts_at
            ends_at
          }
        }
      `,
      fetchPolicy: "cache-first",
    });
    seasons.value = (data as any)?.seasons ?? [];
  } catch {
    seasons.value = [];
  }
}

onMounted(async () => {
  document.addEventListener("keydown", onKeydown);
  if (rootEl.value && typeof ResizeObserver !== "undefined") {
    layoutObserver = new ResizeObserver(([entry]) => {
      layoutWidth.value = entry.contentRect.width;
    });
    layoutObserver.observe(rootEl.value);
  }
  if (seasonsEnabled.value) {
    await fetchSeasons();
  }
  if (scope.value) {
    // Scope came from the URL — the scope watcher won't fire, so fetch directly.
    fetchLeaderboard();
  } else {
    // Setting scope fires its watcher, which triggers the initial fetch.
    scope.value = defaultScope.value;
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  layoutObserver?.disconnect();
  if (clearSelectedTimer) clearTimeout(clearSelectedTimer);
});
</script>

<template>
  <div ref="rootEl" class="w-full">
    <h1 class="sr-only">{{ $t("pages.leaderboard.title") }}</h1>

    <div
      class="lb-layout"
      :class="{
        'lb-layout--gutter': gutterFits,
        'lb-layout--open': panelOpen && sideFits,
      }"
    >
      <!-- The boards and the filters are one block. The bar stays on every
           board; on FACEIT and Premier its controls are off and its second
           line says why. -->
      <PageTransition class="lb-layout-deck">
        <Tabs v-model="category">
          <div
            class="overflow-hidden rounded-lg border border-border bg-card/40 [backdrop-filter:blur(6px)]"
          >
            <TabsList variant="track" class="rounded-none border-0">
              <TabsTrigger v-for="cat in categories" :key="cat" :value="cat">
                {{ $t(`pages.leaderboard.categories.${cat}`) }}
              </TabsTrigger>
            </TabsList>

            <div class="border-t border-border p-2 md:px-3 md:py-2.5">
              <div class="hidden flex-wrap items-center gap-2 md:flex">
                <span
                  aria-hidden="true"
                  class="mr-1 h-[2px] w-[10px] shrink-0 transition-colors duration-200"
                  :class="
                    isExternalRank
                      ? 'bg-muted-foreground/30'
                      : 'bg-[hsl(var(--tac-amber))]'
                  "
                ></span>

                <Select v-model="scope" :disabled="isExternalRank">
                  <SelectTrigger class="h-8 w-[200px]">
                    <span class="truncate">{{ scopeLabel }}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="s in seasons"
                      :key="s.id"
                      :value="`season:${s.id}`"
                    >
                      <div class="flex flex-col">
                        <span>
                          {{ seasonScopeLabel(s) }}
                          <span
                            v-if="activeSeason && s.id === activeSeason.id"
                            class="text-[hsl(var(--tac-amber))]"
                            >· {{ $t("pages.seasons.active") }}</span
                          >
                        </span>
                        <span class="text-[0.65rem] text-muted-foreground">
                          {{ seasonRangeLabel(s) }}
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="0">{{
                      $t("pages.leaderboard.time_periods.all_time")
                    }}</SelectItem>
                    <SelectItem value="7">{{
                      $t("pages.leaderboard.time_periods.last_7_days")
                    }}</SelectItem>
                    <SelectItem value="30">{{
                      $t("pages.leaderboard.time_periods.last_30_days")
                    }}</SelectItem>
                  </SelectContent>
                </Select>

                <Select v-model="matchType" :disabled="isExternalRank">
                  <SelectTrigger class="h-8 w-[180px]">
                    <SelectValue
                      :placeholder="$t('pages.leaderboard.match_types.all')"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt of MATCH_TYPE_OPTIONS"
                      :key="opt"
                      :value="opt"
                    >
                      {{
                        $t(
                          `pages.leaderboard.match_types.${opt === "all" ? "all" : opt.toLowerCase()}`,
                        )
                      }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select v-model="sourceFilter" :disabled="isExternalRank">
                  <SelectTrigger class="h-8 w-[160px]">
                    <SelectValue
                      :placeholder="$t('pages.leaderboard.sources.overall')"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt of SOURCE_OPTIONS"
                      :key="opt"
                      :value="opt"
                    >
                      {{ $t(`pages.leaderboard.sources.${opt}`) }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select v-model="roleFilter" :disabled="!supportsRole">
                  <SelectTrigger class="h-8 w-[160px]">
                    <SelectValue
                      :placeholder="$t('pages.leaderboard.roles.all')"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt of ROLE_OPTIONS"
                      :key="opt"
                      :value="opt"
                    >
                      {{ $t(`pages.leaderboard.roles.${opt}`) }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div
                  class="ml-auto flex h-8 items-center gap-2 rounded-md border px-3 text-xs tracking-[0.06em] transition-[color,background-color,border-color,opacity] duration-150"
                  :class="[
                    excludeTournaments && !isExternalRank
                      ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.13)] text-[hsl(var(--tac-amber))]'
                      : 'border-border bg-muted/30 text-muted-foreground',
                    isExternalRank
                      ? 'cursor-not-allowed opacity-50'
                      : 'cursor-pointer [@media(hover:hover)]:hover:bg-muted/50 [@media(hover:hover)]:hover:text-foreground',
                  ]"
                  @click="toggleExcludeTournaments"
                >
                  <Trophy class="h-3.5 w-3.5" />
                  <span id="leaderboard-exclude-tournaments-label">
                    {{ $t("pages.leaderboard.exclude_tournaments") }}
                  </span>
                  <Switch
                    :model-value="excludeTournaments && !isExternalRank"
                    :disabled="isExternalRank"
                    aria-labelledby="leaderboard-exclude-tournaments-label"
                    class="ml-1 data-[state=checked]:bg-[hsl(var(--tac-amber))] data-[state=unchecked]:bg-muted/70"
                    @update:model-value="excludeTournaments = $event"
                    @click.stop
                  />
                </div>
              </div>

              <Popover>
                <PopoverTrigger as-child>
                  <Button
                    variant="outline"
                    class="h-9 w-full justify-center gap-2 bg-card/60 md:hidden"
                    :class="{
                      'border-[hsl(var(--tac-amber)/0.55)] text-[hsl(var(--tac-amber))]':
                        leaderboardFilterCount > 0 && !isExternalRank,
                    }"
                    :disabled="isExternalRank"
                  >
                    <SlidersHorizontal class="h-4 w-4" />
                    <span>{{ $t("common.filters") }}</span>
                    <span
                      v-if="leaderboardFilterCount > 0 && !isExternalRank"
                      class="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.2)] px-1.5 text-[0.65rem] font-semibold text-[hsl(var(--tac-amber))]"
                    >
                      {{ leaderboardFilterCount }}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  class="w-[min(92vw,420px)] space-y-4 p-4"
                >
                  <div class="space-y-2">
                    <span
                      class="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      {{ $t("common.date") }}
                    </span>
                    <Select v-model="scope">
                      <SelectTrigger class="w-full">
                        <span class="truncate">{{ scopeLabel }}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="s in seasons"
                          :key="s.id"
                          :value="`season:${s.id}`"
                        >
                          {{ seasonScopeLabel(s)
                          }}<span
                            v-if="activeSeason && s.id === activeSeason.id"
                            class="text-[hsl(var(--tac-amber))]"
                          >
                            · {{ $t("pages.seasons.active") }}</span
                          >
                        </SelectItem>
                        <SelectItem value="0">{{
                          $t("pages.leaderboard.time_periods.all_time")
                        }}</SelectItem>
                        <SelectItem value="7">{{
                          $t("pages.leaderboard.time_periods.last_7_days")
                        }}</SelectItem>
                        <SelectItem value="30">{{
                          $t("pages.leaderboard.time_periods.last_30_days")
                        }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div class="space-y-2">
                    <span
                      class="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      {{ $t("pages.leaderboard.match_types.all") }}
                    </span>
                    <Select v-model="matchType">
                      <SelectTrigger class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt of MATCH_TYPE_OPTIONS"
                          :key="opt"
                          :value="opt"
                        >
                          {{
                            $t(
                              `pages.leaderboard.match_types.${opt === "all" ? "all" : opt.toLowerCase()}`,
                            )
                          }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div class="space-y-2">
                    <span
                      class="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      {{ $t("pages.leaderboard.sources.overall") }}
                    </span>
                    <Select v-model="sourceFilter">
                      <SelectTrigger class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt of SOURCE_OPTIONS"
                          :key="opt"
                          :value="opt"
                        >
                          {{ $t(`pages.leaderboard.sources.${opt}`) }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div class="space-y-2">
                    <span
                      class="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      {{ $t("pages.leaderboard.roles.all") }}
                    </span>
                    <Select v-model="roleFilter" :disabled="!supportsRole">
                      <SelectTrigger class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt of ROLE_OPTIONS"
                          :key="opt"
                          :value="opt"
                        >
                          {{ $t(`pages.leaderboard.roles.${opt}`) }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div
                    class="flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors duration-150"
                    :class="
                      excludeTournaments
                        ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.13)] text-[hsl(var(--tac-amber))]'
                        : 'border-border bg-muted/30 text-muted-foreground'
                    "
                    @click="toggleExcludeTournaments"
                  >
                    <Trophy class="h-4 w-4 shrink-0" />
                    <span class="truncate">{{
                      $t("pages.leaderboard.exclude_tournaments")
                    }}</span>
                    <Switch
                      v-model="excludeTournaments"
                      class="ml-auto shrink-0 data-[state=checked]:bg-[hsl(var(--tac-amber))] data-[state=unchecked]:bg-muted/70"
                      @click.stop
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div
              class="flex min-h-[2.125rem] items-center gap-2 border-t border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground/80"
            >
              <Transition
                mode="out-in"
                enter-active-class="transition-opacity duration-200 ease-out"
                leave-active-class="transition-opacity duration-100 ease-in"
                enter-from-class="opacity-0"
                leave-to-class="opacity-0"
              >
                <span
                  v-if="externalSource"
                  key="synced"
                  class="flex min-w-0 items-center gap-2 text-muted-foreground"
                >
                  <RefreshCw class="size-3.5 shrink-0" />
                  <span>{{
                    $t("pages.leaderboard.synced_from", {
                      source: externalSource,
                    })
                  }}</span>
                </span>
                <span v-else :key="scope" class="min-w-0">
                  <span class="font-medium text-muted-foreground">{{
                    scopeLabel
                  }}</span>
                  <template v-if="scopeDetail"> · {{ scopeDetail }}</template>
                </span>
              </Transition>
            </div>
          </div>
        </Tabs>
      </PageTransition>

      <PageTransition :step="1" class="lb-layout-board">
        <div>
          <div
            class="mb-3.5 flex min-h-7 flex-wrap items-center gap-x-2.5 gap-y-1.5"
          >
            <i18n-t
              :keypath="`pages.leaderboard.line.${boardLine.kind}`"
              tag="span"
              class="inline-flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              <template #value>
                <span class="text-foreground">{{ boardLine.value }}</span>
              </template>
            </i18n-t>
            <Button
              v-if="myRankJump"
              variant="outline"
              class="ml-auto h-7 gap-1.5 border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.06)] px-2.5 text-xs text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.12)] hover:text-[hsl(var(--tac-amber))]"
              @click="jumpToMe"
            >
              <LeaderboardYouTag />
              {{
                $t("pages.leaderboard.find_me", {
                  rank: myRankJump.rank.toLocaleString(),
                  page: myRankJump.page,
                })
              }}
              <ArrowRight class="size-3.5" />
            </Button>
          </div>

          <FadeSwap>
            <div
              v-if="skeleton"
              key="loading"
              class="grid gap-2"
              aria-busy="true"
            >
              <div v-if="page === 1" class="mb-1.5 grid grid-cols-3 gap-3">
                <Skeleton class="h-36 rounded-lg" />
                <Skeleton class="h-44 rounded-lg" />
                <Skeleton class="h-36 rounded-lg" />
              </div>
              <Skeleton
                v-for="i in page === 1 ? Math.max(perPage - 3, 1) : perPage"
                :key="i"
                class="h-12 w-full rounded-md"
              />
            </div>

            <SectionEmpty
              v-else-if="loaded && entries.length === 0"
              key="empty"
              :title="$t('pages.leaderboard.empty_title')"
              :description="$t('pages.leaderboard.no_results')"
            />

            <LeaderboardBoard
              v-else
              key="board"
              class="transition-opacity duration-200"
              :class="refreshing && 'pointer-events-none opacity-50'"
              :category="category"
              :entries="entries"
              :leader-value="leaderValue"
              :selected-steam-id="selectedSteamId"
              :me-steam-id="loggedInSteamId"
              :highlighted-steam-id="highlightedSteamId"
              @select="onSelect"
            />
          </FadeSwap>

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

      <!-- A bare cell whose width opens and shuts; the panel inside keeps its
           width and rides the cell's right edge, so it slides in from there. -->
      <div v-if="sideFits" class="lb-layout-side">
        <div class="lb-layout-side-inner">
          <aside
            v-if="selected"
            class="sticky top-4 max-h-[calc(var(--sidebar-height,100svh)-2rem)] overflow-y-auto overscroll-contain rounded-lg border border-border bg-card scrollbar-thin"
            :aria-label="$t('pages.leaderboard.panel.title')"
          >
            <Transition name="lb-panel" mode="out-in">
              <LeaderboardPlayerPanel
                :key="selected.steam_id"
                :player="selected"
                :category="category"
                :categories="categories"
                :entry="selectedEntry"
                :entries="entries"
                :total="total"
                :filters="filters"
                :is-me="selected.steam_id === loggedInSteamId"
                @close="closePanel"
                @board="onPanelBoard"
              />
            </Transition>
          </aside>
        </div>
      </div>
    </div>

    <Drawer v-if="!sideFits" :open="drawerOpen" @update:open="onDrawerOpen">
      <DrawerContent class="max-h-[86svh]">
        <DrawerTitle class="sr-only">{{
          selected?.name ?? $t("pages.leaderboard.panel.title")
        }}</DrawerTitle>
        <div
          class="overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]"
        >
          <LeaderboardPlayerPanel
            v-if="selected"
            :player="selected"
            :category="category"
            :categories="categories"
            :entry="selectedEntry"
            :entries="entries"
            :total="total"
            :filters="filters"
            :is-me="selected.steam_id === loggedInSteamId"
            :closable="false"
            @board="onPanelBoard"
          />
        </div>
      </DrawerContent>
    </Drawer>
  </div>
</template>

<style scoped>
/* Board on the left, the player panel's column on the right. The column opens
   from 0 to the panel's width; with room in the gutter the page widens by the
   same amount on the same clock, so the board keeps its width and the pair
   re-centres instead of the board giving up width to the panel. */
.lb-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 0px;
  grid-template-rows: auto 1fr;
  row-gap: 1.5rem;
  width: 100%;
  max-width: 80rem;
  margin-inline: auto;
  transition:
    grid-template-columns 260ms cubic-bezier(0.16, 1, 0.3, 1),
    max-width 260ms cubic-bezier(0.16, 1, 0.3, 1);
}
.lb-layout--open {
  grid-template-columns: minmax(0, 1fr) 24rem;
}
.lb-layout--gutter.lb-layout--open {
  max-width: 104rem;
}
.lb-layout-deck {
  grid-column: 1 / -1;
  grid-row: 1;
  min-width: 0;
}
.lb-layout-board {
  grid-column: 1;
  grid-row: 2;
  min-width: 0;
}
.lb-layout-side {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  justify-content: flex-end;
  min-width: 0;
  overflow: clip;
}
/* In the gutter the panel stands beside the tabs too, like the match chat
   rail; inside the page it starts level with the board. */
.lb-layout--gutter .lb-layout-deck {
  grid-column: 1;
}
.lb-layout--gutter .lb-layout-side {
  grid-row: 1 / span 2;
}
.lb-layout-side-inner {
  flex: none;
  width: 24rem;
  padding-left: 1.5rem;
  opacity: 0;
  transition: opacity 120ms ease-in;
}
.lb-layout--open .lb-layout-side-inner {
  opacity: 1;
  transition: opacity 220ms ease-out 40ms;
}

.lb-panel-enter-active {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.lb-panel-leave-active {
  transition:
    opacity 110ms ease-in,
    transform 110ms ease-in;
}
.lb-panel-enter-from {
  opacity: 0;
  transform: translateX(0.625rem);
}
.lb-panel-leave-to {
  opacity: 0;
  transform: translateX(-0.375rem);
}

@media (prefers-reduced-motion: reduce) {
  .lb-layout,
  .lb-layout-side-inner,
  .lb-panel-enter-active,
  .lb-panel-leave-active {
    transition: none;
  }
}
</style>
