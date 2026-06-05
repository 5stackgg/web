<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import PlayerMatchesTable from "~/components/player/PlayerMatchesTable.vue";
import PlayerIntroDashboard from "~/components/player/PlayerIntroDashboard.vue";
import PlayerMapsGrid from "~/components/player/PlayerMapsGrid.vue";
import PlayerWeaponsTable from "~/components/player/PlayerWeaponsTable.vue";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import PlayerPreferredRoles from "~/components/player/PlayerPreferredRoles.vue";
import PlayerRoleRadar from "~/components/player/PlayerRoleRadar.vue";
import PlayerCareerDuels from "~/components/player/PlayerCareerDuels.vue";
import PlayerCareerClutches from "~/components/player/PlayerCareerClutches.vue";

const { t } = useI18n();
import Pagination from "~/components/Pagination.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import RecentTournaments from "~/components/tournament/RecentTournaments.vue";
import TrophyCase from "~/components/trophy/TrophyCase.vue";
import { CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { e_player_roles_enum } from "~/generated/zeus";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
import PlayerEloChart from "~/components/charts/PlayerEloChart.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import formatStatValue from "~/utilities/formatStatValue";
import { resolveWeapon } from "~/utilities/weaponIcon";
import { csRankIcon } from "~/utilities/csRank";
import SanctionPlayer from "~/components/SanctionPlayer.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import { usePlayerCompareTarget } from "~/composables/usePlayerCompareTarget";
import PlayerSanctions from "~/components/PlayerSanctions.vue";
import PlayerChangeName from "~/components/PlayerChangeName.vue";
import PlayerChangeCountry from "~/components/PlayerChangeCountry.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  PlayIcon,
  Pencil,
  ExternalLink,
  Settings2,
  Maximize2,
  UserPlus,
  UserCheck,
  Calendar as CalendarIcon,
} from "lucide-vue-next";
import TimezoneFlag from "~/components/TimezoneFlag.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import RadialStat from "~/components/charts/RadialStat.vue";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "~/components/ui/separator";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import PlayerRoleForm from "~/components/PlayerRoleForm.vue";
import AvatarUpload from "~/components/AvatarUpload.vue";
import PlayerHighlights from "~/components/clips/PlayerHighlights.vue";
import PlayerElo from "~/components/PlayerElo.vue";
import PlayerLeaderboardRank from "~/components/PlayerLeaderboardRank.vue";
import PlayerFaceitRank from "~/components/PlayerFaceitRank.vue";
import PlayerPremierRank from "~/components/PlayerPremierRank.vue";
import PlayerEloHistoryDialog from "~/components/PlayerEloHistoryDialog.vue";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import { $, order_by, e_tournament_status_enum } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { playerMatchSummaryQuery } from "~/graphql/playerMatchAggStatsGraphql";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { eloFields } from "~/graphql/eloFields";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Checkbox } from "~/components/ui/checkbox";
import { Calendar } from "~/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { parseDate, type DateValue } from "@internationalized/date";

// The global range chip bar (7D/30D/…/ALL/custom) feeds a single
// v_player_elo subscription scoped to this player. Mode filtering happens
// client-side so toggling modes is instant without re-subscribing.
type RangeKey = "l30" | "7d" | "30d" | "90d" | "1y" | "all" | "custom";

interface WindowedEloEntry {
  current_elo: number | null;
  updated_elo: number | null;
  elo_change: number | null;
  match_created_at: string;
  match_id: string | null;
  match_result: string | null;
  type: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
}

const presetRanges: {
  key: Exclude<RangeKey, "custom">;
  label: string;
  days: number | null;
  matches?: number | null;
}[] = [
  { key: "l30", label: "L30", days: null, matches: 30 },
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "1y", label: "1Y", days: 365 },
];

const statsTab = ref<
  "performance" | "elo" | "maps" | "arsenal" | "combat"
>("performance");
const statsTabsEl = ref<HTMLElement | null>(null);

// Warn (once, dismissible) when viewing your own External stats without a
// linked Steam match-history auth — there'll be nothing to show until set up.
const { isLinked: externalAuthLinked } = usePendingImports();
const externalWarningDismissed = ref(false);
onMounted(() => {
  externalWarningDismissed.value =
    localStorage.getItem("player-external-auth-dismissed") === "1";
});
function dismissExternalWarning() {
  externalWarningDismissed.value = true;
  localStorage.setItem("player-external-auth-dismissed", "1");
}
function openEloTab() {
  statsTab.value = "elo";
  nextTick(() => {
    statsTabsEl.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
const eloRange = ref<RangeKey>("l30");

const statsMatchLimit = computed<number | null>(() => {
  if (eloRange.value === "custom") {
    return null;
  }
  const r = presetRanges.find((x) => x.key === eloRange.value);
  return r?.matches ?? null;
});
const customFrom = ref<string>("");
const customTo = ref<string>("");

// Calendar (DateValue) adapters over the YYYY-MM-DD string state, so the
// custom range uses the real date picker instead of native date inputs.
const customFromValue = computed<DateValue | undefined>({
  get: () => (customFrom.value ? parseDate(customFrom.value) : undefined),
  set: (v) => {
    customFrom.value = v ? v.toString() : "";
    applyCustomRange();
    // Collapse the calendar after picking — advance to the end date if it's
    // still empty, otherwise close it.
    activeDateField.value = customTo.value ? null : "to";
  },
});
const customToValue = computed<DateValue | undefined>({
  get: () => (customTo.value ? parseDate(customTo.value) : undefined),
  set: (v) => {
    customTo.value = v ? v.toString() : "";
    applyCustomRange();
    activeDateField.value = null;
  },
});
// Which custom-range date the inline calendar is editing (one at a time, so
// the calendar lives inside the settings popover without nesting popovers).
const activeDateField = ref<"from" | "to" | null>(null);
const excludeTournaments = ref(false);
const settingsOpen = ref(false);
const eloHistory = ref<WindowedEloEntry[]>([]);
// Per-match gameplay performance (kills/deaths/assists + win/loss) for the
// active source, from v_player_match_performance — feeds the Win Rate / K-D
// card for BOTH 5Stack and External (v_player_elo is 5Stack-only).
const performanceHistory = ref<WindowedEloEntry[]>([]);
// Per-source weapon kill counts from v_player_weapon_kills (lifetime).
const weaponKills = ref<{ with: string; kill_count: number }[]>([]);
const premierWindowedHistory = ref<WindowedEloEntry[]>([]);
// Raw rows from the rank-history sub, all rank types (Premier 11,
// Competitive 12, Wingman 6) — feeds the per-match rank badge on the rows.
const rankHistoryRows = ref<
  Array<{
    rank: number;
    rank_type: number;
    previous_rank: number | null;
    match_id: string | null;
    map_id: string | null;
    map?: { name: string } | null;
    observed_at: string;
  }>
>([]);
const eloHistoryLoading = ref(false);

const { client: apolloClient } = useApolloClient();
const route = useRoute();
const router = useRouter();

// Persist the active stats tab in the URL so it survives refresh / sharing.
const VALID_STATS_TABS = [
  "performance",
  "elo",
  "maps",
  "arsenal",
  "combat",
] as const;
if (
  typeof route.query.tab === "string" &&
  (VALID_STATS_TABS as readonly string[]).includes(route.query.tab)
) {
  statsTab.value = route.query.tab as (typeof VALID_STATS_TABS)[number];
}
watch(statsTab, (t) => {
  if (route.query.tab !== t) {
    router.replace({ query: { ...route.query, tab: t } });
  }
});

// Persist the time range (incl. custom from/to) in the URL.
const VALID_RANGES = ["l30", "7d", "30d", "90d", "1y", "custom"];
if (
  typeof route.query.range === "string" &&
  VALID_RANGES.includes(route.query.range)
) {
  eloRange.value = route.query.range as RangeKey;
}
if (typeof route.query.from === "string") customFrom.value = route.query.from;
if (typeof route.query.to === "string") customTo.value = route.query.to;
watch([eloRange, customFrom, customTo], () => {
  const q: Record<string, any> = { ...route.query, range: eloRange.value };
  if (eloRange.value === "custom") {
    if (customFrom.value) q.from = customFrom.value;
    else delete q.from;
    if (customTo.value) q.to = customTo.value;
    else delete q.to;
  } else {
    delete q.from;
    delete q.to;
  }
  router.replace({ query: q });
});

// Stat source — 5Stack internal ELO vs everything external (Valve / FACEIT
// imports). These mean drastically different things (a 5Stack-computed ELO vs
// a Valve skill group / CS Rating) so the page never blends the rating chart;
// the source also scopes win-rate, K/D, weapons and the map radar to matches
// from that source. "external" = every match where matches.source != '5stack'.
type StatSource = "5stack" | "external" | "all";

const appSettings = useApplicationSettingsStore();

const sourceRef = computed<StatSource>(() => {
  // External/All require the admin-enabled CS2 import setting; otherwise the
  // only world is 5Stack.
  if (!appSettings.externalMatchesEnabled) {
    return "5stack";
  }
  const raw = route.query.source;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "external") return "external";
  if (v === "all") return "all";
  return "5stack";
});

const sourceOptions = computed<{ value: StatSource; label: string }[]>(() =>
  appSettings.externalMatchesEnabled
    ? [
        { value: "all", label: t("pages.players.detail.all_short") },
        { value: "5stack", label: "5Stack" },
        { value: "external", label: "External" },
      ]
    : [{ value: "5stack", label: "5Stack" }],
);

// The ELO tab can't blend worlds (5Stack ELO vs Valve rank), so "All" is not a
// valid source there — disable it and reflect 5Stack as the effective source.
const eloTabActive = computed(() => statsTab.value === "elo");
const sourceDisabled = (value: StatSource) =>
  eloTabActive.value && value === "all";
const displaySource = computed<StatSource>(() =>
  eloTabActive.value && sourceRef.value === "all" ? "5stack" : sourceRef.value,
);

// Mode chips are source-dependent: 5Stack tracks Competitive/Wingman/Duel
// ELO (plus an "all" overlay); External tracks Premier (CS Rating) and the
// per-map Competitive/Wingman skill groups from imported Valve demos.
const modeOptions = computed<{ value: string; label: string }[]>(() =>
  sourceRef.value === "external"
    ? [
        { value: "all", label: t("pages.players.detail.all_short") },
        { value: "Premier", label: "Premier" },
        {
          value: "Competitive",
          label: t("pages.leaderboard.match_types.competitive"),
        },
        { value: "Wingman", label: t("pages.leaderboard.match_types.wingman") },
      ]
    : [
        { value: "all", label: t("pages.players.detail.all_short") },
        {
          value: "Competitive",
          label: t("pages.leaderboard.match_types.competitive"),
        },
        { value: "Wingman", label: t("pages.leaderboard.match_types.wingman") },
        { value: "Duel", label: t("pages.leaderboard.match_types.duel") },
      ],
);

const selectedModeRef = computed<
  "all" | "Competitive" | "Wingman" | "Duel" | "Premier"
>(() => {
  const raw = route.query.mode;
  const v = Array.isArray(raw) ? raw[0] : raw;
  const valid = modeOptions.value.map((o) => o.value);
  if (typeof v === "string" && valid.includes(v)) {
    return v as "all" | "Competitive" | "Wingman" | "Duel" | "Premier";
  }
  return "all";
});

function setMode(m: string) {
  router.replace({ query: { ...route.query, mode: m } });
}

function setSource(s: StatSource) {
  const validModes =
    s === "external"
      ? ["all", "Premier", "Competitive", "Wingman"]
      : ["all", "Competitive", "Wingman", "Duel"];
  const query: Record<string, any> = { ...route.query, source: s };
  // Carry the mode across the toggle when the new source supports it;
  // otherwise drop to ALL TYPES so we never land on a mode it can't show.
  if (!validModes.includes(selectedModeRef.value)) {
    query.mode = "all";
  }
  router.replace({ query });
}

// User-initiated source change: they now own the choice, so don't auto-restore
// "All" when they later leave the ELO tab.
function onSourceClick(s: StatSource) {
  eloAutoSwitchedFromAll.value = false;
  setSource(s);
}

// Global comparison target — one control drives every tab that overlays a
// comparison (Performance, Maps). Cleared when the viewed profile changes.
const { compareTarget, setCompareTarget, clearCompareTarget } =
  usePlayerCompareTarget();

// Dot on the gear when anything inside it differs from defaults, so users know
// hidden settings are active.
const settingsChanged = computed(
  () =>
    excludeTournaments.value ||
    eloRange.value === "custom" ||
    !!compareTarget.value,
);

// Reserve the current scroll extent right before a filter change so trimming a
// long match list (or shorter stats) doesn't yank the user up the page.
const {
  minHeight: scrollFloorMinHeight,
  rootEl: pageRootEl,
  capture: captureScrollFloor,
} = useScrollFloor();
watch(
  () => [
    sourceRef.value,
    selectedModeRef.value,
    eloRange.value,
    statsTab.value,
    compareTarget.value,
    excludeTournaments.value,
  ],
  () => captureScrollFloor(),
);

// Keep the comparison target in the URL so it's shareable / survives refresh.
watch(compareTarget, (t) => {
  const q: Record<string, any> = { ...route.query };
  if (t?.steam_id) {
    q.compare = String(t.steam_id);
  } else {
    delete q.compare;
  }
  router.replace({ query: q });
});

onMounted(async () => {
  const raw = route.query.compare;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || compareTarget.value) {
    return;
  }
  try {
    const { data } = await apolloClient.query({
      query: generateQuery({
        players_by_pk: [
          { steam_id: $("compareSid", "bigint!") },
          {
            steam_id: true,
            name: true,
            avatar_url: true,
            country: true,
            role: true,
          },
        ],
      }),
      variables: { compareSid: id },
      fetchPolicy: "cache-first",
    });
    const p = (data as any)?.players_by_pk;
    if (p) {
      setCompareTarget({
        steam_id: String(p.steam_id),
        name: p.name,
        avatar_url: p.avatar_url,
        country: p.country,
        role: p.role,
      } as any);
    }
  } catch {
    // Unknown / malformed steam id in the URL — ignore.
  }
});

// The ELO tab can't show "All", so entering it with All temporarily switches
// the whole page to 5Stack; leaving restores All — unless the user manually
// picked a source while on the tab (then their choice sticks).
const eloAutoSwitchedFromAll = ref(false);
watch(
  () => statsTab.value,
  (tab, prev) => {
    if (tab === "elo") {
      if (sourceRef.value === "all") {
        eloAutoSwitchedFromAll.value = true;
        setSource("5stack");
      }
    } else if (prev === "elo" && eloAutoSwitchedFromAll.value) {
      eloAutoSwitchedFromAll.value = false;
      setSource("all");
    }
  },
  { immediate: true },
);

// The active mode IS a match_options.type value: 5Stack uses
// Competitive/Wingman/Duel, External uses Premier/Competitive/Wingman (the
// import sets match_options.type to exactly these). Every gameplay stat
// (win-rate, K/D, weapons, map radar) filters by this. "all" = no filter
// (only offered for 5Stack).
// Returns the match_options.type values to filter by (array → Hasura _in), or
// null for no type filter. With source "All" the "Competitive" chip also pulls
// in Premier, since Premier is the external equivalent of competitive play.
const statTypeFilter = computed<string[] | null>(() => {
  const mode = selectedModeRef.value;
  if (mode === "all") {
    return null;
  }
  if (mode === "Competitive" && sourceRef.value === "all") {
    return ["Competitive", "Premier"];
  }
  return [mode];
});

// External Competitive (rank_type 12) / Wingman (6) are Valve skill groups
// (0–18) — render the proper rank badge instead of a bare number. Premier is
// a numeric CS Rating and 5Stack is ELO, so both stay as numbers.
// The top ELO panel is pinned to 5Stack ELO (numeric) and is intentionally
// NOT affected by the source/mode/range filter — that drives the tabs + the
// ELO tab only. So it never renders Valve skill-group badges.
const isSkillGroupMode = computed(() => false);
function rankBadge(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return csRankIcon(selectedModeRef.value === "Wingman" ? 6 : 12, value);
}
// Valve rank type for the chart's y-axis ladder (badges + integer steps);
// null for ELO / Premier (numeric).
const chartRankType = computed<number | null>(() =>
  isSkillGroupMode.value
    ? selectedModeRef.value === "Wingman"
      ? 6
      : 12
    : null,
);

const playerIdRef = computed<string | null>(() => {
  const p = route.params.id;
  if (Array.isArray(p)) return p[0] ?? null;
  if (typeof p === "string" && p.length > 0) return p;
  return useAuthStore().me?.steam_id ?? null;
});

// Drop any pinned comparison when navigating to a different profile.
watch(playerIdRef, () => clearCompareTarget());

const sinceTimestamp = computed<string | null>(() => {
  if (eloRange.value === "custom") {
    return customFrom.value
      ? new Date(customFrom.value + "T00:00:00").toISOString()
      : null;
  }
  const r = presetRanges.find((x) => x.key === eloRange.value);
  if (!r || r.days === null) return null;
  return new Date(Date.now() - r.days * 86_400_000).toISOString();
});

const untilTimestamp = computed<string | null>(() => {
  if (eloRange.value === "custom" && customTo.value) {
    return new Date(customTo.value + "T23:59:59.999").toISOString();
  }
  return null;
});

// Unified stats scope shared with every tab so they all read the same
// source / mode / range. limit is set for count ranges (L30/L100), since/until
// for date ranges; tabs apply whichever is non-null.
const statsScope = computed(() => ({
  source: sourceRef.value,
  matchType: statTypeFilter.value,
  limit: statsMatchLimit.value,
  since: sinceTimestamp.value,
  until: untilTimestamp.value,
}));
provide("playerStatsScope", statsScope);


// Built dynamically so the `match: { is_tournament_match: ... }` filter is
// only added when the setting is on — avoids Hasura forcing a join when
// it isn't needed.
const whereClause = computed(() => {
  // Top ELO panel is all-time 5Stack ELO — the range filter does NOT apply
  // here (it drives the tabs + ELO tab). Tournaments toggle still applies.
  const w: Record<string, any> = {
    player_steam_id: { _eq: playerIdRef.value },
  };
  if (excludeTournaments.value) {
    w.match = { is_tournament_match: { _eq: false } };
  }
  return w;
});

// matches.source comparison for the active source: 5Stack is exact, External
// is "anything that isn't 5Stack" (Valve, FACEIT, …).
const sourceComparison = computed(() =>
  sourceRef.value === "all"
    ? null
    : sourceRef.value === "5stack"
      ? { _eq: "5stack" }
      : { _neq: "5stack" },
);

// Where for v_player_match_performance — scoped to the player, the active
// source, the time window and (optionally) non-tournament matches.
const performanceWhere = computed(() => {
  const w: Record<string, any> = {
    player_steam_id: { _eq: playerIdRef.value },
  };
  if (sourceComparison.value) {
    w.source = sourceComparison.value;
  }
  if (sinceTimestamp.value || untilTimestamp.value) {
    w.match_created_at = {};
    if (sinceTimestamp.value) w.match_created_at._gte = sinceTimestamp.value;
    if (untilTimestamp.value) w.match_created_at._lte = untilTimestamp.value;
  }
  if (excludeTournaments.value) {
    w.match = { is_tournament_match: { _eq: false } };
  }
  return w;
});

// Weapons are lifetime within the active source + mode (type). "all" (5Stack)
// spans every type.
const weaponWhere = computed(() => {
  const w: Record<string, any> = {
    player_steam_id: { _eq: playerIdRef.value },
  };
  if (sourceComparison.value) {
    w.source = sourceComparison.value;
  }
  if (statTypeFilter.value) {
    w.type = { _in: statTypeFilter.value };
  }
  return w;
});

// Stats are one-shot queries (network-only), not subscriptions — live stat
// updates aren't worth a persistent socket. They re-run when the filters
// change, and the Refresh button re-runs them on demand. A per-loader
// generation guard drops stale responses when filters change mid-flight.
const PLAYER_ELO_HISTORY_QUERY = gql`
  query PlayerWindowedEloHistory($where: v_player_elo_bool_exp!) {
    v_player_elo(where: $where, order_by: { match_created_at: asc }) {
      current_elo
      updated_elo
      elo_change
      match_created_at
      match_id
      match_result
      type
      kills
      deaths
      assists
    }
  }
`;

const PLAYER_PREMIER_HISTORY_QUERY = gql`
  query PlayerWindowedPremierHistory(
    $where: player_premier_rank_history_bool_exp!
  ) {
    player_premier_rank_history(
      where: $where
      order_by: { observed_at: asc }
    ) {
      rank
      rank_type
      previous_rank
      match_id
      map_id
      map {
        name
      }
      observed_at
    }
  }
`;

let eloLoadGen = 0;
let premierLoadGen = 0;

async function loadEloHistory() {
  if (!playerIdRef.value) {
    eloHistory.value = [];
    return;
  }
  eloHistoryLoading.value = true;
  const gen = ++eloLoadGen;
  try {
    const { data } = await apolloClient.query({
      query: PLAYER_ELO_HISTORY_QUERY,
      variables: { where: whereClause.value },
      fetchPolicy: "network-only",
    });
    if (gen !== eloLoadGen) return;
    eloHistory.value = ((data as any)?.v_player_elo ?? []) as WindowedEloEntry[];
  } catch {
    if (gen === eloLoadGen) eloHistory.value = [];
  } finally {
    if (gen === eloLoadGen) eloHistoryLoading.value = false;
  }
}

async function loadPremierHistory() {
  if (!playerIdRef.value) {
    rankHistoryRows.value = [];
    premierWindowedHistory.value = [];
    return;
  }
  const gen = ++premierLoadGen;
  const premierWhere: Record<string, any> = {
    steam_id: { _eq: playerIdRef.value },
  };
  if (sinceTimestamp.value) {
    premierWhere.observed_at = { _gte: sinceTimestamp.value };
  }
  if (untilTimestamp.value) {
    premierWhere.observed_at = {
      ...(premierWhere.observed_at ?? {}),
      _lte: untilTimestamp.value,
    };
  }
  try {
    const { data } = await apolloClient.query({
      query: PLAYER_PREMIER_HISTORY_QUERY,
      variables: { where: premierWhere },
      fetchPolicy: "network-only",
    });
    if (gen !== premierLoadGen) return;
    const rows = ((data as any)?.player_premier_rank_history ?? []) as Array<{
      rank: number;
      rank_type: number;
      previous_rank: number | null;
      match_id: string | null;
      map_id: string | null;
      map?: { name: string } | null;
      observed_at: string;
    }>;
    rankHistoryRows.value = rows;
    // Premier (rank_type 11) drives the ELO-style chart series.
    let prev: number | null = null;
    premierWindowedHistory.value = rows
      .filter((r) => r.rank_type === 11)
      .map((r) => {
        const change = prev === null ? 0 : r.rank - prev;
        prev = r.rank;
        return {
          current_elo: r.rank,
          updated_elo: r.rank,
          elo_change: change,
          match_created_at: r.observed_at,
          match_id: r.match_id,
          match_result: null,
          type: "Premier",
          kills: null,
          deaths: null,
          assists: null,
        };
      });
  } catch {
    if (gen === premierLoadGen) {
      rankHistoryRows.value = [];
      premierWindowedHistory.value = [];
    }
  }
}

watch(
  [playerIdRef, sinceTimestamp, untilTimestamp, excludeTournaments],
  () => {
    loadEloHistory();
    loadPremierHistory();
  },
  { immediate: true },
);

// Per-match performance (win/loss + K/D) and per-source weapon kills — also
// one-shot queries, re-run when the player / source / window changes.
const PLAYER_PERFORMANCE_QUERY = gql`
  query PlayerPerformance($where: v_player_match_performance_bool_exp!) {
    v_player_match_performance(
      where: $where
      order_by: { match_created_at: asc }
    ) {
      match_created_at
      type
      kills
      deaths
      assists
      match_result
    }
  }
`;

const PLAYER_WEAPON_KILLS_QUERY = gql`
  query PlayerWeaponKills($where: v_player_weapon_kills_bool_exp!) {
    v_player_weapon_kills(
      where: $where
      order_by: { kill_count: desc }
      limit: 30
    ) {
      with
      kill_count
    }
  }
`;

let perfLoadGen = 0;
let weaponLoadGen = 0;

async function loadPerformance() {
  if (!playerIdRef.value) {
    performanceHistory.value = [];
    return;
  }
  const gen = ++perfLoadGen;
  try {
    const { data } = await apolloClient.query({
      query: PLAYER_PERFORMANCE_QUERY,
      variables: { where: performanceWhere.value },
      fetchPolicy: "network-only",
    });
    if (gen !== perfLoadGen) return;
    performanceHistory.value = ((data as any)?.v_player_match_performance ??
      []) as WindowedEloEntry[];
  } catch {
    if (gen === perfLoadGen) performanceHistory.value = [];
  }
}

async function loadWeapons() {
  if (!playerIdRef.value) {
    weaponKills.value = [];
    return;
  }
  const gen = ++weaponLoadGen;
  try {
    const { data } = await apolloClient.query({
      query: PLAYER_WEAPON_KILLS_QUERY,
      variables: { where: weaponWhere.value },
      fetchPolicy: "network-only",
    });
    if (gen !== weaponLoadGen) return;
    weaponKills.value = ((data as any)?.v_player_weapon_kills ?? []) as {
      with: string;
      kill_count: number;
    }[];
  } catch {
    if (gen === weaponLoadGen) weaponKills.value = [];
  }
}

watch([playerIdRef, performanceWhere], () => loadPerformance(), {
  immediate: true,
});
watch([playerIdRef, weaponWhere], () => loadWeapons(), { immediate: true });

// Merge duplicate weapon spellings into one canonical row with a resolved
// icon, then take the real top 5. (Pre-migration data may still carry mixed
// spellings; the merge keeps the display correct regardless.)
const topWeapons = computed(() => {
  const merged = new Map<
    string,
    { key: string; icon: string; label: string; kill_count: number }
  >();
  const excluded = new Set(["world", "planted_c4"]);
  for (const w of weaponKills.value) {
    if (excluded.has((w.with ?? "").toLowerCase().trim())) continue;
    const r = resolveWeapon(w.with);
    const entry = merged.get(r.key) ?? { ...r, kill_count: 0 };
    entry.kill_count += Number(w.kill_count) || 0;
    merged.set(r.key, entry);
  }
  return [...merged.values()]
    .sort((a, b) => b.kill_count - a.kill_count)
    .slice(0, 5);
});

const REFRESH_FACEIT_MUTATION = gql`
  mutation RefreshFaceitRank($steam_id: String!) {
    refreshFaceitRank(steam_id: $steam_id) {
      success
    }
  }
`;

async function triggerFaceitRefresh(steamId: string | null) {
  if (!steamId) return;
  try {
    await apolloClient.mutate({
      mutation: REFRESH_FACEIT_MUTATION,
      variables: { steam_id: steamId },
    });
  } catch {
    // Silent — refresh is rate-limited server-side and the chip reads
    // from the players row, so a failed action just means we'll retry
    // on the next visit.
  }
}

watch(playerIdRef, (id) => triggerFaceitRefresh(id), { immediate: true });

// The range bar drives the matches list + count as well. We pull the
// player→matches relation with a where clause; the count uses the
// matches_aggregate on the same relation so list + count stay in sync.
const matchesPage = ref(1);
const matchesPerPage = usePerPage("player-matches");
const playerMatches = ref<any[]>([]);
const playerMatchesTotal = ref(0);
const ratingByMatch = ref<Map<string, number>>(new Map());
// match_id -> focus player's aggregate stats, batched for the whole page so the
// collapsed rows don't each fire a matches_by_pk query.
const statsByMatch = ref<Map<string, any>>(new Map());

// The matches list shares the one filter bar (source + mode + range) with the
// stats above — no separate controls; changing the top filter updates both.
const matchesWhere = computed(() => {
  const w: Record<string, any> = {};
  if (sinceTimestamp.value || untilTimestamp.value) {
    w.created_at = {};
    if (sinceTimestamp.value) w.created_at._gte = sinceTimestamp.value;
    if (untilTimestamp.value) w.created_at._lte = untilTimestamp.value;
  }
  if (excludeTournaments.value) {
    w.is_tournament_match = { _eq: false };
  }
  if (sourceRef.value !== "all") {
    w.source =
      sourceRef.value === "external" ? { _neq: "5stack" } : { _eq: "5stack" };
  }
  if (statTypeFilter.value) {
    w.options = { type: { _in: statTypeFilter.value } };
  }
  return w;
});

// External Valve matches carry no internal elo, but the demo import records
// the player's rank per match in player_rank_history — Premier (11) CS Rating,
// Competitive (12) and Wingman (7) skill groups. Keyed by match id with the
// stored delta so the rows can render the right badge + change.
const rankByMatch = computed(() => {
  const map: Record<
    string,
    { rankType: number; rank: number; change: number }
  > = {};
  for (const r of rankHistoryRows.value) {
    if (r.match_id != null) {
      const rank = Number(r.rank ?? 0);
      const prev = r.previous_rank == null ? null : Number(r.previous_rank);
      map[String(r.match_id)] = {
        rankType: Number(r.rank_type),
        rank,
        change: prev == null ? 0 : rank - prev,
      };
    }
  }
  return map;
});

// Built with Zeus so we keep the same selector source-of-truth as the
// other matches queries on this codebase (simpleMatchFields). The
// `where` is hoisted to a variable so Apollo can normalize cache keys
// across filter changes.
const PLAYER_MATCHES_QUERY = generateQuery({
  __alias: {
    playerWithMatches: {
      players_by_pk: [
        { steam_id: $("playerId", "bigint!") },
        {
          steam_id: true,
          matches: [
            {
              where: $("matchesWhere", "matches_bool_exp"),
              limit: $("limit", "Int!"),
              offset: $("offset", "Int!"),
              order_by: [
                { effective_at: order_by.desc_nulls_last },
                { created_at: order_by.desc },
              ],
            },
            {
              ...simpleMatchFields,
              elo_changes: [
                {
                  where: {
                    player_steam_id: { _eq: $("playerId", "bigint!") },
                  },
                },
                eloFields,
              ],
            },
          ],
        },
      ],
    },
  },
});

// Count query is intentionally minimal — just IDs — since Hasura's
// players->matches relationship doesn't expose an aggregate.
const PLAYER_MATCHES_COUNT_QUERY = generateQuery({
  __alias: {
    playerMatchesCount: {
      players_by_pk: [
        { steam_id: $("playerId", "bigint!") },
        {
          steam_id: true,
          matches: [
            { where: $("matchesWhere", "matches_bool_exp") },
            { id: true },
          ],
        },
      ],
    },
  },
});

async function loadMatches() {
  if (!playerIdRef.value) {
    playerMatches.value = [];
    playerMatchesTotal.value = 0;
    return;
  }
  try {
    const [list, count] = await Promise.all([
      apolloClient.query({
        query: PLAYER_MATCHES_QUERY,
        variables: {
          playerId: playerIdRef.value,
          matchesWhere: matchesWhere.value,
          limit: matchesPerPage.value,
          offset: (matchesPage.value - 1) * matchesPerPage.value,
        },
        fetchPolicy: "network-only",
      }),
      apolloClient.query({
        query: PLAYER_MATCHES_COUNT_QUERY,
        variables: {
          playerId: playerIdRef.value,
          matchesWhere: matchesWhere.value,
        },
        fetchPolicy: "network-only",
      }),
    ]);
    playerMatches.value = (list.data as any)?.playerWithMatches?.matches ?? [];
    playerMatchesTotal.value =
      (count.data as any)?.playerMatchesCount?.matches?.length ?? 0;
    void loadMatchEnrichment();
  } catch {
    // swallow — page is subscription-driven elsewhere; matches table
    // simply shows whatever last succeeded.
  }
}

// Enrich the visible page of matches in one request: the focus player's
// aggregate stats (powers the collapsed rows, replacing a per-row
// matches_by_pk) plus the canonical KAST-inclusive HLTV rating (the row's own
// formula omits KAST). Both views are keyed (steam_id, match_id) and indexed,
// so this is a single batched round-trip rather than one query per row.
async function loadMatchEnrichment() {
  const ids = playerMatches.value
    .map((m: any) => String(m?.id ?? ""))
    .filter(Boolean);
  if (!playerIdRef.value || !ids.length) {
    statsByMatch.value = new Map();
    ratingByMatch.value = new Map();
    return;
  }
  try {
    const { data } = await apolloClient.query({
      query: playerMatchSummaryQuery,
      variables: { steamId: playerIdRef.value, matchIds: ids },
      fetchPolicy: "network-only",
    });
    const stats = new Map<string, any>();
    for (const row of (data as any)?.player_match_stats_v ?? []) {
      if (row.match_id != null) {
        stats.set(String(row.match_id), row);
      }
    }
    statsByMatch.value = stats;

    const ratings = new Map<string, number>();
    for (const row of (data as any)?.v_player_match_rating ?? []) {
      if (row.match_id != null && row.hltv_rating != null) {
        ratings.set(String(row.match_id), Number(row.hltv_rating));
      }
    }
    ratingByMatch.value = ratings;
  } catch {
    statsByMatch.value = new Map();
    ratingByMatch.value = new Map();
  }
}

// Reset to page 1 whenever the filter changes — otherwise a deep page
// in a large window becomes empty when the user narrows the window.
watch(matchesWhere, () => {
  matchesPage.value = 1;
});

watch(
  [playerIdRef, matchesWhere, matchesPage, matchesPerPage],
  () => loadMatches(),
  {
    immediate: true,
  },
);

// Has this player EVER played a match (any source, ignoring the filter bar)?
// null while loading. Drives the brand-new-player empty state — distinct from
// "no matches in the active window", which the filters can produce on a player
// with plenty of history. Reuses the lightweight ids-only count query.
const playerHasAnyMatches = ref<boolean | null>(null);
let anyMatchesGen = 0;
async function loadAnyMatches() {
  if (!playerIdRef.value) {
    playerHasAnyMatches.value = null;
    return;
  }
  const gen = ++anyMatchesGen;
  const countFor = async (matchesWhere: Record<string, any>) => {
    const { data } = await apolloClient.query({
      query: PLAYER_MATCHES_COUNT_QUERY,
      variables: { playerId: playerIdRef.value, matchesWhere },
      fetchPolicy: "network-only",
    });
    return ((data as any)?.playerMatchesCount?.matches?.length ?? 0) as number;
  };
  try {
    // When external imports are on we also need the 5Stack-only count so we can
    // auto-switch the source for players who only have external matches
    // (otherwise the default 5Stack source shows "No parsed matches").
    const [total, fiveStack] = await Promise.all([
      countFor({}),
      appSettings.externalMatchesEnabled
        ? countFor({ source: { _eq: "5stack" } })
        : Promise.resolve(null),
    ]);
    if (gen !== anyMatchesGen) return;
    playerHasAnyMatches.value = total > 0;
    // Only external matches + the viewer hasn't picked a source → show "All" so
    // their stats actually render instead of an empty 5Stack tab.
    if (
      appSettings.externalMatchesEnabled &&
      total > 0 &&
      fiveStack === 0 &&
      route.query.source == null
    ) {
      setSource("all");
    }
  } catch {
    if (gen === anyMatchesGen) playerHasAnyMatches.value = null;
  }
}
// Not immediate / mount-only on first load: this can call setSource(), and
// replacing the route query during setup (or SSR) updates the URL but the
// reactive route the toggle reads never syncs ("switches too soon"). Running it
// after mount guarantees the router is ready before we touch the query.
watch(playerIdRef, () => loadAnyMatches());
onMounted(() => loadAnyMatches());

// Brand-new player with nothing to show anywhere — collapse the whole stats /
// tabs / matches block into a single clean empty state instead of a stack of
// empty panels.
const noCareerData = computed(() => playerHasAnyMatches.value === false);

// Top ELO panel data — always the full 5Stack ELO history, independent of the
// source/mode filter (that only drives the tabs + the ELO tab).
const modeFilteredWindowed = computed<WindowedEloEntry[]>(
  () => eloHistory.value,
);

const windowedStats = computed(() => {
  // Top panel: 5Stack ELO headline straight off the full history, unfiltered.
  const list = modeFilteredWindowed.value;
  const headlineList = list;
  // Win Rate / K-D from v_player_match_performance, scoped to the active
  // source + mode (= match type) + window. Every mode chip maps to a real
  // match_options.type, so the same filter works for 5Stack and External.
  const perfList = statTypeFilter.value
    ? performanceHistory.value.filter((e) =>
        statTypeFilter.value!.includes(e.type),
      )
    : performanceHistory.value;
  if (list.length === 0 && perfList.length === 0) {
    return {
      current: null as number | null,
      peak: null as number | null,
      lowest: null as number | null,
      total: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      winPct: 0,
      avgChange: 0,
      netChange: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      kd: 0,
      kdPct: 0,
      bestGain: null as WindowedEloEntry | null,
      worstLoss: null as WindowedEloEntry | null,
      peakEntry: null as WindowedEloEntry | null,
    };
  }
  let peak = -Infinity;
  let lowest = Infinity;
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let changeSum = 0;
  let changeCount = 0;
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let bestGain: WindowedEloEntry | null = null;
  let worstLoss: WindowedEloEntry | null = null;
  let peakEntry: WindowedEloEntry | null = null;

  for (const e of headlineList) {
    const elo = e.updated_elo ?? e.current_elo ?? null;
    if (elo !== null) {
      if (elo > peak) {
        peak = elo;
        peakEntry = e;
      }
      if (elo < lowest) lowest = elo;
    }
  }

  for (const e of perfList) {
    if (e.match_result === "won" || e.match_result === "win") wins++;
    else if (e.match_result === "lost" || e.match_result === "loss") losses++;
    else if (e.match_result === "tied" || e.match_result === "tie") ties++;

    if (typeof e.elo_change === "number") {
      changeSum += e.elo_change;
      changeCount++;
      if (!bestGain || e.elo_change > (bestGain.elo_change ?? -Infinity))
        bestGain = e;
      if (!worstLoss || e.elo_change < (worstLoss.elo_change ?? Infinity))
        worstLoss = e;
    }
    kills += e.kills ?? 0;
    deaths += e.deaths ?? 0;
    assists += e.assists ?? 0;
  }

  const last = headlineList[headlineList.length - 1];
  const current = last?.updated_elo ?? last?.current_elo ?? null;
  const decided = wins + losses;
  const kd = deaths > 0 ? kills / deaths : kills;
  const kdPct = Math.min((kd / 2) * 100, 100);

  return {
    current,
    peak: peak === -Infinity ? null : peak,
    lowest: lowest === Infinity ? null : lowest,
    total: perfList.length,
    wins,
    losses,
    ties,
    winPct: decided > 0 ? (wins / decided) * 100 : 0,
    avgChange: changeCount > 0 ? changeSum / changeCount : 0,
    netChange: changeSum,
    kills,
    deaths,
    assists,
    kd,
    kdPct,
    bestGain,
    worstLoss,
    peakEntry,
  };
});

// At wide ranges (1Y / ALL / long custom spans) plotting every match
// drowns the trend in daily noise. We collapse points into period
// buckets — last entry per bucket wins (= "ELO at end of period"),
// and elo_change is the sum across the bucket (= net Δ over the
// period). The modal stays raw so the drill-down keeps full detail.
type BucketSize = "raw" | "week" | "month";

// Density floor — below ~30 points the raw chart isn't crowded, and
// bucketing those few entries into months just throws away resolution
// (and produces sparse, lonely-looking points). Only collapse into
// period buckets when there's enough data to actually need summarising.
const BUCKET_MIN_POINTS = 30;

const bucketSize = computed<BucketSize>(() => {
  // Top panel is all-time 5Stack ELO, so bucket by data volume (not the
  // range filter, which no longer applies here).
  const n = eloHistory.value.length;
  if (n < BUCKET_MIN_POINTS) return "raw";
  if (n > 150) return "month";
  if (n > 50) return "week";
  return "raw";
});

function bucketKeyFor(iso: string, size: BucketSize): string {
  const d = new Date(iso);
  if (size === "month") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (size === "week") {
    // ISO-week key — matches what TimescaleDB's `time_bucket('1 week')`
    // produces on UTC, so swapping to a backend function later won't
    // shift the bucket boundaries on the user.
    const tmp = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil(
      ((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
    );
    return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  return iso;
}

function bucketHistory(
  list: WindowedEloEntry[],
  size: BucketSize,
): WindowedEloEntry[] {
  if (size === "raw" || list.length === 0) return list;
  const groups = new Map<string, WindowedEloEntry[]>();
  for (const e of list) {
    const k = bucketKeyFor(e.match_created_at, size);
    let arr = groups.get(k);
    if (!arr) {
      arr = [];
      groups.set(k, arr);
    }
    arr.push(e);
  }
  return Array.from(groups.values())
    .map((entries) => {
      entries.sort(
        (a, b) =>
          new Date(a.match_created_at).getTime() -
          new Date(b.match_created_at).getTime(),
      );
      const last = entries[entries.length - 1];
      const netChange = entries.reduce(
        (sum, e) => sum + (e.elo_change ?? 0),
        0,
      );
      return { ...last, elo_change: netChange };
    })
    .sort(
      (a, b) =>
        new Date(a.match_created_at).getTime() -
        new Date(b.match_created_at).getTime(),
    );
}

// Multi-series chart driven by the window. When a specific mode is
// active the chart shows ONLY that mode — other modes' lines would
// be visual noise once you've narrowed in. In "all" mode we show
// all three, with Competitive focused (bold + Δ labels) since it
// usually carries the most volume.
const windowedChartSeries = computed(() => {
  const size = bucketSize.value;

  // Always the 5Stack ELO overlay (Competitive / Wingman / Duel, Competitive
  // focused) — independent of the source/mode filter, which drives the tabs.
  const groupBy = (m: "Competitive" | "Wingman" | "Duel") =>
    bucketHistory(
      eloHistory.value.filter((e) => e.type === m),
      size,
    );

  const allModes = ["Competitive", "Wingman", "Duel"] as const;
  return allModes
    .map((m) => ({
      key: m,
      label: m,
      history: groupBy(m),
      focus: m === "Competitive",
    }))
    .filter((s) => s.history.length > 0);
});

const bucketLabel = computed(() => {
  switch (bucketSize.value) {
    case "month":
      return t("elo_chart_bucket.monthly");
    case "week":
      return t("elo_chart_bucket.weekly");
    default:
      return t("elo_chart_bucket.per_match");
  }
});

const hasWindowedEloData = computed(
  () => modeFilteredWindowed.value.length > 0,
);

// Range labels are date-aware so the popover and chips agree on what's
// currently active without each side having to recompute.
const activeRangeLabel = computed(() => {
  if (eloRange.value === "custom") {
    const from = customFrom.value || "—";
    const to = customTo.value || "now";
    return `${from} → ${to}`;
  }
  const r = presetRanges.find((x) => x.key === eloRange.value);
  return r?.label ?? "—";
});

function setRange(r: RangeKey) {
  eloRange.value = r;
}

function applyCustomRange() {
  // Only switch to the custom window once BOTH ends are chosen — filtering on a
  // half-picked range is jarring. When complete, close the popover (they can
  // re-open it to tweak).
  if (customFrom.value && customTo.value) {
    eloRange.value = "custom";
    settingsOpen.value = false;
  }
}

function onCompareSelected(player: any) {
  setCompareTarget(player);
  settingsOpen.value = false;
}

function clearCustomRange() {
  customFrom.value = "";
  customTo.value = "";
  activeDateField.value = null;
  eloRange.value = "l30";
}

function fmtRangeStat(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

function fmtSignedStat(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  return rounded > 0
    ? `+${rounded.toLocaleString()}`
    : rounded.toLocaleString();
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

definePageMeta({
  alias: ["/me/:id"],
  // Keep these filter params out of the NuxtPage key (like `mode`/`tab`) so
  // changing them updates state in place instead of remounting + refetching
  // the whole page. `mode`/`tab` are excluded globally in app.vue.
  persistQueryKeys: ["source", "range", "from", "to", "compare"],
});

const { isMobile } = useSidebar();
const playerHeroClasses =
  "relative flex min-w-0 flex-col rounded-lg border border-border px-6 py-5 [background:radial-gradient(120%_140%_at_0%_0%,hsl(var(--tac-amber)_/_0.06)_0%,transparent_45%),linear-gradient(180deg,hsl(var(--card)_/_0.5)_0%,hsl(var(--card)_/_0.2)_100%)] [backdrop-filter:blur(6px)] before:pointer-events-none before:absolute before:left-2 before:top-2 before:z-[1] before:h-[14px] before:w-[14px] before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:z-[1] after:h-[14px] after:w-[14px] after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-[''] max-md:px-4 max-md:py-5";
const playerHeroBodyClasses =
  "flex flex-wrap items-center gap-5 max-md:items-start max-md:gap-4";
const playerHeroInlineRoleChipClasses =
  "inline-flex h-7 items-center gap-1.5 rounded border border-border bg-card/60 px-2.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground";
const playerHeroInlineRoleWrapClasses =
  "inline-flex [&_button]:inline-flex [&_button]:h-7 [&_button]:items-center [&_button]:gap-1.5 [&_button]:rounded [&_button]:border-[hsl(var(--tac-amber)_/_0.4)] [&_button]:bg-[hsl(var(--tac-amber)_/_0.08)] [&_button]:px-2.5 [&_button]:font-mono [&_button]:text-[0.6rem] [&_button]:font-semibold [&_button]:tracking-[0.14em] [&_button]:text-[hsl(var(--tac-amber))] [&_button]:hover:border-[hsl(var(--tac-amber))] [&_button]:hover:bg-[hsl(var(--tac-amber)_/_0.16)] [&_button>span]:uppercase [&_button>svg]:h-3 [&_button>svg]:w-3 [&_button>svg]:shrink-0";
const playerHeroNameEditButtonClasses =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-card/60 text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--tac-amber)_/_0.6)] hover:bg-[hsl(var(--tac-amber)_/_0.1)] hover:text-[hsl(var(--tac-amber))] [&_svg]:h-4 [&_svg]:w-4";
const playerHeroAddFriendClasses =
  "group/addfriend relative inline-flex items-center justify-center gap-[0.55rem] overflow-hidden rounded border border-[hsl(var(--tac-amber)_/_0.55)] bg-[hsl(var(--tac-amber)_/_0.12)] px-4 py-2.5 font-sans text-[0.8rem] font-bold uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))] transition-[transform,border-color,background-color,box-shadow] duration-150 hover:-translate-y-px hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)_/_0.2)] hover:shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.45),0_8px_24px_-8px_hsl(var(--tac-amber)/0.5)] disabled:cursor-not-allowed disabled:opacity-60 max-md:w-full";
const playerHeroFriendBadgeClasses =
  "inline-flex items-center justify-center gap-[0.5rem] rounded border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 font-mono text-[0.72rem] font-medium uppercase tracking-[0.16em] text-emerald-400 max-md:w-full";
const playerHeroAvatarFrameClasses =
  "relative h-[156px] w-[156px] border border-[hsl(var(--tac-amber)_/_0.4)] bg-[hsl(var(--tac-amber)_/_0.12)] p-1 max-md:h-24 max-md:w-24";
const playerHeroAvatarClasses = "block h-full w-full object-cover";
const playerHeroAvatarPlaceholderClasses = `${playerHeroAvatarClasses} flex items-center justify-center bg-muted/20 font-sans text-[3.5rem] font-bold text-[hsl(var(--tac-amber))]`;
const playerHeroAvatarCornerClasses =
  "absolute h-3 w-3 border-[hsl(var(--tac-amber))]";
const playerHeroIdentityClasses = "flex min-w-0 flex-1 flex-col gap-2";
const playerHeroNameClasses =
  "relative m-0 min-w-0 font-sans font-bold uppercase leading-[0.9] tracking-[0.02em] [overflow-wrap:anywhere] [font-stretch:80%]";
const playerHeroNameMainClasses = "relative text-foreground";
// Ghost = an offset stroke-only duplicate sitting behind the name. inset-0 makes
// it share the h1's box so it wraps line-for-line with the real name (no clipped
// mid-word bleed on long/multi-line names); the translate gives it depth.
const playerHeroNameGhostClasses =
  "pointer-events-none absolute inset-0 text-transparent select-none [-webkit-text-stroke:1px_hsl(var(--tac-amber)_/_0.35)] [transform:translate(4px,4px)]";
// Admin/owner controls (edit + sanction) live as a toolbar pinned to the top
// of the identity column, aligned with the PLAYER PROFILE eyebrow — not under
// the name where they read as random boxy buttons.
const playerHeroActionsClasses = "flex shrink-0 items-center gap-2";
// One tactical readout line: flag + steam id · steam · role, joined by hairline
// dividers instead of three separate stacked rows of mismatched controls.
const playerHeroMetaStripClasses =
  "flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[0.76rem] text-muted-foreground";
const playerHeroMetaDividerClasses = "h-3 w-px shrink-0 bg-border/70";
const playerHeroIdentClasses = "inline-flex min-w-0 items-center gap-2";
const playerHeroSteamIdClasses = "min-w-0 truncate tracking-[0.05em]";
const playerHeroSteamLinkClasses =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-card/60 text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--tac-amber)_/_0.6)] hover:bg-[hsl(var(--tac-amber)_/_0.1)] hover:text-[hsl(var(--tac-amber))]";
const playerHeroRightActionsClasses =
  "mt-auto flex flex-col items-stretch gap-3 pt-6";
const playerHeroPlayClasses =
  "group/play relative isolate inline-flex w-full cursor-pointer items-center justify-center overflow-hidden border font-sans text-[0.85rem] font-bold uppercase tracking-[0.18em] no-underline transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-px active:translate-y-0 py-[0.7rem] px-4 text-[hsl(0_0%_8%)] border-[hsl(var(--tac-amber))] [background:linear-gradient(135deg,hsl(36_100%_65%)_0%,hsl(var(--tac-amber))_50%,hsl(28_90%_52%)_100%)] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.4),0_6px_20px_-6px_hsl(var(--tac-amber)/0.6)] hover:shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.6),0_12px_32px_-6px_hsl(var(--tac-amber)/0.8),0_0_24px_hsl(var(--tac-amber)/0.35)]";
const playerHeroPlayInnerClasses =
  "relative z-[1] inline-flex items-center gap-[0.65rem]";
const playerHeroPlayIconClasses =
  "h-5 w-5 fill-current transition-transform duration-300 group-hover/play:translate-x-0.5 group-hover/play:scale-110";
const playerHeroPlayGlowClasses =
  "pointer-events-none absolute inset-0 z-0 -translate-x-full bg-[linear-gradient(90deg,transparent_0%,hsl(0_0%_100%_/_0.4)_50%,transparent_100%)] transition-transform duration-500 group-hover/play:translate-x-full";
const playerHeroTeamsClasses = "mt-5 border-t border-border/60 pt-4";
const playerTeamsLabelClasses =
  "mb-[0.65rem] inline-flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground";
const playerTeamsTickClasses = "h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]";
const playerTeamsCountClasses =
  "rounded-full border border-[hsl(var(--tac-amber)_/_0.4)] bg-[hsl(var(--tac-amber)_/_0.15)] px-[0.45rem] py-[0.05rem] text-[0.65rem] tracking-[0.08em] text-[hsl(var(--tac-amber))]";
const playerTeamChipClasses =
  "group/team inline-flex items-center gap-[0.55rem] rounded-md border border-border bg-card/55 px-[0.85rem] py-[0.45rem] [backdrop-filter:blur(6px)] transition-[transform,border-color,background-color] duration-150 hover:-translate-y-px hover:border-[hsl(var(--tac-amber)_/_0.6)] hover:bg-[hsl(var(--tac-amber)_/_0.08)]";
const playerTeamChipDotClasses =
  "h-1.5 w-1.5 rounded-full bg-[hsl(var(--tac-amber))] [box-shadow:0_0_0_3px_hsl(var(--tac-amber)_/_0.2)]";
const playerTeamChipNameClasses =
  "text-sm font-medium text-foreground group-hover/team:text-[hsl(var(--tac-amber))]";
const playerTeamChipShortClasses =
  "rounded bg-muted/40 px-1.5 py-[0.1rem] font-mono text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground";
</script>

<template>
  <div
    ref="pageRootEl"
    class="flex-grow flex flex-col gap-6 overflow-x-hidden"
    :style="
      scrollFloorMinHeight ? { minHeight: scrollFloorMinHeight + 'px' } : {}
    "
    v-if="player"
  >
    <div class="grid min-w-0 items-stretch gap-4 lg:grid-cols-2 lg:gap-6">
    <PageTransition>
      <header :class="playerHeroClasses">
        <div :class="playerHeroBodyClasses">
          <div class="shrink-0">
            <div :class="playerHeroAvatarFrameClasses">
              <img
                v-if="playerAvatarSrc"
                :src="playerAvatarSrc"
                :alt="player.name"
                :class="playerHeroAvatarClasses"
              />
              <div v-else :class="playerHeroAvatarPlaceholderClasses">
                {{ (player.name || "?").charAt(0).toUpperCase() }}
              </div>
              <div
                :class="[
                  playerHeroAvatarCornerClasses,
                  '-left-[2px] -top-[2px] border-l-2 border-t-2',
                ]"
              ></div>
              <div
                :class="[
                  playerHeroAvatarCornerClasses,
                  '-bottom-[2px] -right-[2px] border-b-2 border-r-2',
                ]"
              ></div>
            </div>
          </div>

          <div :class="playerHeroIdentityClasses">
            <div class="flex items-center justify-between gap-3">
              <div
                class="inline-flex items-center gap-2 font-mono text-[0.58rem] uppercase tracking-[0.28em] text-[hsl(var(--tac-amber))]"
              >
                <span
                  class="h-[2px] w-[14px] bg-[hsl(var(--tac-amber))]"
                ></span>
                {{ $t("pages.players.detail.player_profile") }}
              </div>
              <div
                v-if="canEditPlayer || canSanction"
                :class="playerHeroActionsClasses"
              >
                <button
                  v-if="canEditPlayer"
                  type="button"
                  :class="playerHeroNameEditButtonClasses"
                  :title="$t('pages.players.detail.edit_player')"
                  @click="editPlayerSheet = true"
                >
                  <Pencil />
                </button>
                <SanctionPlayer v-if="canSanction" :player="player" />
              </div>
            </div>

            <h1 :class="[playerHeroNameClasses, playerHeroNameSizeClasses]">
              <span
                v-if="showNameGhost"
                :class="playerHeroNameGhostClasses"
                aria-hidden="true"
              >
                {{ player.name }}
              </span>
              <span :class="playerHeroNameMainClasses">{{ player.name }}</span>
            </h1>

            <div :class="playerHeroMetaStripClasses">
              <span :class="playerHeroIdentClasses">
                <TimezoneFlag
                  v-if="player.country"
                  :country="player.country"
                  class="h-auto w-[1.2rem] shrink-0"
                />
                <span :class="playerHeroSteamIdClasses">{{
                  player.steam_id
                }}</span>
              </span>

              <template v-if="player.profile_url">
                <span
                  :class="playerHeroMetaDividerClasses"
                  aria-hidden="true"
                ></span>
                <a
                  :href="player.profile_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  :class="playerHeroSteamLinkClasses"
                  :title="$t('ui.tooltips.view_steam_profile')"
                >
                  <SteamIcon class="h-3.5 w-3.5 fill-current" />
                </a>
              </template>

              <template v-if="canEditRole || player.role">
                <span
                  :class="playerHeroMetaDividerClasses"
                  aria-hidden="true"
                ></span>
                <div v-if="canEditRole" :class="playerHeroInlineRoleWrapClasses">
                  <PlayerRoleForm :player="player" />
                </div>
                <span v-else :class="playerHeroInlineRoleChipClasses">
                  {{ (player.role || "user").replace("_", " ") }}
                </span>
              </template>

              <PlayerSanctions v-if="playerId" :playerId="playerId" />
            </div>
          </div>

        </div>

        <div
          v-if="player?.teams && player.teams.length > 0"
          :class="playerHeroTeamsClasses"
        >
          <div :class="playerTeamsLabelClasses">
            <span :class="playerTeamsTickClasses"></span>
            {{ $t("pages.players.detail.teams") }}
            <span :class="playerTeamsCountClasses">{{
              player.teams.length
            }}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <NuxtLink
              v-for="team in player.teams"
              :key="team.id"
              :to="`/teams/${team.id}`"
              :class="playerTeamChipClasses"
            >
              <span :class="playerTeamChipDotClasses"></span>
              <span :class="playerTeamChipNameClasses">{{ team.name }}</span>
              <span v-if="team.short_name" :class="playerTeamChipShortClasses">
                {{ team.short_name }}
              </span>
            </NuxtLink>
          </div>
        </div>

        <div v-if="hasRightColumn" :class="playerHeroRightActionsClasses">
          <NuxtLink
            v-if="isSelfProfile"
            to="/play"
            :class="[playerHeroPlayClasses, 'max-md:hidden']"
          >
            <span :class="playerHeroPlayInnerClasses">
              <PlayIcon :class="playerHeroPlayIconClasses" />
              <span>{{ $t("pages.players.detail.play_a_match") }}</span>
            </span>
            <span :class="playerHeroPlayGlowClasses" aria-hidden="true"></span>
          </NuxtLink>
          <button
            v-else-if="canAddFriend"
            type="button"
            :class="playerHeroAddFriendClasses"
            :disabled="addFriendPending"
            @click="addAsFriend"
          >
            <UserPlus class="h-4 w-4" />
            <span>{{ $t("player.status.add_friend") }}</span>
          </button>
          <span v-else-if="isFriend" :class="playerHeroFriendBadgeClasses">
            <UserCheck class="h-3.5 w-3.5" />
            <span>{{ $t("pages.players.detail.friend") }}</span>
          </span>
        </div>
      </header>
    </PageTransition>

        <PageTransition :delay="150">
          <AnimatedCard
            variant="elevated"
            class="relative flex flex-col h-full p-2.5"
          >
            <CardContent class="flex flex-1 flex-col gap-2 p-0 sm:p-0">
              <!-- Stats strip — two cells now (Current ELO + Peak/Lowest).
                   Matches/W/L lives in the Win Rate card next door so we
                   don't repeat it here. Peak gets a vertical amber rail. -->
              <div
                class="grid grid-cols-1 divide-y divide-border/40 overflow-hidden rounded-md border border-border/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0"
              >
                <div class="relative min-h-[64px] px-3 py-2.5">
                  <div
                    class="flex items-center justify-between gap-3 font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground"
                  >
                    <span class="truncate">{{
                      $t("pages.players.detail.current_elo")
                    }}</span>
                  </div>
                  <div class="mt-1 flex items-center gap-2">
                    <img
                      v-if="isSkillGroupMode && rankBadge(windowedStats.current)"
                      :src="rankBadge(windowedStats.current)!"
                      :alt="fmtRangeStat(windowedStats.current)"
                      :title="fmtRangeStat(windowedStats.current)"
                      class="h-10 w-auto sm:h-12"
                    />
                    <AnimatedStat
                      v-else
                      :value="fmtRangeStat(windowedStats.current)"
                      class="text-3xl font-bold leading-none tabular-nums tracking-tight sm:text-4xl"
                    />
                  </div>
                </div>

                <div class="relative min-h-[64px] px-3 py-2.5 sm:pl-4">
                  <!-- Amber rail anchoring the headline metric -->
                  <span
                    class="pointer-events-none absolute left-0 top-3 bottom-3 hidden w-[2px] bg-[hsl(var(--tac-amber))] sm:block"
                    aria-hidden="true"
                  ></span>
                  <div
                    class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground"
                  >
                    {{ $t("pages.players.detail.peak_lowest") }}
                  </div>
                  <div class="mt-1 flex items-center gap-2.5">
                    <template
                      v-if="isSkillGroupMode && rankBadge(windowedStats.peak)"
                    >
                      <img
                        :src="rankBadge(windowedStats.peak)!"
                        :alt="fmtRangeStat(windowedStats.peak)"
                        :title="fmtRangeStat(windowedStats.peak)"
                        class="h-7 w-auto [filter:drop-shadow(0_0_10px_hsl(var(--tac-amber)/0.45))]"
                      />
                      <span
                        class="font-mono text-[hsl(var(--tac-amber)/0.35)]"
                        aria-hidden="true"
                        >/</span
                      >
                      <img
                        v-if="rankBadge(windowedStats.lowest)"
                        :src="rankBadge(windowedStats.lowest)!"
                        :alt="fmtRangeStat(windowedStats.lowest)"
                        :title="fmtRangeStat(windowedStats.lowest)"
                        class="h-6 w-auto opacity-80"
                      />
                    </template>
                    <template v-else>
                      <AnimatedStat
                        :value="fmtRangeStat(windowedStats.peak)"
                        class="text-xl font-bold tabular-nums text-[hsl(var(--tac-amber))] [text-shadow:0_0_18px_hsl(var(--tac-amber)/0.35)]"
                      />
                      <span
                        class="font-mono text-[hsl(var(--tac-amber)/0.35)]"
                        aria-hidden="true"
                        >/</span
                      >
                      <AnimatedStat
                        :value="fmtRangeStat(windowedStats.lowest)"
                        class="text-base font-semibold tabular-nums text-muted-foreground/80"
                      />
                    </template>
                  </div>
                  <!-- Date row is ALWAYS rendered (placeholder when no
                       peakEntry yet) so the cell height never changes
                       between empty/loaded states. -->
                  <div
                    class="mt-0.5 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    <template v-if="windowedStats.peakEntry">
                      {{ $t("pages.players.detail.peak") }}
                      {{
                        fmtDateShort(windowedStats.peakEntry.match_created_at)
                      }}
                    </template>
                    <template v-else>&nbsp;</template>
                  </div>
                </div>
              </div>

              <!-- Chart well: fixed height (NOT min-h) so the card never
                   grows when data arrives or when the empty/loading state
                   swaps for the chart. Frame + grid stay constant; the
                   contents inside just swap. -->
              <div
                class="relative min-h-[150px] flex-1 overflow-hidden rounded-md border border-border/40"
              >
                <!-- Registration ticks on the inner frame -->
                <span
                  class="pointer-events-none absolute -top-px left-3 h-1.5 w-1.5 border-l border-t border-[hsl(var(--tac-amber)/0.45)]"
                  aria-hidden="true"
                ></span>
                <span
                  class="pointer-events-none absolute -top-px right-3 h-1.5 w-1.5 border-r border-t border-[hsl(var(--tac-amber)/0.45)]"
                  aria-hidden="true"
                ></span>
                <span
                  class="pointer-events-none absolute -bottom-px left-3 h-1.5 w-1.5 border-l border-b border-[hsl(var(--tac-amber)/0.45)]"
                  aria-hidden="true"
                ></span>
                <span
                  class="pointer-events-none absolute -bottom-px right-3 h-1.5 w-1.5 border-r border-b border-[hsl(var(--tac-amber)/0.45)]"
                  aria-hidden="true"
                ></span>
                <!-- Faint coordinate grid: keeps the surface visually
                     populated when only a few datapoints exist. -->
                <div
                  class="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(0deg,hsl(var(--foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground))_1px,transparent_1px)] [background-size:48px_48px]"
                  aria-hidden="true"
                ></div>

                <!-- Loading: own state distinct from "truly empty" so we
                     don't briefly show "Play a match" while the
                     subscription is just warming up. Pure decoration —
                     animate-ping on the indicator dot only. -->
                <div
                  v-if="eloHistoryLoading && !hasWindowedEloData"
                  class="elo-skeleton relative flex h-full flex-col items-center justify-center gap-3 px-6"
                  aria-busy="true"
                >
                  <!-- Skeleton plot lines — three faint horizontal
                       bars hinting at the chart's grid axes. -->
                  <div
                    class="pointer-events-none absolute inset-x-8 top-[28%] h-px bg-[hsl(var(--foreground)/0.08)]"
                    aria-hidden="true"
                  ></div>
                  <div
                    class="pointer-events-none absolute inset-x-8 top-1/2 h-px bg-[hsl(var(--foreground)/0.12)]"
                    aria-hidden="true"
                  ></div>
                  <div
                    class="pointer-events-none absolute inset-x-8 bottom-[28%] h-px bg-[hsl(var(--foreground)/0.08)]"
                    aria-hidden="true"
                  ></div>
                  <div
                    class="inline-flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground"
                  >
                    <span class="relative flex h-2 w-2">
                      <span
                        class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
                      ></span>
                      <span
                        class="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--tac-amber))]"
                      ></span>
                    </span>
                    {{ $t("pages.players.detail.acquiring_telemetry") }}
                  </div>
                </div>

                <PlayerEloChart
                  v-else-if="hasWindowedEloData"
                  class="relative h-full"
                  :series="windowedChartSeries"
                  :rank-type="chartRankType"
                  :loading="eloHistoryLoading"
                />

                <div
                  v-else
                  class="relative flex h-full flex-col items-center justify-center gap-2 px-6 text-center uppercase text-muted-foreground"
                >
                  <template v-if="eloRange !== 'all' && !noCareerData">
                    <span
                      class="font-mono text-[0.65rem] tracking-[0.22em] text-muted-foreground"
                    >
                      {{ $t("pages.players.detail.no_matches_in_window") }}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      class="transition-transform hover:scale-105"
                      @click="setRange('all')"
                    >
                      {{ $t("pages.players.detail.expand_to_all_time") }}
                    </Button>
                  </template>
                  <template v-else>
                    <span
                      class="font-mono text-[0.65rem] tracking-[0.22em] text-muted-foreground"
                    >
                      {{ $t("pages.players.detail.no_elo_history") }}
                    </span>
                    <NuxtLink
                      v-if="me"
                      to="/play"
                      class="mt-2"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        class="transition-transform hover:scale-105"
                        >{{ $t("pages.players.detail.play_a_match") }}</Button
                      >
                    </NuxtLink>
                  </template>
                </div>
              </div>
              <div
                class="mt-1 flex flex-wrap items-center justify-between gap-2"
              >
                <div
                  v-if="player.steam_id"
                  class="flex flex-wrap items-center gap-2"
                >
                  <PlayerLeaderboardRank :playerSteamId="player.steam_id" />
                  <PlayerFaceitRank
                    :faceit-skill-level="player.faceit_skill_level"
                    :faceit-elo="player.faceit_elo"
                    :faceit-url="player.faceit_url"
                    :faceit-nickname="player.faceit_nickname"
                  />
                  <PlayerPremierRank
                    :premier-rank="player.premier_rank"
                    :premier-rank-updated-at="player.premier_rank_updated_at"
                  />
                </div>
                <button
                  type="button"
                  class="inline-flex h-[26px] flex-1 items-center justify-center gap-1.5 rounded border border-border/60 bg-card/40 px-3 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)_/_0.5)] hover:bg-[hsl(var(--tac-amber)_/_0.08)] hover:text-[hsl(var(--tac-amber))]"
                  @click="openEloTab"
                >
                  <Maximize2 class="h-3 w-3" />
                  {{
                    $t(
                      "pages.players.detail.view_full_elo_history",
                      "View full history",
                    )
                  }}
                </button>
              </div>
            </CardContent>
          </AnimatedCard>
        </PageTransition>
    </div>

    <PageTransition
      :delay="50"
      v-if="playerTrophies && playerTrophies.length > 0"
    >
      <TrophyCase :trophies="playerTrophies" />
    </PageTransition>

    <PageTransition :delay="75" v-if="playerId">
      <PlayerHighlights
        :steam-id="playerId"
        @resolved="highlightsResolved = true"
      />
    </PageTransition>

    <PageTransition v-if="player && pageContentReady && noCareerData">
      <Empty
        class="flex-none gap-3 border border-border/60 bg-card/30 p-6 md:p-8"
      >
        <EmptyTitle>{{ $t("pages.players.detail.no_matches") }}</EmptyTitle>
        <EmptyDescription>
          {{
            isSelfProfile
              ? $t("pages.players.detail.no_matches_self_description")
              : $t("pages.players.detail.no_matches_description")
          }}
        </EmptyDescription>
        <NuxtLink v-if="isSelfProfile" to="/play">
          <Button class="gap-2">
            <PlayIcon class="h-4 w-4 fill-current" />
            {{ $t("pages.players.detail.play_a_match") }}
          </Button>
        </NuxtLink>
      </Empty>
    </PageTransition>

    <div
      class="flex flex-col gap-4 md:gap-6"
      v-if="player && pageContentReady && !noCareerData"
    >
      <Tabs v-model="statsTab" class="w-full">
        <div ref="statsTabsEl" class="scroll-mt-4">
          <!-- Mobile: the underline strip overflows on phones, so collapse the
               sections into a dropdown. Desktop keeps the underline tabs. -->
          <div class="mb-3 md:hidden">
            <Select v-model="statsTab">
              <SelectTrigger
                class="w-full"
                :aria-label="$t('pages.players.detail.section', 'Section')"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="performance">
                  {{ $t("pages.players.detail.tabs.performance") }}
                </SelectItem>
                <SelectItem value="elo">
                  {{ $t("pages.players.detail.tabs.elo") }}
                </SelectItem>
                <SelectItem value="maps">
                  {{ $t("pages.players.detail.tabs.maps") }}
                </SelectItem>
                <SelectItem value="arsenal">
                  {{ $t("pages.players.detail.tabs.arsenal") }}
                </SelectItem>
                <SelectItem value="combat">
                  {{ $t("pages.players.detail.tabs.combat") }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="hidden overflow-x-auto md:block">
            <TabsList
              variant="underline"
              class="h-auto flex-nowrap justify-start mb-3"
            >
              <TabsTrigger value="performance">
                {{ $t("pages.players.detail.tabs.performance") }}
              </TabsTrigger>
              <TabsTrigger value="elo">
                {{ $t("pages.players.detail.tabs.elo") }}
              </TabsTrigger>
              <TabsTrigger value="maps">
                {{ $t("pages.players.detail.tabs.maps") }}
              </TabsTrigger>
              <TabsTrigger value="arsenal">
                {{ $t("pages.players.detail.tabs.arsenal") }}
              </TabsTrigger>
              <TabsTrigger value="combat">
                {{ $t("pages.players.detail.tabs.combat") }}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

      <!-- Unified control bar — stat source (5Stack internal ELO vs Valve
           external rank), source-dependent mode chips, time range, match
           count + settings. One bar so every graph below reads the same
           filter and the two rating worlds never blend. -->
      <div
        class="mb-5 flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 [backdrop-filter:blur(6px)] md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:gap-y-3"
      >
        <!-- Source toggle — only when external imports are enabled (otherwise
             5Stack is the only world, so the toggle is noise). -->
        <div
          v-if="appSettings.externalMatchesEnabled"
          class="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2"
        >
          <span
            class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("pages.players.detail.source", "Source") }}
          </span>
          <div
            class="flex w-full items-center rounded-md border border-border/60 bg-background/40 p-0.5 md:inline-flex md:w-auto"
          >
            <button
              v-for="s in sourceOptions"
              :key="s.value"
              type="button"
              :disabled="sourceDisabled(s.value)"
              :title="
                sourceDisabled(s.value)
                  ? $t('pages.players.detail.source_all_unavailable_elo')
                  : undefined
              "
              class="flex-1 rounded px-2.5 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 md:flex-none"
              :class="
                displaySource === s.value
                  ? 'bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="!sourceDisabled(s.value) && onSourceClick(s.value)"
            >
              {{ s.label }}
            </button>
          </div>
        </div>

        <span
          v-if="appSettings.externalMatchesEnabled"
          class="hidden h-5 w-px bg-border/60 md:block"
          aria-hidden="true"
        ></span>

        <!-- Mode chips (depend on the active source) -->
        <div class="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
          <span
            class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground md:hidden"
          >
            {{ $t("pages.players.detail.mode", "Mode") }}
          </span>
          <div
            class="flex flex-nowrap items-center gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible"
          >
          <button
            v-for="m in modeOptions"
            :key="m.value"
            type="button"
            class="shrink-0 rounded border px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] transition-colors"
            :class="
              selectedModeRef === m.value
                ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.16)] text-[hsl(var(--tac-amber))]'
                : 'border-border/60 bg-card/40 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-foreground'
            "
            @click="setMode(m.value)"
          >
            {{ m.label }}
          </button>
          </div>
        </div>

        <!-- Right cluster: time range + refresh + settings. On mobile this
             becomes a labeled row (range + actions) with the chips on a
             horizontal-scroll line below; inline on desktop. -->
        <div
          class="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-2 md:ml-auto md:flex md:flex-wrap md:items-center md:gap-1.5"
        >
          <span
            class="col-start-1 row-start-1 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            {{ $t("pages.players.detail.range") }}
          </span>
          <div
            class="col-start-1 row-start-2 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible"
          >
          <button
            v-for="r in presetRanges"
            :key="r.key"
            type="button"
            class="shrink-0 rounded border px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] transition-colors"
            :class="
              eloRange === r.key
                ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.16)] text-[hsl(var(--tac-amber))]'
                : 'border-border/60 bg-card/40 text-muted-foreground hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-foreground'
            "
            @click="setRange(r.key)"
          >
            {{ r.label }}
          </button>
          <span
            v-if="eloRange === 'custom'"
            class="shrink-0 rounded border border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.16)] px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
          >
            {{ activeRangeLabel }}
          </span>
          </div>
          <div
            class="col-start-2 row-start-2 flex items-center justify-self-end gap-1.5 md:contents"
          >
          <span
            class="mx-1 hidden h-5 w-px bg-border/60 md:block"
            aria-hidden="true"
          ></span>
          <Popover v-model:open="settingsOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="relative inline-flex h-8 w-8 items-center justify-center rounded border border-border/60 bg-card/40 text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:text-[hsl(var(--tac-amber))]"
                :title="
                  $t('pages.players.detail.range_settings', 'Range settings')
                "
              >
                <Settings2 class="h-4 w-4" />
                <span
                  v-if="settingsChanged"
                  class="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-background bg-[hsl(var(--tac-amber))]"
                  :title="$t('pages.players.detail.settings_changed')"
                ></span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" class="w-80 space-y-4">
              <div class="space-y-2">
                <div
                  class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
                >
                  {{ $t("pages.players.detail.custom_range") }}
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="flex flex-1 items-center justify-between gap-2 rounded border bg-background px-2 py-1.5 text-xs transition-colors"
                    :class="
                      activeDateField === 'from'
                        ? 'border-[hsl(var(--tac-amber))]'
                        : 'border-border hover:border-[hsl(var(--tac-amber)/0.5)]'
                    "
                    @click="
                      activeDateField = activeDateField === 'from' ? null : 'from'
                    "
                  >
                    <span :class="customFrom ? '' : 'text-muted-foreground'">{{
                      customFrom || $t("pages.players.detail.start_date", "Start")
                    }}</span>
                    <CalendarIcon class="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <span class="text-muted-foreground text-xs">→</span>
                  <button
                    type="button"
                    class="flex flex-1 items-center justify-between gap-2 rounded border bg-background px-2 py-1.5 text-xs transition-colors"
                    :class="
                      activeDateField === 'to'
                        ? 'border-[hsl(var(--tac-amber))]'
                        : 'border-border hover:border-[hsl(var(--tac-amber)/0.5)]'
                    "
                    @click="
                      activeDateField = activeDateField === 'to' ? null : 'to'
                    "
                  >
                    <span :class="customTo ? '' : 'text-muted-foreground'">{{
                      customTo || $t("pages.players.detail.end_date", "End")
                    }}</span>
                    <CalendarIcon class="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
                <Calendar
                  v-if="activeDateField === 'from'"
                  v-model="customFromValue"
                  class="rounded-md border border-border"
                />
                <Calendar
                  v-else-if="activeDateField === 'to'"
                  v-model="customToValue"
                  class="rounded-md border border-border"
                />
                <div
                  v-if="eloRange === 'custom' || customFrom || customTo"
                  class="flex items-center justify-between gap-2"
                >
                  <p class="text-[0.65rem] text-muted-foreground">
                    {{ $t("pages.players.detail.custom_window_active") }}
                  </p>
                  <button
                    type="button"
                    class="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground underline hover:text-foreground"
                    @click="clearCustomRange"
                  >
                    {{ $t("common.clear") }}
                  </button>
                </div>
              </div>
              <label
                class="flex items-start gap-2 cursor-pointer rounded p-1 -mx-1 hover:bg-muted/40"
              >
                <Checkbox
                  :model-value="excludeTournaments"
                  @update:model-value="(v) => (excludeTournaments = !!v)"
                  class="mt-0.5"
                />
                <div class="flex-1">
                  <div class="text-sm font-medium">
                    {{ $t("pages.players.detail.exclude_tournaments") }}
                  </div>
                  <div class="text-[0.65rem] text-muted-foreground">
                    {{
                      $t("pages.players.detail.exclude_tournaments_description")
                    }}
                  </div>
                </div>
              </label>

              <Separator />

              <div class="space-y-2">
                <div
                  class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
                >
                  {{ $t("pages.players.detail.compare.label") }}
                </div>
                <!-- The trigger's container (div.relative) isn't full-width on
                     its own, so force it (and the button) to fill — otherwise
                     the chevron sits next to the label instead of flush-right. -->
                <div class="w-full [&_.relative]:w-full [&_button]:w-full">
                  <PlayerSearch
                    class="w-full justify-between"
                    :label="$t('pages.players.detail.compare.select_label')"
                    :exclude="[playerId]"
                    :selected="compareTarget"
                    @selected="onCompareSelected"
                  />
                </div>
                <div class="flex items-center justify-between gap-2">
                  <p class="text-[0.65rem] text-muted-foreground">
                    {{ $t("pages.players.detail.compare.description") }}
                  </p>
                  <button
                    v-if="compareTarget"
                    type="button"
                    class="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground underline hover:text-foreground"
                    @click="clearCompareTarget"
                  >
                    {{ $t("common.clear") }}
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          </div>
        </div>
      </div>

        <div
          v-if="
            sourceRef === 'external' &&
            isSelfProfile &&
            me &&
            !externalAuthLinked &&
            !externalWarningDismissed
          "
          class="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.1)] px-4 py-3"
        >
          <div class="min-w-[200px] flex-1">
            <div
              class="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-warning"
            >
              {{ $t("pages.players.detail.external_warning.title") }}
            </div>
            <div class="mt-0.5 text-[0.8rem] text-muted-foreground">
              {{ $t("pages.players.detail.external_warning.description") }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <NuxtLink
              to="/settings/match-history"
              class="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--warning)/0.6)] bg-[hsl(var(--warning)/0.16)] px-3 py-1.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-warning transition-colors hover:bg-[hsl(var(--warning)/0.26)]"
            >
              {{ $t("pages.players.detail.external_warning.cta") }}
            </NuxtLink>
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded border border-border/60 text-muted-foreground transition-colors hover:text-foreground"
              :title="$t('common.close')"
              @click="dismissExternalWarning"
            >
              ✕
            </button>
          </div>
        </div>

        <TabsContent value="performance" class="mt-0">
          <PageTransition v-if="playerId">
            <PlayerIntroDashboard
              :steam-id="playerId"
              :match-type="statTypeFilter"
              :source="sourceRef"
              :limit="statsMatchLimit"
              :since="sinceTimestamp"
            />
          </PageTransition>
        </TabsContent>

        <TabsContent value="elo" class="mt-0">
          <PageTransition v-if="playerIdRef">
            <PlayerEloHistoryDialog
              :open="statsTab === 'elo'"
              :player-id="playerIdRef"
              :player-name="player?.name ?? null"
              :default-mode="selectedModeRef"
              :default-range="
                ['l30', 'custom'].includes(eloRange) ? 'all' : eloRange
              "
              :exclude-tournaments="excludeTournaments"
              :source="sourceRef"
            />
          </PageTransition>
        </TabsContent>

        <TabsContent value="maps" class="mt-0">
          <PageTransition v-if="playerId">
            <PlayerMapsGrid
              :steam-id="playerId"
              :match-type="statTypeFilter"
              :source="sourceRef"
              :since="sinceTimestamp"
            />
          </PageTransition>
        </TabsContent>

        <TabsContent value="arsenal" class="mt-0">
          <PageTransition v-if="playerId">
            <PlayerWeaponsTable
              :steam-id="playerId"
              :match-type="statTypeFilter"
              :source="sourceRef"
            />
          </PageTransition>
        </TabsContent>

        <TabsContent value="combat" class="mt-0 flex flex-col gap-6">
          <PageTransition v-if="playerId">
            <PlayerPreferredRoles
              :steam-id="playerId"
              :match-type="statTypeFilter"
              :source="sourceRef"
              :limit="statsMatchLimit"
              :since="sinceTimestamp"
            />
          </PageTransition>
          <Separator />
          <PageTransition v-if="playerId">
            <PlayerRoleRadar
              :steam-id="playerId"
              :name="player?.name ?? null"
              :match-type="statTypeFilter"
              :source="sourceRef"
              :limit="statsMatchLimit"
              :since="sinceTimestamp"
            />
          </PageTransition>
          <Separator />
          <PageTransition v-if="playerId">
            <PlayerCareerDuels
              :steam-id="playerId"
              :match-type="statTypeFilter"
              :source="sourceRef"
              :limit="statsMatchLimit"
              :since="sinceTimestamp"
            />
          </PageTransition>
          <Separator />
          <PageTransition v-if="playerId">
            <PlayerCareerClutches
              :steam-id="playerId"
              :match-type="statTypeFilter"
              :source="sourceRef"
              :limit="statsMatchLimit"
              :since="sinceTimestamp"
            />
          </PageTransition>
        </TabsContent>
      </Tabs>

      <Separator />

      <PageTransition v-if="playerId">
        <RecentTournaments
          section-label="TOURNAMENTS"
              :statuses="[
                e_tournament_status_enum.Finished,
                e_tournament_status_enum.Live,
                e_tournament_status_enum.RegistrationOpen,
                e_tournament_status_enum.RegistrationClosed,
                e_tournament_status_enum.Setup,
              ]"
              status-variant="finished"
              order-direction="desc"
              horizontal
              hide-when-empty
              :player-steam-id="playerId"
              :limit="8"
            />
          </PageTransition>
    <PageTransition :delay="500">
      <div>
        <div class="mb-1 flex flex-wrap items-center justify-between gap-3">
          <div :class="[tacticalSectionLabelClasses, 'mb-0']">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("pages.players.detail.matches_section") }}
          </div>
          <div
            class="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            <span class="text-[hsl(var(--tac-amber))]">{{
              sourceRef === "external"
                ? "External"
                : sourceRef === "all"
                  ? $t("pages.players.detail.all_short")
                  : "5Stack"
            }}</span>
            <span class="opacity-40">·</span>
            <span>{{
              selectedModeRef === "all"
                ? $t("pages.players.detail.all_short")
                : selectedModeRef
            }}</span>
          </div>
        </div>
        <Empty v-if="playerMatchesTotal === 0" class="min-h-[200px]">
          <EmptyTitle>{{ $t("pages.players.detail.no_matches") }}</EmptyTitle>
          <EmptyDescription>
            <template v-if="eloRange !== 'all' || excludeTournaments">
              {{ $t("pages.players.detail.no_matches_in_window_period") }}
              <button
                type="button"
                class="ml-1 text-[hsl(var(--tac-amber))] hover:underline"
                @click="setRange('all')"
              >
                {{ $t("pages.players.detail.expand_to_all_time") }}
              </button>
            </template>
            <template v-else>
              {{ $t("pages.players.detail.no_matches_description") }}
            </template>
          </EmptyDescription>
        </Empty>
        <template v-else>
          <PlayerMatchesTable
            :player="player"
            :matches="playerMatches"
            :rank-by-match="rankByMatch"
            :rating-by-match="ratingByMatch"
            :stats-by-match="statsByMatch"
          />
          <Pagination
            :page="matchesPage"
            :per-page="matchesPerPage"
            :total="playerMatchesTotal"
            show-per-page-selector
            @page="(p) => (matchesPage = p)"
            @update:perPage="(n) => (matchesPerPage = n)"
          />
        </template>
      </div>
    </PageTransition>
    </div>
  </div>


  <Sheet
    v-if="player"
    :open="editPlayerSheet"
    @update:open="(open) => (editPlayerSheet = open)"
  >
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{{ $t("pages.players.detail.edit_player") }}</SheetTitle>
        <SheetDescription class="sr-only">
          {{ $t("pages.players.detail.edit_player") }}
        </SheetDescription>
      </SheetHeader>
      <div class="mt-6 space-y-6">
        <div v-if="canEditCountry" class="space-y-2">
          <div
            class="inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
            {{ $t("pages.settings.account.country") }}
          </div>
          <PlayerChangeCountry :player="player" />
        </div>

        <div v-if="canEditAvatar" class="space-y-2">
          <div
            class="inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
            {{ $t("avatar.player_avatar") }}
          </div>
          <AvatarUpload
            variant="dropzone"
            :upload-url="`https://${apiDomain}/avatars/players/${player.steam_id}`"
            :delete-url="`https://${apiDomain}/avatars/players/${player.steam_id}`"
            :has-custom="!!player.custom_avatar_url"
            :current-src="playerAvatarSrc"
          />
        </div>

        <div v-if="canEditAvatar" class="space-y-2">
          <div
            class="inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
            {{ $t("avatar.player_roster_image") }}
          </div>
          <AvatarUpload
            variant="dropzone"
            kind="roster"
            :upload-url="`https://${apiDomain}/avatars/roster-players/${player.steam_id}`"
            :delete-url="`https://${apiDomain}/avatars/roster-players/${player.steam_id}`"
            :has-custom="!!player.roster_image_url"
            :current-src="playerRosterImageSrc"
            :bulk-teams="bulkApplyTeams"
            :bulk-url-builder="
              (teamId) =>
                `https://${apiDomain}/avatars/roster-teams/${teamId}/${player.steam_id}`
            "
          />
        </div>

        <div v-if="canEditName" class="space-y-2">
          <div
            class="inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
            {{ $t("pages.players.detail.name") }}
          </div>
          <PlayerChangeName :player="player" />
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { e_team_roles_enum } from "~/generated/zeus";
import { playerFields } from "~/graphql/playerFields";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import { trophyFields } from "~/graphql/trophyFields";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";

export default {
  apollo: {
    $subscribe: {
      players_by_pk: {
        query: typedGql("subscription")({
          players_by_pk: [
            {
              steam_id: $("playerId", "bigint!"),
            },
            {
              ...playerFields,
              role: true,
              profile_url: true,
              peak_elo: true,
              teams: [
                {},
                {
                  id: true,
                  name: true,
                  short_name: true,
                },
              ],
              wins: true,
              losses: true,
              wins_competitive: true,
              wins_wingman: true,
              wins_duel: true,
              losses_competitive: true,
              losses_wingman: true,
              losses_duel: true,
              faceit_skill_level: true,
              faceit_elo: true,
              faceit_url: true,
              faceit_nickname: true,
              premier_rank: true,
              premier_rank_updated_at: true,
              stats: {
                kills: true,
                deaths: true,
                assists: true,
                headshot_percentage: true,
              },
            },
          ],
        }),
        variables: function () {
          return {
            playerId: this.playerId,
          };
        },
        result: function ({ data }) {
          this.player = data.players_by_pk;
          const ctx = usePlayerContext();
          if (this.player) {
            ctx.value = {
              id: String(this.player.steam_id),
              name: this.player.name,
            };
          } else {
            ctx.value = null;
          }
        },
      },
      // Teams that contain the displayed player, fetched alongside the
      // current viewer's role in each team so we can offer a bulk-apply
      // checklist in the roster editor (player-roster flow only).
      // Excludes Invite rows — those aren't real memberships yet.
      playerTeamMemberships: {
        query: typedGql("subscription")({
          team_roster: [
            {
              where: {
                player_steam_id: { _eq: $("steam_id", "bigint") },
                role: { _neq: e_team_roles_enum.Invite },
              },
            },
            {
              team_id: true,
              roster_image_url: true,
              team: {
                id: true,
                name: true,
                owner_steam_id: true,
                __alias: {
                  viewer_roster: {
                    roster: [
                      {
                        where: {
                          player_steam_id: {
                            _eq: $("viewer_steam_id", "bigint"),
                          },
                        },
                      },
                      {
                        role: true,
                      },
                    ],
                  },
                },
              },
            },
          ],
        }),
        variables: function () {
          return {
            steam_id: this.playerId,
            viewer_steam_id: useAuthStore().me?.steam_id ?? "0",
          };
        },
        skip: function () {
          return !this.playerId || !useAuthStore().me;
        },
        result: function ({ data }: { data: any }) {
          this.playerTeamMemberships = data.team_roster || [];
        },
      },
      playerTrophies: {
        query: typedGql("subscription")({
          tournament_trophies: [
            {
              where: {
                player_steam_id: {
                  _eq: $("steam_id", "bigint"),
                },
              },
            },
            trophyFields,
          ],
        }),
        variables: function () {
          return {
            steam_id: this.playerId,
          };
        },
        skip: function () {
          return !this.playerId;
        },
        result: function ({ data }: { data: any }) {
          this.playerTrophies = data.tournament_trophies || [];
        },
      },
    },
  },
  mounted() {
    // Fallback in case the highlights subscription is slow / never
    // responds — don't keep the stats section hidden forever.
    this.pageContentTimeout = window.setTimeout(() => {
      this.pageContentTimedOut = true;
    }, 800);
  },
  unmounted() {
    usePlayerContext().value = null;
    if (this.pageContentTimeout) {
      window.clearTimeout(this.pageContentTimeout);
    }
  },
  data() {
    return {
      player: undefined,
      playerTrophies: undefined,
      // Trophy + highlights queries resolve out-of-order with the main
      // player query; we hold the stats section until they've settled so
      // their late arrival doesn't push the stats block downward.
      highlightsResolved: false,
      pageContentTimedOut: false,
      pageContentTimeout: null as number | null,
      playerTeamMemberships: [] as Array<{
        team_id: string;
        roster_image_url: string | null;
        team: {
          id: string;
          name: string;
          owner_steam_id: string;
          viewer_roster: Array<{ role: string }>;
        };
      }>,
      editPlayerSheet: false,
      addFriendPending: false,
    };
  },
  computed: {
    pageContentReady(): boolean {
      if (this.pageContentTimedOut) return true;
      return this.playerTrophies !== undefined && this.highlightsResolved;
    },
    playerId() {
      return this.$route.params.id || this.me?.steam_id || null;
    },
    me() {
      return useAuthStore().me;
    },
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    // Scale the hero name down as it gets longer so long handles stay compact
    // (one or two tight lines) instead of wrapping into a giant block that
    // crowds the steam id / badges below.
    playerHeroNameSizeClasses() {
      const len = (this.player?.name || "").length;
      if (len > 22) return "text-[clamp(1.1rem,2.2vw,1.5rem)]";
      if (len > 14) return "text-[clamp(1.4rem,2.8vw,1.95rem)]";
      return "text-[clamp(1.85rem,4vw,3rem)]";
    },
    // The offset stroke "ghost" behind the name reads as intentional depth on
    // short, punchy single-line names but turns into muddy double-vision once a
    // name wraps — so only show it on short names.
    showNameGhost() {
      return (this.player?.name || "").length <= 14;
    },
    playerAvatarSrc() {
      if (!this.player) return null;
      return resolveAvatarUrl(
        this.player.custom_avatar_url || this.player.avatar_url,
        this.apiDomain,
      );
    },
    playerRosterImageSrc() {
      if (!this.player) return null;
      return resolveAvatarUrl(this.player.roster_image_url, this.apiDomain);
    },
    canSanction() {
      if (!this.me || !this.player) {
        return false;
      }
      return (
        this.player.steam_id !== this.me.steam_id &&
        useAuthStore().isRoleAbove(e_player_roles_enum.moderator)
      );
    },
    isSelfProfile() {
      return !!(
        this.me &&
        this.player &&
        this.player.steam_id === this.me.steam_id
      );
    },
    isFriend() {
      if (!this.player) {
        return false;
      }
      return !!useMatchmakingStore().friends.find((friend: any) => {
        return friend.steam_id == this.player.steam_id;
      });
    },
    canAddFriend() {
      return !!(
        this.me &&
        this.player?.steam_id &&
        !this.isSelfProfile &&
        !this.isFriend
      );
    },
    hasRightColumn() {
      return this.isSelfProfile || this.canAddFriend || this.isFriend;
    },
    isAdmin() {
      return useAuthStore().isRoleAbove(e_player_roles_enum.administrator);
    },
    canEditAvatar() {
      return this.isSelfProfile || this.isAdmin;
    },
    canEditName() {
      return this.isSelfProfile || this.isAdmin;
    },
    canEditCountry() {
      if (!this.me || !this.player) {
        return false;
      }
      return (
        this.isSelfProfile ||
        useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer)
      );
    },
    canEditRole() {
      if (!this.me || !this.player || this.isSelfProfile) {
        return false;
      }
      return useAuthStore().isRoleAbove(this.player.role);
    },
    canEditPlayer() {
      return (
        this.canEditAvatar ||
        this.canEditName ||
        this.canEditCountry ||
        this.canEditRole
      );
    },
    // Teams the current viewer can push the new portrait into. Server-side
    // permission is the source of truth — these filters are just so we
    // don't show teams we know the request would be rejected for.
    bulkApplyTeams() {
      const me = useAuthStore().me;
      if (!me) return [];
      const isGlobalOrganizer = useAuthStore().isRoleAbove(
        e_player_roles_enum.match_organizer,
      );
      const memberships = this.playerTeamMemberships ?? [];
      return memberships
        .filter((m) => {
          if (isGlobalOrganizer) return true;
          if (String(m.team.owner_steam_id) === String(me.steam_id))
            return true;
          return m.team.viewer_roster.some(
            (r) => r.role === e_team_roles_enum.Admin,
          );
        })
        .map((m) => ({
          teamId: m.team.id,
          teamName: m.team.name,
          hasCustomImage: !!m.roster_image_url,
        }));
    },
    kd() {
      if (!this.player?.stats) {
        return 0;
      }

      if (this.player?.stats?.deaths === 0) {
        return this.player?.stats.kills;
      }
      return formatStatValue(
        this.player?.stats.kills / this.player?.stats.deaths,
      );
    },
    winLossRatio() {
      const wins = this.player?.wins || 0;
      const losses = this.player?.losses || 0;
      if (losses === 0) {
        return wins > 0 ? wins : "0.00";
      }
      return formatStatValue(wins / losses);
    },
    combatStats() {
      return [
        {
          key: "kills",
          value: this.player?.stats?.kills ?? "-",
          label: this.$t("common.stats.kills"),
          colorClass: "text-foreground",
        },
        {
          key: "assists",
          value: this.player?.stats?.assists ?? "-",
          label: this.$t("common.stats.assists"),
          colorClass: "text-foreground",
        },
        {
          key: "hs",
          value: this.player?.stats?.headshot_percentage
            ? (this.player.stats.headshot_percentage * 100).toFixed(1) + "%"
            : "-",
          label: this.$t("pages.players.filter_chips.headshot_pct"),
          colorClass: "text-primary",
        },
      ];
    },
  },
  methods: {
    async addAsFriend() {
      if (!this.player?.steam_id || this.addFriendPending) return;
      this.addFriendPending = true;
      try {
        await this.$apollo.mutate({
          mutation: typedGql("mutation")({
            insert_my_friends_one: [
              { object: { steam_id: this.player.steam_id } },
              { steam_id: true },
            ],
          }),
        });
      } finally {
        this.addFriendPending = false;
      }
    },
    handleImageError(event) {
      const img = event.target;
      img.style.display = "none";
    },
  },
};
</script>
