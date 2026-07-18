<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import PlayerMatchesTable from "~/components/player/PlayerMatchesTable.vue";
import DemoUpload from "~/components/DemoUpload.vue";
import PlayerIntroDashboard from "~/components/player/PlayerIntroDashboard.vue";
import PlayerMapsGrid from "~/components/player/PlayerMapsGrid.vue";
import PlayerWeaponsTable from "~/components/player/PlayerWeaponsTable.vue";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import PlayerPreferredRoles from "~/components/player/PlayerPreferredRoles.vue";
import PlayerRoleRadar from "~/components/player/PlayerRoleRadar.vue";
import PlayerPerformanceRating from "~/components/player/PlayerPerformanceRating.vue";
import PlayerConsistencyChart from "~/components/player/PlayerConsistencyChart.vue";
import PlayerCareerDuels from "~/components/player/PlayerCareerDuels.vue";
import PlayerCareerClutches from "~/components/player/PlayerCareerClutches.vue";

const { t } = useI18n();

// Demo-upload modal (own profile + admin), opened from a subtle link by matches.
const showDemoUpload = ref(false);
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
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import formatStatValue from "~/utilities/formatStatValue";
import { resolveWeapon } from "~/utilities/weaponIcon";
import { csRankIcon } from "~/utilities/csRank";
import SanctionStatusBadge from "~/components/SanctionStatusBadge.vue";
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
  ChevronDown,
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
import ImageUploadTile from "~/components/ImageUploadTile.vue";
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

type RangeKey =
  | "l30"
  | "7d"
  | "30d"
  | "90d"
  | "1y"
  | "all"
  | "custom"
  | "season";

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
  {
    key: "l30",
    label: t("pages.players.detail.range_l30"),
    days: null,
    matches: 30,
  },
  { key: "7d", label: t("pages.players.detail.range_7d"), days: 7 },
  { key: "90d", label: t("pages.players.detail.range_90d"), days: 90 },
];

const statsTab = ref<
  "performance" | "breakdown" | "elo" | "maps" | "arsenal" | "combat"
>("performance");
const statsTabsEl = ref<HTMLElement | null>(null);

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

// Season quick-filter: sets the stat window to a season's [starts_at, ends_at).
const seasons = ref<
  Array<{
    id: string;
    number: number | null;
    description: string | null;
    starts_at: string;
    ends_at: string | null;
  }>
>([]);
const selectedSeasonId = ref<string | null>(null);
const selectedSeason = computed(
  () => seasons.value.find((s) => s.id === selectedSeasonId.value) || null,
);
const seasonsEnabled = computed(() => appSettings.seasonsEnabled);
// Ascending (S1, S2, S3…) for the dropdown; the fetch itself is desc.
const seasonsAsc = computed(() =>
  [...seasons.value].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
);
// The season containing "now" (falls back to the latest when off-season).
const activeSeason = computed(() => {
  const now = Date.now();
  return (
    seasons.value.find(
      (s) =>
        new Date(s.starts_at).getTime() <= now &&
        (!s.ends_at || new Date(s.ends_at).getTime() > now),
    ) ||
    seasons.value[0] ||
    null
  );
});
// Left segment always shows a season number: the selected season while season
// mode is on, otherwise the current/active season (the one a click would pick).
const seasonButtonLabel = computed(() => {
  const s =
    (eloRange.value === "season" ? selectedSeason.value : null) ??
    activeSeason.value;
  return "S" + (s?.number ?? "?");
});
const seasonMenuOpen = ref(false);

// Selecting a season activates the season range.
function pickSeason(id: string) {
  selectedSeasonId.value = id;
  eloRange.value = "season";
  seasonMenuOpen.value = false;
}
// Left-segment click: enter season mode at the current/selected season.
function activateSeason() {
  if (eloRange.value === "season") return;
  const id =
    selectedSeasonId.value ??
    activeSeason.value?.id ??
    seasons.value[0]?.id ??
    null;
  if (id) pickSeason(id);
}
function seasonRange(s: {
  description: string | null;
  starts_at: string;
  ends_at: string | null;
}): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const range = `${fmt(s.starts_at)} – ${
    s.ends_at ? fmt(s.ends_at) : t("pages.seasons.ongoing")
  }`;
  return s.description ? `${range} · ${s.description}` : range;
}

onMounted(async () => {
  if (!seasonsEnabled.value) {
    return;
  }
  try {
    const { data } = await apolloClient.query({
      query: gql`
        query PlayerSeasonsFilter {
          seasons(order_by: { starts_at: desc }) {
            id
            number
            description
            starts_at
            ends_at
          }
        }
      `,
      fetchPolicy: "no-cache",
    });
    seasons.value = (data as any)?.seasons ?? [];
    const now = Date.now();
    const active = seasons.value.find(
      (s) =>
        new Date(s.starts_at).getTime() <= now &&
        (!s.ends_at || new Date(s.ends_at).getTime() > now),
    );
    selectedSeasonId.value = active?.id ?? seasons.value[0]?.id ?? null;
  } catch {
    seasons.value = [];
  }
});

const statsMatchLimit = computed<number | null>(() => {
  if (eloRange.value === "custom") {
    return null;
  }
  const r = presetRanges.find((x) => x.key === eloRange.value);
  return r?.matches ?? null;
});
const customFrom = ref<string>("");
const customTo = ref<string>("");

function openStatsGuide() {
  window.open(
    "/stats-guide",
    "5stack-stats-guide",
    "popup,width=900,height=850",
  );
}

const customFromValue = computed<DateValue | undefined>({
  get: () => (customFrom.value ? parseDate(customFrom.value) : undefined),
  set: (v) => {
    customFrom.value = v ? v.toString() : "";
    applyCustomRange();
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
const activeDateField = ref<"from" | "to" | null>(null);
const excludeTournaments = ref(false);
const settingsOpen = ref(false);
const eloHistory = ref<WindowedEloEntry[]>([]);
const performanceHistory = ref<WindowedEloEntry[]>([]);
const weaponKills = ref<{ with: string; kill_count: number }[]>([]);
const premierWindowedHistory = ref<WindowedEloEntry[]>([]);
const faceitWindowedHistory = ref<WindowedEloEntry[]>([]);
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

const VALID_STATS_TABS = [
  "performance",
  "breakdown",
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

const VALID_RANGES = ["l30", "7d", "90d", "custom"];
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

type StatSource = "5stack" | "external" | "all";

const appSettings = useApplicationSettingsStore();

const sourceRef = computed<StatSource>(() => {
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
        { value: "5stack", label: t("player_match.source.internal") },
        { value: "external", label: t("player_match.source.external") },
      ]
    : [{ value: "5stack", label: t("player_match.source.internal") }],
);

const eloTabActive = computed(() => statsTab.value === "elo");
const sourceDisabled = (value: StatSource) =>
  eloTabActive.value && value === "all";
const displaySource = computed<StatSource>(() =>
  eloTabActive.value && sourceRef.value === "all" ? "5stack" : sourceRef.value,
);

type StatProvider = "all" | "valve" | "faceit";
const providerRef = computed<StatProvider>(() => {
  if (sourceRef.value !== "external") {
    return "all";
  }
  const raw = route.query.provider;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "valve" || v === "faceit") {
    return v;
  }
  return "all";
});

const providerOptions: { value: StatProvider; label: string }[] = [
  { value: "all", label: t("pages.players.detail.all_short") },
  { value: "valve", label: "Valve" },
  { value: "faceit", label: "Faceit" },
];

function setProvider(p: StatProvider) {
  router.replace({ query: { ...route.query, provider: p, mode: "all" } });
}

const effectiveSource = computed<string>(() => {
  if (sourceRef.value === "external" && providerRef.value !== "all") {
    return providerRef.value;
  }
  return sourceRef.value;
});

const COMPETITIVE_OPT = computed(() => ({
  value: "Competitive",
  label: t("pages.leaderboard.match_types.competitive"),
}));
const WINGMAN_OPT = computed(() => ({
  value: "Wingman",
  label: t("pages.leaderboard.match_types.wingman"),
}));
const ALL_OPT = computed(() => ({
  value: "all",
  label: t("pages.players.detail.all_short"),
}));
const modeOptions = computed<{ value: string; label: string }[]>(() => {
  if (sourceRef.value !== "external") {
    return [
      ALL_OPT.value,
      COMPETITIVE_OPT.value,
      WINGMAN_OPT.value,
      { value: "Duel", label: t("pages.leaderboard.match_types.duel") },
    ];
  }
  switch (providerRef.value) {
    case "valve":
      return [
        ALL_OPT.value,
        { value: "Premier", label: "Premier" },
        COMPETITIVE_OPT.value,
        WINGMAN_OPT.value,
      ];
    case "faceit":
      return [];
    default:
      return [
        ALL_OPT.value,
        { value: "Premier", label: "Premier" },
        COMPETITIVE_OPT.value,
        WINGMAN_OPT.value,
      ];
  }
});

const selectedModeRef = computed<
  "all" | "Competitive" | "Wingman" | "Duel" | "Premier"
>(() => {
  if (providerRef.value === "faceit") {
    return "all";
  }
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

const sourceFilterOptions = computed(() =>
  sourceOptions.value.map((s) => ({
    key: s.value,
    label: s.label,
    disabled: sourceDisabled(s.value),
    desc: sourceDisabled(s.value)
      ? t("pages.players.detail.source_all_unavailable_elo")
      : undefined,
  })),
);
const sourceModel = computed<string>({
  get: () => displaySource.value,
  set: (v) => onSourceClick(v as StatSource),
});

const providerFilterOptions = computed(() =>
  providerOptions.map((p) => ({ key: p.value, label: p.label })),
);
const providerModel = computed<string>({
  get: () => providerRef.value,
  set: (v) => setProvider(v as StatProvider),
});

const modeFilterOptions = computed(() =>
  modeOptions.value.map((m) => ({ key: m.value, label: m.label })),
);
const modeModel = computed<string>({
  get: () => selectedModeRef.value,
  set: (v) => setMode(v),
});

function setSource(s: StatSource) {
  const validModes =
    s === "external"
      ? ["all", "Premier", "Competitive", "Wingman"]
      : ["all", "Competitive", "Wingman", "Duel"];
  const query: Record<string, any> = { ...route.query, source: s };
  if (!validModes.includes(selectedModeRef.value)) {
    query.mode = "all";
  }
  router.replace({ query });
}

function onSourceClick(s: StatSource) {
  eloAutoSwitchedFromAll.value = false;
  setSource(s);
}

const { compareTarget, setCompareTarget, clearCompareTarget } =
  usePlayerCompareTarget();

const settingsChanged = computed(
  () =>
    excludeTournaments.value ||
    eloRange.value === "custom" ||
    !!compareTarget.value,
);

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
  }
});

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

const isSkillGroupMode = computed(() => false);
function rankBadge(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return csRankIcon(selectedModeRef.value === "Wingman" ? 6 : 12, value);
}
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

watch(playerIdRef, () => clearCompareTarget());

const sinceTimestamp = computed<string | null>(() => {
  if (eloRange.value === "season") {
    return selectedSeason.value
      ? new Date(selectedSeason.value.starts_at).toISOString()
      : null;
  }
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
  if (eloRange.value === "season") {
    return selectedSeason.value?.ends_at
      ? new Date(selectedSeason.value.ends_at).toISOString()
      : null;
  }
  if (eloRange.value === "custom" && customTo.value) {
    return new Date(customTo.value + "T23:59:59.999").toISOString();
  }
  return null;
});

const statsScope = computed(() => ({
  source: sourceRef.value,
  provider: providerRef.value,
  matchType: statTypeFilter.value,
  limit: statsMatchLimit.value,
  since: sinceTimestamp.value,
  until: untilTimestamp.value,
}));
provide("playerStatsScope", statsScope);

const whereClause = computed(() => {
  const w: Record<string, any> = {
    player_steam_id: { _eq: playerIdRef.value },
  };
  if (excludeTournaments.value) {
    w.match = { is_tournament_match: { _eq: false } };
  }
  return w;
});

const sourceComparison = computed(() => {
  if (sourceRef.value === "all") {
    return null;
  }
  if (sourceRef.value === "5stack") {
    return { _eq: "5stack" };
  }
  switch (providerRef.value) {
    case "valve":
      return { _eq: "valve" };
    case "faceit":
      return { _eq: "faceit" };
    default:
      return { _neq: "5stack" };
  }
});

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
    player_premier_rank_history(where: $where, order_by: { observed_at: asc }) {
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

const PLAYER_FACEIT_HISTORY_QUERY = gql`
  query PlayerWindowedFaceitHistory(
    $where: player_faceit_rank_history_bool_exp!
  ) {
    player_faceit_rank_history(where: $where, order_by: { observed_at: asc }) {
      elo
      previous_rank
      match_id
      observed_at
    }
  }
`;

let eloLoadGen = 0;
let premierLoadGen = 0;
let faceitLoadGen = 0;

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
    eloHistory.value = ((data as any)?.v_player_elo ??
      []) as WindowedEloEntry[];
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

async function loadFaceitHistory() {
  if (!playerIdRef.value) {
    faceitWindowedHistory.value = [];
    return;
  }
  const gen = ++faceitLoadGen;
  const faceitWhere: Record<string, any> = {
    steam_id: { _eq: playerIdRef.value },
  };
  if (sinceTimestamp.value) {
    faceitWhere.observed_at = { _gte: sinceTimestamp.value };
  }
  if (untilTimestamp.value) {
    faceitWhere.observed_at = {
      ...(faceitWhere.observed_at ?? {}),
      _lte: untilTimestamp.value,
    };
  }
  try {
    const { data } = await apolloClient.query({
      query: PLAYER_FACEIT_HISTORY_QUERY,
      variables: { where: faceitWhere },
      fetchPolicy: "network-only",
    });
    if (gen !== faceitLoadGen) return;
    const rows = ((data as any)?.player_faceit_rank_history ?? []) as Array<{
      elo: number;
      previous_rank: number | null;
      match_id: string | null;
      observed_at: string;
    }>;
    faceitWindowedHistory.value = rows.map((r) => ({
      current_elo: r.elo,
      updated_elo: r.elo,
      elo_change: r.previous_rank == null ? 0 : r.elo - r.previous_rank,
      match_created_at: r.observed_at,
      match_id: r.match_id,
      match_result: null,
      type: "Faceit",
      kills: null,
      deaths: null,
      assists: null,
    }));
  } catch {
    if (gen === faceitLoadGen) faceitWindowedHistory.value = [];
  }
}

watch(
  [playerIdRef, sinceTimestamp, untilTimestamp, excludeTournaments],
  () => {
    loadEloHistory();
    loadPremierHistory();
    loadFaceitHistory();
  },
  { immediate: true },
);

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
  }
}

watch(playerIdRef, (id) => triggerFaceitRefresh(id), { immediate: true });

const matchesPage = ref(1);
const matchesPerPage = usePerPage("player-matches");
const playerMatches = ref<any[]>([]);
const playerMatchesTotal = ref(0);
const ratingByMatch = ref<Map<string, number>>(new Map());
const statsByMatch = ref<Map<string, any>>(new Map());

function scopeToPlayer(filters: Record<string, any>) {
  return {
    _and: [
      filters,
      {
        _or: [
          {
            lineup_1: {
              lineup_players: { steam_id: { _eq: playerIdRef.value } },
            },
          },
          {
            lineup_2: {
              lineup_players: { steam_id: { _eq: playerIdRef.value } },
            },
          },
        ],
      },
    ],
  };
}

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
  if (sourceComparison.value) {
    w.source = sourceComparison.value;
  }
  if (statTypeFilter.value) {
    w.options = { type: { _in: statTypeFilter.value } };
  }
  return scopeToPlayer(w);
});

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

const PLAYER_MATCHES_QUERY = generateQuery({
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
});

const PLAYER_MATCHES_COUNT_QUERY = generateQuery({
  matches_aggregate: [
    { where: $("matchesWhere", "matches_bool_exp") },
    { aggregate: { count: true } },
  ],
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
          matchesWhere: matchesWhere.value,
        },
        fetchPolicy: "network-only",
      }),
    ]);
    playerMatches.value = (list.data as any)?.matches ?? [];
    playerMatchesTotal.value =
      (count.data as any)?.matches_aggregate?.aggregate?.count ?? 0;
    void loadMatchEnrichment();
  } catch {
  }
}

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

const playerHasAnyMatches = ref<boolean | null>(null);
let anyMatchesGen = 0;
async function loadAnyMatches() {
  if (!playerIdRef.value) {
    playerHasAnyMatches.value = null;
    return;
  }
  const gen = ++anyMatchesGen;
  const countFor = async (filters: Record<string, any>) => {
    const { data } = await apolloClient.query({
      query: PLAYER_MATCHES_COUNT_QUERY,
      variables: { matchesWhere: scopeToPlayer(filters) },
      fetchPolicy: "network-only",
    });
    return ((data as any)?.matches_aggregate?.aggregate?.count ?? 0) as number;
  };
  try {
    const [total, fiveStack] = await Promise.all([
      countFor({}),
      appSettings.externalMatchesEnabled
        ? countFor({ source: { _eq: "5stack" } })
        : Promise.resolve(null),
    ]);
    if (gen !== anyMatchesGen) return;
    playerHasAnyMatches.value = total > 0;
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
watch(playerIdRef, () => loadAnyMatches());
onMounted(() => loadAnyMatches());

const noCareerData = computed(() => playerHasAnyMatches.value === false);

const modeFilteredWindowed = computed<WindowedEloEntry[]>(
  () => eloHistory.value,
);

const windowedStats = computed(() => {
  const list = modeFilteredWindowed.value;
  const headlineList = list;
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

const RECENT_FORM_COUNT = 12;
const recentForm = computed(() => {
  const slice = (eloHistory.value ?? []).slice(-RECENT_FORM_COUNT);
  let wins = 0;
  let losses = 0;
  let net = 0;
  const played = slice.map((e, i) => {
    const r = (e.match_result ?? "").toLowerCase();
    const result =
      r === "won" || r === "win"
        ? "win"
        : r === "lost" || r === "loss"
          ? "loss"
          : "tie";
    if (result === "win") {
      wins++;
    } else if (result === "loss") {
      losses++;
    }
    net += typeof e.elo_change === "number" ? e.elo_change : 0;
    return { key: e.match_id ?? `${e.match_created_at}-${i}`, result };
  });
  const blanks = Array.from(
    { length: Math.max(0, RECENT_FORM_COUNT - played.length) },
    (_, i) => ({ key: `blank-${i}`, result: "blank" }),
  );
  return { dots: [...blanks, ...played], wins, losses, net };
});

type BucketSize = "raw" | "week" | "month";

const BUCKET_MIN_POINTS = 30;

const bucketSize = computed<BucketSize>(() => {
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

const windowedChartSeries = computed(() => {
  const size = bucketSize.value;

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
  persistQueryKeys: ["source", "provider", "range", "from", "to", "compare"],
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
const playerHeroNameGhostClasses =
  "pointer-events-none absolute inset-0 text-transparent select-none [-webkit-text-stroke:1px_hsl(var(--tac-amber)_/_0.35)] [transform:translate(4px,4px)]";
const playerHeroActionsClasses = "flex shrink-0 items-center gap-2";
const playerHeroMetaStripClasses =
  "flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[0.76rem] text-muted-foreground";
const playerHeroMetaDividerClasses = "h-3 w-px shrink-0 bg-border/70";
const playerHeroIdentClasses = "inline-flex min-w-0 items-center gap-2";
const playerHeroSteamIdClasses = "min-w-0 truncate tracking-[0.05em]";
const playerHeroSteamLinkClasses =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-card/60 text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--tac-amber)_/_0.6)] hover:bg-[hsl(var(--tac-amber)_/_0.1)] hover:text-[hsl(var(--tac-amber))]";
const playerHeroRightActionsClasses = "flex flex-col items-stretch gap-3";
const playerHeroPlayClasses =
  "group/play relative isolate inline-flex w-full cursor-pointer items-center justify-center overflow-hidden border font-sans text-[0.85rem] font-bold uppercase tracking-[0.18em] no-underline transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-px active:translate-y-0 py-[0.7rem] px-4 text-[hsl(var(--tac-amber-foreground))] border-[hsl(var(--tac-amber))] [background:linear-gradient(135deg,var(--tac-amber-cta-from)_0%,hsl(var(--tac-amber))_50%,var(--tac-amber-cta-to)_100%)] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.4),0_6px_20px_-6px_hsl(var(--tac-amber)/0.6)] hover:shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.6),0_12px_32px_-6px_hsl(var(--tac-amber)/0.8),0_0_24px_hsl(var(--tac-amber)/0.35)]";
const playerHeroPlayInnerClasses =
  "relative z-[1] inline-flex items-center gap-[0.65rem]";
const playerHeroPlayIconClasses =
  "h-5 w-5 fill-current transition-transform duration-300 group-hover/play:translate-x-0.5 group-hover/play:scale-110";
const playerHeroPlayGlowClasses =
  "pointer-events-none absolute inset-0 z-0 -translate-x-full bg-[linear-gradient(90deg,transparent_0%,hsl(0_0%_100%_/_0.4)_50%,transparent_100%)] transition-transform duration-500 group-hover/play:translate-x-full";
const playerHeroFooterClasses = "mt-auto flex flex-col gap-4";
const playerHeroFormClasses = "border-t border-border/60 pt-4";
const playerHeroFormLabelClasses =
  "inline-flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground";
const playerHeroFormTickClasses = "h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]";
const playerHeroFormDotsClasses = "flex flex-wrap items-center gap-1.5";
const playerHeroFormDotBaseClasses = "h-2.5 w-2.5 rounded-[2px]";
const playerHeroTeamChipClasses =
  "inline-flex h-7 items-center gap-1.5 rounded border border-border bg-card/60 px-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--tac-amber)_/_0.6)] hover:bg-[hsl(var(--tac-amber)_/_0.1)] hover:text-[hsl(var(--tac-amber))]";
const playerHeroTeamChipDotClasses =
  "h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--tac-amber))]";
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
                <SanctionStatusBadge
                  v-if="activeSanctionType"
                  :type="activeSanctionType"
                  variant="overlay"
                />
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
                <div :class="playerHeroActionsClasses">
                  <button
                    v-if="canEditPlayer"
                    type="button"
                    :class="playerHeroNameEditButtonClasses"
                    :title="$t('pages.players.detail.edit_player')"
                    @click="editPlayerSheet = true"
                  >
                    <Pencil />
                  </button>
                  <PlayerSanctions
                    v-if="playerId"
                    :playerId="playerId"
                    :player="player"
                    variant="panel"
                  />
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
                <span :class="playerHeroNameMainClasses">{{
                  player.name
                }}</span>
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
                  <div
                    v-if="canEditRole"
                    :class="playerHeroInlineRoleWrapClasses"
                  >
                    <PlayerRoleForm :player="player" />
                  </div>
                  <span v-else :class="playerHeroInlineRoleChipClasses">
                    {{ (player.role || "user").replace("_", " ") }}
                  </span>
                </template>

                <template v-if="player?.teams && player.teams.length > 0">
                  <span
                    :class="playerHeroMetaDividerClasses"
                    aria-hidden="true"
                  ></span>
                  <NuxtLink
                    v-for="team in player.teams"
                    :key="team.id"
                    :to="`/teams/${team.id}`"
                    :class="playerHeroTeamChipClasses"
                    :title="team.name"
                  >
                    <span :class="playerHeroTeamChipDotClasses"></span>
                    <span>{{ team.short_name || team.name }}</span>
                  </NuxtLink>
                </template>
              </div>
            </div>
          </div>

          <div :class="playerHeroFooterClasses">
            <div :class="playerHeroFormClasses">
              <div class="flex items-center justify-between gap-4">
                <div class="min-w-0 space-y-2.5">
                  <span :class="playerHeroFormLabelClasses">
                    <span :class="playerHeroFormTickClasses"></span>
                    {{ $t("pages.players.detail.recent_form") }}
                    <span class="tabular-nums text-foreground/70">
                      {{ recentForm.wins }}–{{ recentForm.losses }}
                    </span>
                  </span>
                  <div :class="playerHeroFormDotsClasses">
                    <span
                      v-for="dot in recentForm.dots"
                      :key="dot.key"
                      :class="[
                        playerHeroFormDotBaseClasses,
                        dot.result === 'win'
                          ? 'bg-emerald-500'
                          : dot.result === 'loss'
                            ? 'bg-red-500'
                            : dot.result === 'tie'
                              ? 'bg-muted-foreground/40'
                              : 'border border-foreground/15 bg-transparent',
                      ]"
                    ></span>
                  </div>
                </div>
                <span
                  class="shrink-0 font-mono text-sm font-semibold tabular-nums"
                  :class="
                    recentForm.net > 0
                      ? 'text-emerald-400'
                      : recentForm.net < 0
                        ? 'text-red-400'
                        : 'text-muted-foreground'
                  "
                >
                  <template v-if="recentForm.net > 0">
                    ▲ +{{ recentForm.net }}
                  </template>
                  <template v-else-if="recentForm.net < 0">
                    ▼ {{ recentForm.net }}
                  </template>
                  <template v-else>+0</template>
                </span>
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
                <span
                  :class="playerHeroPlayGlowClasses"
                  aria-hidden="true"
                ></span>
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
          </div>
        </header>
      </PageTransition>

      <PageTransition :delay="150">
        <AnimatedCard
          variant="elevated"
          class="relative flex flex-col h-full p-2.5"
        >
          <CardContent class="flex flex-1 flex-col gap-2 p-0 sm:p-0">
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
                <div
                  class="mt-0.5 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  <template v-if="windowedStats.peakEntry">
                    {{ $t("pages.players.detail.peak") }}
                    {{ fmtDateShort(windowedStats.peakEntry.match_created_at) }}
                  </template>
                  <template v-else>&nbsp;</template>
                </div>
              </div>
            </div>

            <div
              class="relative min-h-[150px] flex-1 overflow-hidden rounded-md border border-border/40"
            >
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
              <div
                class="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(0deg,hsl(var(--foreground))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground))_1px,transparent_1px)] [background-size:48px_48px]"
                aria-hidden="true"
              ></div>

              <div
                v-if="eloHistoryLoading && !hasWindowedEloData"
                class="elo-skeleton relative flex h-full flex-col items-center justify-center gap-3 px-6"
                aria-busy="true"
              >
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
                  <NuxtLink v-if="me" to="/play" class="mt-2">
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
            <div class="mt-1 flex flex-wrap items-center justify-between gap-2">
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
      </Empty>
    </PageTransition>

    <div
      class="flex flex-col gap-4 md:gap-6"
      v-if="player && pageContentReady && !noCareerData"
    >
      <Tabs v-model="statsTab" class="w-full">
        <div ref="statsTabsEl" class="scroll-mt-4">
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
                <SelectItem value="breakdown">
                  {{ $t("pages.players.detail.tabs.breakdown") }}
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
          <div class="mb-3 hidden items-center justify-between gap-3 md:flex">
            <div class="overflow-x-auto">
              <TabsList
                variant="underline"
                class="h-auto flex-nowrap justify-start"
              >
                <TabsTrigger value="performance">
                  {{ $t("pages.players.detail.tabs.performance") }}
                </TabsTrigger>
                <TabsTrigger value="breakdown">
                  {{ $t("pages.players.detail.tabs.breakdown") }}
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
            <button
              type="button"
              class="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
              @click="openStatsGuide"
            >
              {{ $t("glossary.guide_link") }}
              <ExternalLink class="h-3 w-3" />
            </button>
          </div>
        </div>

        <div
          class="mb-5 flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 [backdrop-filter:blur(6px)] md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:gap-y-3"
        >
          <div
            v-if="appSettings.externalMatchesEnabled"
            class="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2"
          >
            <span
              class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
            >
              {{ $t("pages.players.detail.source", "Source") }}
            </span>
            <AnimatedFilters
              v-model="sourceModel"
              square
              :options="sourceFilterOptions"
            />
          </div>

          <span
            v-if="appSettings.externalMatchesEnabled"
            class="hidden h-5 w-px bg-border/60 md:block"
            aria-hidden="true"
          ></span>

          <div
            v-if="
              appSettings.externalMatchesEnabled && sourceRef === 'external'
            "
            class="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2"
          >
            <span
              class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
            >
              {{ $t("pages.players.detail.provider", "Provider") }}
            </span>
            <AnimatedFilters
              v-model="providerModel"
              square
              :options="providerFilterOptions"
            />
          </div>

          <span
            v-if="
              appSettings.externalMatchesEnabled &&
              sourceRef === 'external' &&
              modeOptions.length
            "
            class="hidden h-5 w-px bg-border/60 md:block"
            aria-hidden="true"
          ></span>

          <div
            v-if="modeOptions.length"
            class="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2"
          >
            <span
              class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground md:hidden"
            >
              {{ $t("pages.players.detail.mode", "Mode") }}
            </span>
            <AnimatedFilters
              v-model="modeModel"
              square
              :options="modeFilterOptions"
            />
          </div>

          <div
            class="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-2 md:ml-auto md:flex md:flex-wrap md:items-center md:gap-1.5"
          >
            <div
              class="col-start-1 row-start-1 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible"
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
              <!-- Season split-control: left segment shows the current/selected
                   season, the right chevron opens a dropdown to switch. -->
              <div
                v-if="seasonsEnabled && seasons.length"
                class="inline-flex shrink-0 items-stretch overflow-hidden rounded border font-mono text-[0.65rem] uppercase tracking-[0.12em] transition-colors"
                :class="
                  eloRange === 'season'
                    ? 'border-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber))]'
                    : 'border-border/60 text-muted-foreground'
                "
              >
                <button
                  type="button"
                  class="px-2.5 py-1 transition-colors"
                  :class="
                    eloRange === 'season'
                      ? 'bg-[hsl(var(--tac-amber)/0.16)]'
                      : 'bg-card/40 hover:text-foreground'
                  "
                  @click="activateSeason"
                >
                  {{ seasonButtonLabel }}
                </button>
                <Popover v-model:open="seasonMenuOpen">
                  <PopoverTrigger as-child>
                    <button
                      type="button"
                      class="flex items-center border-l px-1 transition-colors"
                      :class="
                        eloRange === 'season'
                          ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.16)]'
                          : 'border-border/60 bg-card/40 hover:text-foreground'
                      "
                      :aria-label="$t('pages.players.detail.range_season')"
                    >
                      <ChevronDown class="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" class="w-56 p-1">
                    <button
                      v-for="s in seasonsAsc"
                      :key="s.id"
                      type="button"
                      class="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-[hsl(var(--tac-amber)/0.1)]"
                      :class="{
                        'bg-[hsl(var(--tac-amber)/0.12)]':
                          eloRange === 'season' && s.id === selectedSeasonId,
                      }"
                      @click="pickSeason(s.id)"
                    >
                      <span
                        class="font-mono text-[0.7rem] uppercase tracking-[0.1em]"
                        :class="
                          eloRange === 'season' && s.id === selectedSeasonId
                            ? 'text-[hsl(var(--tac-amber))]'
                            : 'text-foreground'
                        "
                      >
                        {{
                          $t("pages.seasons.season_number", {
                            number: s.number ?? "?",
                          })
                        }}<span
                          v-if="activeSeason && s.id === activeSeason.id"
                          class="text-[hsl(var(--tac-amber))]"
                        >
                          · {{ $t("pages.players.detail.season_current") }}</span
                        >
                      </span>
                      <span class="text-[0.62rem] normal-case text-muted-foreground">
                        {{ seasonRange(s) }}
                      </span>
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
              <span
                v-if="eloRange === 'custom'"
                class="shrink-0 rounded border border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.16)] px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
              >
                {{ activeRangeLabel }}
              </span>
            </div>
            <div
              class="col-start-2 row-start-1 flex items-center justify-self-end gap-1.5 md:contents"
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
                      $t(
                        'pages.players.detail.range_settings',
                        'Range settings',
                      )
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
                          activeDateField =
                            activeDateField === 'from' ? null : 'from'
                        "
                      >
                        <span
                          :class="customFrom ? '' : 'text-muted-foreground'"
                          >{{
                            customFrom ||
                            $t("pages.players.detail.start_date", "Start")
                          }}</span
                        >
                        <CalendarIcon
                          class="h-3.5 w-3.5 text-muted-foreground"
                        />
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
                          activeDateField =
                            activeDateField === 'to' ? null : 'to'
                        "
                      >
                        <span
                          :class="customTo ? '' : 'text-muted-foreground'"
                          >{{
                            customTo ||
                            $t("pages.players.detail.end_date", "End")
                          }}</span
                        >
                        <CalendarIcon
                          class="h-3.5 w-3.5 text-muted-foreground"
                        />
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
                          $t(
                            "pages.players.detail.exclude_tournaments_description",
                          )
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
              to="/settings/external-matches"
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
              :source="effectiveSource"
              :limit="statsMatchLimit"
              :since="sinceTimestamp"
              :until="untilTimestamp"
            />
          </PageTransition>
        </TabsContent>

        <TabsContent value="breakdown" class="mt-0">
          <PageTransition v-if="playerId">
            <div class="flex flex-col gap-4 md:gap-6">
              <PlayerPerformanceRating
                :steam-id="playerId"
                :source="effectiveSource"
                :limit="statsMatchLimit"
              />
              <PlayerConsistencyChart
                :steam-id="playerId"
                :source="effectiveSource"
                :limit="statsMatchLimit"
              />
            </div>
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
              :provider="providerRef"
            />
          </PageTransition>
        </TabsContent>

        <TabsContent value="maps" class="mt-0">
          <PageTransition v-if="playerId">
            <PlayerMapsGrid
              :steam-id="playerId"
              :match-type="statTypeFilter"
              :source="effectiveSource"
              :since="sinceTimestamp"
            />
          </PageTransition>
        </TabsContent>

        <TabsContent value="arsenal" class="mt-0">
          <PageTransition v-if="playerId">
            <PlayerWeaponsTable
              :steam-id="playerId"
              :match-type="statTypeFilter"
              :source="effectiveSource"
            />
          </PageTransition>
        </TabsContent>

        <TabsContent value="combat" class="mt-0 flex flex-col gap-6">
          <PageTransition v-if="playerId">
            <PlayerPreferredRoles
              :steam-id="playerId"
              :match-type="statTypeFilter"
              :source="effectiveSource"
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
              :source="effectiveSource"
              :limit="statsMatchLimit"
              :since="sinceTimestamp"
            />
          </PageTransition>
          <Separator />
          <PageTransition v-if="playerId">
            <PlayerCareerDuels
              :steam-id="playerId"
              :match-type="statTypeFilter"
              :source="effectiveSource"
              :limit="statsMatchLimit"
              :since="sinceTimestamp"
            />
          </PageTransition>
          <Separator />
          <PageTransition v-if="playerId">
            <PlayerCareerClutches
              :steam-id="playerId"
              :match-type="statTypeFilter"
              :source="effectiveSource"
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
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div :class="[tacticalSectionLabelClasses, 'mb-0']">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.players.detail.matches_section") }}
            </div>
            <div
              class="flex items-center gap-3 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              <button
                v-if="isSelfProfile && isAdmin"
                type="button"
                class="underline decoration-dotted underline-offset-4 transition-colors hover:text-[hsl(var(--tac-amber))]"
                @click="showDemoUpload = true"
              >
                {{ $t("pages.settings.external_matches.upload_demo") }}
              </button>
              <span class="flex items-center gap-1.5">
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
              </span>
            </div>
          </div>

          <!-- Demo upload modal (own profile, admins only — matches API gate). -->
          <Dialog v-if="isSelfProfile && isAdmin" v-model:open="showDemoUpload">
            <DialogContent class="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {{ $t("pages.settings.external_matches.upload_demo") }}
                </DialogTitle>
                <DialogDescription>
                  {{ $t("pages.settings.external_matches.upload_demo_description") }}
                </DialogDescription>
              </DialogHeader>
              <DemoUpload />
            </DialogContent>
          </Dialog>

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
          <ImageUploadTile
            class="max-w-[9rem]"
            aspect="square"
            fit="cover"
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
          <ImageUploadTile
            class="max-w-[11rem]"
            aspect="square"
            fit="contain"
            mode="roster"
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
    playerHeroNameSizeClasses() {
      const len = (this.player?.name || "").length;
      if (len > 22) return "text-[clamp(1.1rem,2.2vw,1.5rem)]";
      if (len > 14) return "text-[clamp(1.4rem,2.8vw,1.95rem)]";
      return "text-[clamp(1.85rem,4vw,3rem)]";
    },
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
    activeSanctionType(): "ban" | "mute" | "gag" | null {
      // Severity order ban > mute > (silence) > gag, from the cheap booleans.
      if (this.player?.is_banned) return "ban";
      if (this.player?.is_muted) return "mute";
      if (this.player?.is_gagged) return "gag";
      return null;
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
