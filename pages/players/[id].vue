<script lang="ts" setup>
import MatchesTable from "~/components/MatchesTable.vue";
import Pagination from "~/components/Pagination.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import TournamentTableRow from "~/components/tournament/TournamentTableRow.vue";
import TrophyCase from "~/components/trophy/TrophyCase.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { e_player_roles_enum } from "~/generated/zeus";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
import LastTenWinsAndLosses from "~/components/charts/LastTenWinsAndLosses.vue";
import PlayerEloChart from "~/components/charts/PlayerEloChart.vue";
import formatStatValue from "~/utilities/formatStatValue";
import SanctionPlayer from "~/components/SanctionPlayer.vue";
import PlayerSanctions from "~/components/PlayerSanctions.vue";
import PlayerChangeName from "~/components/PlayerChangeName.vue";
import PlayerChangeCountry from "~/components/PlayerChangeCountry.vue";
import { kdrStrokeColor } from "~/utilities/kdrColor";
import {
  PlayIcon,
  Pencil,
  ExternalLink,
  Settings2,
  Maximize2,
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
import PlayerEloHistoryDialog from "~/components/PlayerEloHistoryDialog.vue";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import { $, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { eloFields } from "~/graphql/eloFields";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Checkbox } from "~/components/ui/checkbox";

// ─── Windowed time-series — drives the ELO chart + stats panels ────────
// The global range chip bar (7D/30D/…/ALL/custom) feeds a single
// v_player_elo subscription scoped to this player. Mode filtering happens
// client-side so toggling modes is instant without re-subscribing.
type RangeKey = "7d" | "30d" | "90d" | "1y" | "all" | "custom";

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
}[] = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "ALL", days: null },
];

const eloRange = ref<RangeKey>("all");
const eloDialogOpen = ref(false);
const customFrom = ref<string>("");
const customTo = ref<string>("");
const compareLifetime = ref(false);
const excludeTournaments = ref(false);
const settingsOpen = ref(false);
const eloHistory = ref<WindowedEloEntry[]>([]);
const eloHistoryLoading = ref(false);

const { client: apolloClient } = useApolloClient();
const route = useRoute();

const selectedModeRef = computed<"all" | "Competitive" | "Wingman" | "Duel">(
  () => {
    const raw = route.query.mode;
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (v === "Competitive" || v === "Wingman" || v === "Duel") return v;
    return "all";
  },
);

const playerIdRef = computed<string | null>(() => {
  const p = route.params.id;
  if (Array.isArray(p)) return p[0] ?? null;
  if (typeof p === "string" && p.length > 0) return p;
  return useAuthStore().me?.steam_id ?? null;
});

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

const rangeLimit = computed(() => {
  switch (eloRange.value) {
    case "7d":
      return 500;
    case "30d":
      return 1500;
    case "90d":
      return 3000;
    case "1y":
      return 6000;
    case "custom":
      return 6000;
    default:
      return 10000;
  }
});

// Built dynamically so the `match: { is_tournament_match: ... }` filter is
// only added when the setting is on — avoids Hasura forcing a join when
// it isn't needed.
const whereClause = computed(() => {
  const w: Record<string, any> = {
    player_steam_id: { _eq: playerIdRef.value },
  };
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

const PLAYER_ELO_HISTORY_SUB = gql`
  subscription PlayerWindowedEloHistory(
    $where: v_player_elo_bool_exp!
    $limit: Int!
  ) {
    v_player_elo(
      where: $where
      order_by: { match_created_at: asc }
      limit: $limit
    ) {
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

let eloSubHandle: { unsubscribe: () => void } | null = null;
let eloSubGen = 0;

function teardownEloSub() {
  if (eloSubHandle) {
    eloSubHandle.unsubscribe();
    eloSubHandle = null;
  }
}

function startEloSub() {
  teardownEloSub();
  if (!playerIdRef.value) return;
  eloHistoryLoading.value = true;
  const gen = ++eloSubGen;
  const obs = apolloClient.subscribe({
    query: PLAYER_ELO_HISTORY_SUB,
    variables: { where: whereClause.value, limit: rangeLimit.value },
  });
  eloSubHandle = obs.subscribe({
    next: ({ data }: any) => {
      if (gen !== eloSubGen) return;
      eloHistory.value = (data?.v_player_elo ?? []) as WindowedEloEntry[];
      eloHistoryLoading.value = false;
    },
    error: () => {
      if (gen === eloSubGen) eloHistoryLoading.value = false;
    },
  });
}

watch(
  [playerIdRef, sinceTimestamp, untilTimestamp, excludeTournaments, rangeLimit],
  () => startEloSub(),
  { immediate: true },
);

onUnmounted(() => teardownEloSub());

// ─── Windowed matches table (Matches tab) ──────────────────────────────
// The range bar drives the matches list + count as well. We pull the
// player→matches relation with a where clause; the count uses the
// matches_aggregate on the same relation so list + count stay in sync.
const matchesPage = ref(1);
const matchesPerPage = ref(10);
const playerMatches = ref<any[]>([]);
const playerMatchesTotal = ref(0);

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
  return w;
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
              order_by: [{}, { created_at: order_by.desc }],
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
  } catch {
    // swallow — page is subscription-driven elsewhere; matches table
    // simply shows whatever last succeeded.
  }
}

// Reset to page 1 whenever the filter changes — otherwise a deep page
// in a large window becomes empty when the user narrows the window.
watch(matchesWhere, () => {
  matchesPage.value = 1;
});

watch([playerIdRef, matchesWhere, matchesPage], () => loadMatches(), {
  immediate: true,
});

const modeFilteredWindowed = computed<WindowedEloEntry[]>(() => {
  if (selectedModeRef.value === "all") return eloHistory.value;
  return eloHistory.value.filter((e) => e.type === selectedModeRef.value);
});

const windowedStats = computed(() => {
  const list = modeFilteredWindowed.value;
  if (list.length === 0) {
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

  for (const e of list) {
    const elo = e.updated_elo ?? e.current_elo ?? null;
    if (elo !== null) {
      if (elo > peak) {
        peak = elo;
        peakEntry = e;
      }
      if (elo < lowest) lowest = elo;
    }
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

  const last = list[list.length - 1];
  const current = last?.updated_elo ?? last?.current_elo ?? null;
  const decided = wins + losses;
  const kd = deaths > 0 ? kills / deaths : kills;
  const kdPct = Math.min((kd / 2) * 100, 100);

  return {
    current,
    peak: peak === -Infinity ? null : peak,
    lowest: lowest === Infinity ? null : lowest,
    total: list.length,
    wins,
    losses,
    ties,
    winPct: decided > 0 ? (wins / decided) * 100 : 0,
    avgChange: changeCount > 0 ? changeSum / changeCount : 0,
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

// ─── Time-bucketing ────────────────────────────────────────────────────
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
  if (eloHistory.value.length < BUCKET_MIN_POINTS) return "raw";
  if (eloRange.value === "all" || eloRange.value === "1y") return "month";
  if (eloRange.value === "90d") return "week";
  if (eloRange.value === "custom") {
    const since = sinceTimestamp.value
      ? new Date(sinceTimestamp.value).getTime()
      : null;
    const until = untilTimestamp.value
      ? new Date(untilTimestamp.value).getTime()
      : Date.now();
    if (since === null) return "month";
    const days = (until - since) / 86_400_000;
    if (days > 270) return "month";
    if (days > 60) return "week";
    return "raw";
  }
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
  const groupBy = (m: "Competitive" | "Wingman" | "Duel") =>
    bucketHistory(
      eloHistory.value.filter((e) => e.type === m),
      size,
    );

  const allModes = ["Competitive", "Wingman", "Duel"] as const;
  const visibleModes =
    selectedModeRef.value === "all"
      ? allModes
      : ([selectedModeRef.value] as readonly (
          | "Competitive"
          | "Wingman"
          | "Duel"
        )[]);

  return visibleModes
    .map((m) => ({
      key: m,
      label: m,
      history: groupBy(m),
      focus: selectedModeRef.value === "all" ? m === "Competitive" : true,
    }))
    .filter((s) => s.history.length > 0);
});

const bucketLabel = computed(() => {
  switch (bucketSize.value) {
    case "month":
      return "Monthly";
    case "week":
      return "Weekly";
    default:
      return "Per match";
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
  if (customFrom.value || customTo.value) {
    eloRange.value = "custom";
  }
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
});

const activeTab = useRouteTab({
  defaultTab: "matches",
  tabs: ["matches", "tournaments"],
});

const modeTab = useRouteTab({
  param: "mode",
  defaultTab: "all",
  tabs: ["all", "Competitive", "Wingman", "Duel"],
});

const { isMobile } = useSidebar();
const playerHeroClasses =
  "relative rounded-lg border border-border px-7 py-6 [background:linear-gradient(180deg,hsl(var(--card)_/_0.55)_0%,hsl(var(--card)_/_0.25)_100%)] [backdrop-filter:blur(6px)] before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-[14px] before:w-[14px] before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-[14px] after:w-[14px] after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-[''] max-md:px-4 max-md:py-5";
const playerHeroEyebrowClasses =
  "mb-5 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground";
const playerHeroChevronClasses =
  "translate-y-[-1px] text-[0.7rem] text-[hsl(var(--tac-amber))]";
const playerHeroBodyClasses = "flex flex-wrap items-center gap-7 max-md:gap-4";
const playerHeroAvatarFrameClasses =
  "relative h-[140px] w-[140px] border border-[hsl(var(--tac-amber)_/_0.4)] bg-[hsl(var(--tac-amber)_/_0.12)] p-1 max-md:h-24 max-md:w-24";
const playerHeroAvatarClasses = "block h-full w-full object-cover";
const playerHeroAvatarPlaceholderClasses = `${playerHeroAvatarClasses} flex items-center justify-center bg-muted/20 font-sans text-[3.5rem] font-bold text-[hsl(var(--tac-amber))]`;
const playerHeroAvatarCornerClasses =
  "absolute h-3 w-3 border-[hsl(var(--tac-amber))]";
const playerHeroIdentityClasses = "flex min-w-0 flex-1 flex-col gap-[0.65rem]";
const playerHeroNameRowClasses = "flex min-w-0 flex-wrap items-center gap-3";
const playerHeroNameClasses =
  "relative m-0 min-w-0 font-sans text-[clamp(2.25rem,5vw,3.75rem)] font-bold uppercase leading-[0.9] tracking-[0.02em] [font-stretch:80%]";
const playerHeroNameMainClasses = "relative text-foreground";
const playerHeroNameGhostClasses =
  "pointer-events-none absolute left-[5px] top-[5px] right-[-5px] overflow-hidden whitespace-nowrap text-transparent select-none [-webkit-text-stroke:1px_hsl(var(--tac-amber)_/_0.35)]";
const playerHeroMetaClasses =
  "inline-flex flex-wrap items-center gap-[0.55rem] text-[0.8rem] text-muted-foreground";
const playerHeroSteamIdClasses = "font-mono tracking-[0.05em]";
const playerHeroSteamLinkClasses =
  "inline-flex items-center gap-[0.35rem] rounded border border-border bg-card/60 px-[0.55rem] py-[0.2rem] text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--tac-amber)_/_0.5)] hover:bg-[hsl(var(--tac-amber)_/_0.08)] hover:text-[hsl(var(--tac-amber))]";
const playerHeroBadgesClasses =
  "mt-[0.15rem] flex flex-wrap items-center gap-2";
const playerHeroNameEditClasses =
  "inline-flex opacity-60 transition-opacity duration-150 hover:opacity-100";
const playerHeroActionsClasses = "mt-1 flex flex-wrap items-center gap-3";
const playerHeroRoleChipClasses =
  "inline-flex items-center rounded border border-border bg-card/60 px-[0.55rem] py-[0.25rem] text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground capitalize";
const playerHeroRightActionsClasses =
  "ml-auto flex shrink-0 items-center justify-center gap-3 self-center max-md:ml-0";
const playerHeroPlayClasses =
  "group/play relative isolate inline-flex cursor-pointer items-center border font-sans text-[0.95rem] font-bold uppercase tracking-[0.18em] no-underline transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-px active:translate-y-0 py-[0.85rem] pr-[1.6rem] pl-[1.4rem] text-[hsl(0_0%_8%)] border-[hsl(var(--tac-amber))] [background:linear-gradient(135deg,hsl(36_100%_65%)_0%,hsl(var(--tac-amber))_50%,hsl(28_90%_52%)_100%)] [clip-path:polygon(12px_0,100%_0,100%_calc(100%_-_12px),calc(100%_-_12px)_100%,0_100%,0_12px)] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.4),0_6px_20px_-6px_hsl(var(--tac-amber)/0.6)] hover:shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.6),0_12px_32px_-6px_hsl(var(--tac-amber)/0.8),0_0_24px_hsl(var(--tac-amber)/0.35)]";
const playerHeroPlayInnerClasses =
  "relative z-[1] inline-flex items-center gap-[0.65rem]";
const playerHeroPlayIconClasses =
  "h-5 w-5 fill-current transition-transform duration-300 group-hover/play:translate-x-0.5 group-hover/play:scale-110";
const playerHeroPlayGlowClasses =
  "pointer-events-none absolute inset-0 z-0 -translate-x-full bg-[linear-gradient(90deg,transparent_0%,hsl(0_0%_100%_/_0.4)_50%,transparent_100%)] transition-transform duration-500 group-hover/play:translate-x-full";
const playerHeroTeamsClasses = "mt-6 border-t border-border pt-5";
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
  <div class="flex-grow flex flex-col gap-6" v-if="player">
    <!-- Player Hero -->
    <PageTransition>
      <header :class="playerHeroClasses">
        <div :class="playerHeroEyebrowClasses">
          <span :class="playerHeroChevronClasses">◢</span>
          Player Profile
        </div>

        <div :class="playerHeroBodyClasses">
          <!-- Avatar with amber ring -->
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

          <!-- Identity: name, meta row, badges -->
          <div :class="playerHeroIdentityClasses">
            <div :class="playerHeroNameRowClasses">
              <h1 :class="playerHeroNameClasses">
                <span :class="playerHeroNameGhostClasses" aria-hidden="true">
                  {{ player.name }}
                </span>
                <span :class="playerHeroNameMainClasses">{{
                  player.name
                }}</span>
              </h1>
            </div>

            <div :class="playerHeroMetaClasses">
              <TimezoneFlag
                v-if="player.country"
                :country="player.country"
                class="h-auto w-[1.35rem] shrink-0"
              />
              <span v-if="player.country" class="opacity-40">·</span>
              <span :class="playerHeroSteamIdClasses">
                {{ player.steam_id }}
              </span>
              <span v-if="player.profile_url" class="opacity-40">·</span>
              <a
                v-if="player.profile_url"
                :href="player.profile_url"
                target="_blank"
                rel="noopener noreferrer"
                :class="playerHeroSteamLinkClasses"
                :title="$t('ui.tooltips.view_steam_profile')"
              >
                <ExternalLink class="w-3.5 h-3.5" />
                <span>{{ $t("player.player.steam") }}</span>
              </a>
              <PlayerElo
                v-if="player.elo"
                :elo="player.elo"
                :peak="player.peak_elo"
              />
            </div>

            <!-- Actions: role / sanction / edit -->
            <div
              v-if="player.role || canSanction || canEditPlayer"
              :class="playerHeroActionsClasses"
            >
              <PlayerRoleForm v-if="canEditRole" :player="player" />
              <span v-else-if="player.role" :class="playerHeroRoleChipClasses">
                {{ (player.role || "user").replace("_", " ") }}
              </span>
              <SanctionPlayer v-if="canSanction" :player="player" />
              <Button
                v-if="canEditPlayer"
                variant="outline"
                size="icon"
                class="h-7 w-7 [&_svg]:size-3.5"
                :title="$t('pages.players.detail.edit_player')"
                @click="editPlayerSheet = true"
              >
                <Pencil />
              </Button>
            </div>

            <div :class="playerHeroBadgesClasses">
              <PlayerSanctions v-if="playerId" :playerId="playerId" />
            </div>
          </div>

          <!-- Right-side CTA -->
          <div :class="playerHeroRightActionsClasses">
            <NuxtLink
              v-if="me && player.steam_id === me.steam_id"
              to="/play"
              :class="playerHeroPlayClasses"
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
          </div>
        </div>

        <!-- Teams row -->
        <div
          v-if="player?.teams && player.teams.length > 0"
          :class="playerHeroTeamsClasses"
        >
          <div :class="playerTeamsLabelClasses">
            <span :class="playerTeamsTickClasses"></span>
            Teams
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
      </header>
    </PageTransition>

    <!-- Trophy Case -->
    <PageTransition
      :delay="50"
      v-if="playerTrophies && playerTrophies.length > 0"
    >
      <TrophyCase :trophies="playerTrophies" />
    </PageTransition>

    <PageTransition :delay="75" v-if="playerId">
      <PlayerHighlights :steam-id="playerId" />
    </PageTransition>

    <div class="flex flex-col gap-4 md:gap-6" v-if="player">
      <!-- Mode selector -->
      <Tabs v-model="modeTab">
        <TabsList class="grid grid-cols-4 w-full max-w-md mx-auto">
          <TabsTrigger value="all">{{
            $t("pages.leaderboard.match_types.all")
          }}</TabsTrigger>
          <TabsTrigger value="Competitive">{{
            $t("pages.leaderboard.match_types.competitive")
          }}</TabsTrigger>
          <TabsTrigger value="Wingman">{{
            $t("pages.leaderboard.match_types.wingman")
          }}</TabsTrigger>
          <TabsTrigger value="Duel">{{
            $t("pages.leaderboard.match_types.duel")
          }}</TabsTrigger>
        </TabsList>
      </Tabs>

      <!-- Global time-range bar — drives the stats strip inside the ELO
           History card and the windowed values in the Win Rate / K/D card.
           Cog opens a popover with custom range, lifetime compare, and
           tournament filtering. -->
      <div
        class="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 [backdrop-filter:blur(6px)]"
      >
        <span
          class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
        >
          Range
        </span>
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            v-for="r in presetRanges"
            :key="r.key"
            type="button"
            class="rounded border px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] transition-colors"
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
            class="rounded border border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.16)] px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
          >
            {{ activeRangeLabel }}
          </span>
        </div>
        <span
          class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
        >
          <template v-if="eloHistoryLoading && eloHistory.length === 0">
            Loading…
          </template>
          <template v-else>
            {{ windowedStats.total.toLocaleString() }} matches
            <template v-if="excludeTournaments"> · No tournaments</template>
            <template v-if="selectedModeRef !== 'all'">
              · {{ selectedModeRef }}
            </template>
          </template>
        </span>
        <div class="ml-auto flex items-center gap-2">
          <span
            v-if="compareLifetime"
            class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
          >
            vs Lifetime
          </span>
          <Popover v-model:open="settingsOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded border border-border/60 bg-card/40 text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:text-[hsl(var(--tac-amber))]"
                :title="
                  $t('pages.players.detail.range_settings', 'Range settings')
                "
              >
                <Settings2 class="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" class="w-80 space-y-4">
              <div class="space-y-2">
                <div
                  class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
                >
                  Custom Range
                </div>
                <div class="flex items-center gap-2">
                  <input
                    v-model="customFrom"
                    type="date"
                    class="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                    :max="customTo || undefined"
                    @change="applyCustomRange"
                  />
                  <span class="text-muted-foreground text-xs">→</span>
                  <input
                    v-model="customTo"
                    type="date"
                    class="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                    :min="customFrom || undefined"
                    @change="applyCustomRange"
                  />
                </div>
                <p
                  v-if="eloRange === 'custom'"
                  class="text-[0.65rem] text-muted-foreground"
                >
                  Custom window active. Choosing a preset clears it.
                </p>
              </div>
              <label
                class="flex items-start gap-2 cursor-pointer rounded p-1 -mx-1 hover:bg-muted/40"
              >
                <Checkbox
                  :model-value="compareLifetime"
                  @update:model-value="(v) => (compareLifetime = !!v)"
                  class="mt-0.5"
                />
                <div class="flex-1">
                  <div class="text-sm font-medium">Compare vs lifetime</div>
                  <div class="text-[0.65rem] text-muted-foreground">
                    Show lifetime totals alongside the window.
                  </div>
                </div>
              </label>
              <label
                class="flex items-start gap-2 cursor-pointer rounded p-1 -mx-1 hover:bg-muted/40"
              >
                <Checkbox
                  :model-value="excludeTournaments"
                  @update:model-value="(v) => (excludeTournaments = !!v)"
                  class="mt-0.5"
                />
                <div class="flex-1">
                  <div class="text-sm font-medium">Exclude tournaments</div>
                  <div class="text-[0.65rem] text-muted-foreground">
                    Skip tournament matches in stats and chart.
                  </div>
                </div>
              </label>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <!-- Stats and Elo Section -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <!-- Performance Stats -->
        <PageTransition :delay="100">
          <AnimatedCard variant="elevated" class="flex flex-col h-full p-4">
            <CardContent class="flex-1 p-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                <!-- Win Rate Column — driven by the windowed v_player_elo
                     subscription so it reflects the active time range. -->
                <div class="flex flex-col items-center justify-center gap-4">
                  <span
                    class="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70"
                    aria-hidden="true"
                  >
                    {{ activeRangeLabel }}
                  </span>
                  <RadialStat
                    :value="windowedStats.winPct.toFixed(0) + '%'"
                    :percentage="windowedStats.winPct"
                    :label="$t('common.stats.win_rate')"
                    :stroke-color="
                      windowedStats.winPct >= 50
                        ? 'hsl(142, 71%, 45%)'
                        : 'hsl(0, 84%, 60%)'
                    "
                  />
                  <div class="flex items-center gap-4">
                    <div class="flex flex-col items-center group/stat">
                      <span
                        class="text-xl md:text-lg lg:text-2xl font-bold text-green-500 group-hover/stat:scale-110 transition-transform duration-300"
                        >{{ windowedStats.wins }}</span
                      >
                      <span
                        class="text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider"
                        >{{ $t("common.stats.wins") }}</span
                      >
                    </div>
                    <div
                      class="w-px h-6 sm:h-8 bg-gradient-to-b from-transparent via-border to-transparent"
                    ></div>
                    <div class="flex flex-col items-center group/stat">
                      <span
                        class="text-xl md:text-lg lg:text-2xl font-bold text-red-500 group-hover/stat:scale-110 transition-transform duration-300"
                        >{{ windowedStats.losses }}</span
                      >
                      <span
                        class="text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider"
                        >{{ $t("common.stats.losses") }}</span
                      >
                    </div>
                  </div>
                  <div
                    v-if="compareLifetime"
                    class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground text-center"
                  >
                    Lifetime
                    <span class="text-green-500">{{ selectedWins }}W</span>
                    ·
                    <span class="text-red-500">{{ selectedLosses }}L</span>
                  </div>
                </div>

                <!-- K/D Column — windowed kills/deaths/assists from
                     v_player_elo. HS% stays lifetime since it's not in the
                     time-series view; labelled accordingly. -->
                <div class="flex flex-col items-center justify-center gap-4">
                  <span
                    class="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70"
                    aria-hidden="true"
                  >
                    {{ activeRangeLabel }}
                  </span>
                  <RadialStat
                    :value="windowedStats.kd.toFixed(2)"
                    :percentage="windowedStats.kdPct"
                    :label="$t('pages.players.detail.kd')"
                    :stroke-color="kdrStrokeColor(windowedStats.kd)"
                  />
                  <div
                    class="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-2 gap-y-3"
                  >
                    <div class="flex flex-col items-center group/stat">
                      <span
                        class="text-lg md:text-base lg:text-xl font-bold text-foreground group-hover/stat:scale-110 transition-transform duration-300"
                      >
                        {{ windowedStats.kills.toLocaleString() }}
                      </span>
                      <span
                        class="text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider"
                        >{{ $t("common.stats.kills") }}</span
                      >
                    </div>
                    <div
                      class="w-px h-6 sm:h-8 bg-gradient-to-b from-transparent via-border to-transparent"
                    ></div>
                    <div class="flex flex-col items-center group/stat">
                      <span
                        class="text-lg md:text-base lg:text-xl font-bold text-foreground group-hover/stat:scale-110 transition-transform duration-300"
                      >
                        {{ windowedStats.assists.toLocaleString() }}
                      </span>
                      <span
                        class="text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider"
                        >{{ $t("common.stats.assists") }}</span
                      >
                    </div>
                    <div
                      class="w-px h-6 sm:h-8 bg-gradient-to-b from-transparent via-border to-transparent"
                    ></div>
                    <div
                      class="flex flex-col items-center group/stat"
                      :title="
                        $t(
                          'pages.players.detail.hs_lifetime',
                          'Headshot % is lifetime',
                        )
                      "
                    >
                      <span
                        class="text-lg md:text-base lg:text-xl font-bold text-primary group-hover/stat:scale-110 transition-transform duration-300"
                      >
                        {{
                          player?.stats?.headshot_percentage
                            ? (player.stats.headshot_percentage * 100).toFixed(
                                1,
                              ) + "%"
                            : "—"
                        }}
                      </span>
                      <span
                        class="text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider"
                      >
                        {{ $t("pages.players.filter_chips.headshot_pct") }}*
                      </span>
                    </div>
                  </div>
                  <div
                    v-if="compareLifetime && player?.stats"
                    class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground text-center"
                  >
                    Lifetime K/D
                    <span class="text-foreground">{{ kd }}</span>
                    · {{ player.stats.kills?.toLocaleString() ?? "—" }} K /
                    {{ player.stats.deaths?.toLocaleString() ?? "—" }} D
                  </div>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>
        </PageTransition>

        <!-- Elo History Chart — matches the other panels' chrome: plain
             AnimatedCard, centered CardHeader title + subtitle, no extra
             card-level backgrounds or corner accents. The chart well
             keeps its inner frame + registration ticks + faint grid, and
             the Peak cell keeps its amber rail — those are the per-data
             accents, not card chrome. -->
        <PageTransition :delay="200">
          <AnimatedCard
            variant="elevated"
            class="relative flex flex-col h-full p-4"
          >
            <!-- No title bar — the strip's "Current ELO" cell carries
                 the card's identity. Maximize lives in the top-right
                 corner as a floating affordance instead. -->
            <button
              type="button"
              class="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded border border-border/60 bg-card/60 text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:text-[hsl(var(--tac-amber))]"
              :title="
                $t(
                  'pages.players.detail.view_full_elo_history',
                  'View full ELO history',
                )
              "
              @click="eloDialogOpen = true"
            >
              <Maximize2 class="h-3.5 w-3.5" />
            </button>
            <CardContent class="flex flex-1 flex-col gap-3 p-0">
              <!-- Stats strip — two cells now (Current ELO + Peak/Lowest).
                   Matches/W/L lives in the Win Rate card next door so we
                   don't repeat it here. Peak gets a vertical amber rail. -->
              <div
                class="grid grid-cols-1 divide-y divide-border/40 overflow-hidden rounded-md border border-border/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0"
              >
                <!-- Headline metric — Current ELO. Much larger typography
                     than the supporting Peak / Lowest cell so the user
                     reads it first; this is "the point" of the chart. -->
                <div class="relative min-h-[88px] px-4 py-3 pr-12">
                  <div
                    class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground"
                  >
                    Current ELO
                  </div>
                  <div
                    class="mt-1 text-3xl font-bold leading-none tabular-nums tracking-tight sm:text-4xl"
                  >
                    {{ fmtRangeStat(windowedStats.current) }}
                  </div>
                  <div
                    v-if="
                      compareLifetime &&
                      player?.elo &&
                      selectedModeRef !== 'all'
                    "
                    class="mt-0.5 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Lifetime
                    {{
                      fmtRangeStat(
                        player.elo[selectedModeRef.toLowerCase()] ?? null,
                      )
                    }}
                  </div>
                </div>

                <div class="relative min-h-[88px] px-4 py-3 sm:pl-5">
                  <!-- Amber rail anchoring the headline metric -->
                  <span
                    class="pointer-events-none absolute left-0 top-3 bottom-3 hidden w-[2px] bg-[hsl(var(--tac-amber))] sm:block"
                    aria-hidden="true"
                  ></span>
                  <div
                    class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground"
                  >
                    Peak / Lowest
                  </div>
                  <div class="mt-1 flex items-baseline gap-2.5">
                    <span
                      class="text-xl font-bold tabular-nums text-[hsl(var(--tac-amber))] [text-shadow:0_0_18px_hsl(var(--tac-amber)/0.35)]"
                    >
                      {{ fmtRangeStat(windowedStats.peak) }}
                    </span>
                    <span
                      class="font-mono text-[hsl(var(--tac-amber)/0.35)]"
                      aria-hidden="true"
                      >/</span
                    >
                    <span
                      class="text-base font-semibold tabular-nums text-muted-foreground/80"
                    >
                      {{ fmtRangeStat(windowedStats.lowest) }}
                    </span>
                  </div>
                  <!-- Date row is ALWAYS rendered (placeholder when no
                       peakEntry yet) so the cell height never changes
                       between empty/loaded states. -->
                  <div
                    class="mt-0.5 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    <template v-if="windowedStats.peakEntry">
                      Peak
                      {{
                        fmtDateShort(windowedStats.peakEntry.match_created_at)
                      }}
                    </template>
                    <template v-else>&nbsp;</template>
                  </div>
                  <div
                    v-if="
                      compareLifetime &&
                      player?.peak_elo &&
                      selectedModeRef !== 'all'
                    "
                    class="mt-0.5 font-mono text-[0.5rem] uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    Lifetime Peak
                    {{
                      fmtRangeStat(
                        player.peak_elo[selectedModeRef.toLowerCase()] ?? null,
                      )
                    }}
                  </div>
                </div>
              </div>

              <!-- Chart well: fixed height (NOT min-h) so the card never
                   grows when data arrives or when the empty/loading state
                   swaps for the chart. Frame + grid stay constant; the
                   contents inside just swap. -->
              <div
                class="relative h-[260px] sm:h-[300px] overflow-hidden rounded-md border border-border/40"
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
                    Acquiring telemetry…
                  </div>
                </div>

                <PlayerEloChart
                  v-else-if="hasWindowedEloData"
                  class="relative h-full"
                  :series="windowedChartSeries"
                />

                <div
                  v-else
                  class="relative flex h-full flex-col items-center justify-center gap-2 px-6 text-center uppercase text-muted-foreground"
                >
                  <template v-if="eloRange !== 'all'">
                    <span
                      class="font-mono text-[0.65rem] tracking-[0.22em] text-muted-foreground"
                    >
                      No matches in this window
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      class="transition-transform hover:scale-105"
                      @click="setRange('all')"
                    >
                      Expand to all time
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
            </CardContent>
          </AnimatedCard>
        </PageTransition>
      </div>

      <!-- Charts Section -->
      <div
        class="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
      >
        <!-- Recent Wins/Losses -->
        <PageTransition :delay="300">
          <AnimatedCard variant="elevated" class="flex flex-col h-full p-4">
            <CardHeader>
              <CardTitle
                class="text-lg md:text-base lg:text-xl font-bold text-center"
              >
                {{ $t("pages.players.detail.recent_wins_and_losses") }}
              </CardTitle>
              <div
                class="text-center text-[9px] uppercase tracking-[0.18em] opacity-0 select-none"
                aria-hidden="true"
              >
                .
              </div>
            </CardHeader>
            <CardContent class="flex flex-col h-full">
              <LastTenWinsAndLosses
                class="max-h-[250px] sm:max-h-[300px] md:max-h-[375px] w-full flex-grow"
                :steam_id="playerId"
                :match_type="selectedMode === 'all' ? null : selectedMode"
              />
            </CardContent>
          </AnimatedCard>
        </PageTransition>

        <!-- Weapon Kills -->
        <PageTransition :delay="500">
          <AnimatedCard variant="elevated" class="flex flex-col h-full p-4">
            <CardHeader>
              <CardTitle
                class="text-lg md:text-base lg:text-xl font-bold text-center"
              >
                {{ $t("pages.players.detail.weapon_kills") }}
              </CardTitle>
              <div
                class="text-center text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70 transition-opacity duration-150"
                :class="selectedMode !== 'all' ? 'opacity-100' : 'opacity-0'"
                aria-hidden="true"
              >
                {{ $t("pages.players.detail.global_stats", "Global stats") }}
              </div>
            </CardHeader>
            <CardContent class="flex flex-col h-full">
              <div
                v-if="
                  !player?.kills_by_weapons ||
                  player.kills_by_weapons.length === 0
                "
                class="text-center py-8 flex-grow flex items-center justify-center"
              >
                <p class="text-sm md:text-base text-muted-foreground">
                  {{ $t("pages.players.detail.no_weapon_kills") }}
                </p>
              </div>
              <div v-else class="overflow-hidden rounded-lg">
                <table class="w-full border-90">
                  <tbody>
                    <tr
                      v-for="(weapon, index) in player.kills_by_weapons"
                      :key="index"
                      :style="{ animationDelay: `${index * 50}ms` }"
                      class="border-b border-border/30 hover:bg-muted/50 hover:scale-[1.02] transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 group/row"
                    >
                      <td class="p-3 flex items-center gap-3">
                        <template
                          v-if="weapon.with && weapon.with !== 'unknown'"
                        >
                          <div class="relative">
                            <img
                              :src="`/img/equipment/${getWeaponImageName(weapon.with)}.svg`"
                              :alt="weapon.with"
                              class="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 group-hover/row:scale-110 transition-transform duration-300"
                              @error="handleImageError"
                              :title="weapon.with"
                            />
                          </div>
                        </template>
                        <span v-else class="font-medium">{{
                          weapon.with
                        }}</span>
                      </td>
                      <td class="p-3 text-right">
                        <span
                          class="font-bold text-lg group-hover/row:text-primary transition-colors"
                        >
                          {{ weapon.kill_count }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </AnimatedCard>
        </PageTransition>
      </div>
    </div>

    <Separator />

    <PageTransition :delay="500">
      <Tabs v-model="activeTab" default-value="matches">
        <TabsList class="grid grid-cols-2 w-full max-w-md mx-auto">
          <TabsTrigger
            value="matches"
            class="transition-all duration-300 data-[state=active]:shadow-lg"
            >{{ $t("pages.players.detail.matches") }}</TabsTrigger
          >
          <TabsTrigger
            value="tournaments"
            class="transition-all duration-300 data-[state=active]:shadow-lg"
            >{{ $t("pages.players.detail.tournaments") }}</TabsTrigger
          >
        </TabsList>

        <TabsContent value="matches">
          <Empty v-if="playerMatchesTotal === 0" class="min-h-[200px]">
            <EmptyTitle>{{ $t("pages.players.detail.no_matches") }}</EmptyTitle>
            <EmptyDescription>
              <template v-if="eloRange !== 'all' || excludeTournaments">
                No matches in this window.
                <button
                  type="button"
                  class="ml-1 text-[hsl(var(--tac-amber))] hover:underline"
                  @click="setRange('all')"
                >
                  Expand to all time
                </button>
              </template>
              <template v-else>
                {{ $t("pages.players.detail.no_matches_description") }}
              </template>
            </EmptyDescription>
          </Empty>
          <template v-else>
            <MatchesTable :player="player" :matches="playerMatches" />
            <Pagination
              :page="matchesPage"
              :per-page="matchesPerPage"
              :total="playerMatchesTotal"
              @page="(p) => (matchesPage = p)"
            />
          </template>
        </TabsContent>

        <TabsContent value="tournaments">
          <Empty
            v-if="!playerTournaments || playerTournaments.length === 0"
            class="min-h-[200px]"
          >
            <EmptyTitle>{{
              $t("pages.players.detail.no_tournaments")
            }}</EmptyTitle>
            <EmptyDescription>{{
              $t("pages.players.detail.no_tournaments_description")
            }}</EmptyDescription>
          </Empty>
          <div v-else class="space-y-4">
            <TournamentTableRow
              v-for="tournament in playerTournaments"
              :key="tournament.id"
              :tournament="tournament"
            ></TournamentTableRow>
          </div>
        </TabsContent>
      </Tabs>
    </PageTransition>
  </div>

  <PlayerEloHistoryDialog
    v-if="playerIdRef"
    :open="eloDialogOpen"
    :player-id="playerIdRef"
    :player-name="player?.name ?? null"
    :default-mode="selectedModeRef"
    :default-range="eloRange === 'custom' ? '1y' : eloRange"
    :exclude-tournaments="excludeTournaments"
    @update:open="(o) => (eloDialogOpen = o)"
  />

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
import { e_match_types_enum, e_team_roles_enum } from "~/generated/zeus";
import { playerFields } from "~/graphql/playerFields";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";
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
              stats: {
                kills: true,
                deaths: true,
                assists: true,
                headshot_percentage: true,
              },
              kills_by_weapons: [
                {
                  order_by: [
                    {},
                    {
                      kill_count: order_by.desc,
                    },
                  ],
                  limit: 5,
                },
                {
                  with: true,
                  kill_count: true,
                },
              ],
              __alias: {
                competitive_elo_history: {
                  elo_history: [
                    {
                      limit: 10,
                      // Note: no `match: { winning_lineup_id: ... }` filter —
                      // player_elo rows are only generated for matches with a
                      // winning lineup (see generate_player_elo_for_match), so
                      // the filter is redundant and crossing the `match`
                      // relationship would cascade the matches permission
                      // filter into the subquery for no benefit.
                      where: {
                        type: {
                          _eq: e_match_types_enum.Competitive,
                        },
                      },
                      order_by: [
                        {},
                        {
                          match_created_at: order_by.desc,
                        },
                      ],
                    },
                    eloFields,
                  ],
                },
                wingman_elo_history: {
                  elo_history: [
                    {
                      limit: 10,
                      where: {
                        type: {
                          _eq: e_match_types_enum.Wingman,
                        },
                      },
                      order_by: [
                        {},
                        {
                          match_created_at: order_by.desc,
                        },
                      ],
                    },
                    eloFields,
                  ],
                },
                duel_elo_history: {
                  elo_history: [
                    {
                      limit: 10,
                      where: {
                        type: {
                          _eq: e_match_types_enum.Duel,
                        },
                      },
                      order_by: [
                        {},
                        {
                          match_created_at: order_by.desc,
                        },
                      ],
                    },
                    eloFields,
                  ],
                },
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
      playerTournaments: {
        query: typedGql("subscription")({
          tournaments: [
            {
              limit: 10,
              where: {
                rosters: {
                  player_steam_id: {
                    _eq: $("steam_id", "bigint"),
                  },
                },
              },
              order_by: [
                {},
                {
                  start: order_by.desc,
                },
              ],
            },
            simpleTournamentFields,
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
          this.playerTournaments = data.tournaments || [];
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
  unmounted() {
    usePlayerContext().value = null;
  },
  data() {
    return {
      player: undefined,
      playerTournaments: [],
      playerTrophies: undefined,
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
    };
  },
  computed: {
    selectedMode() {
      const raw = this.$route.query.mode;
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (value === "Competitive" || value === "Wingman" || value === "Duel") {
        return value;
      }
      return "all";
    },
    selectedWins() {
      if (!this.player) return 0;
      switch (this.selectedMode) {
        case "Competitive":
          return this.player.wins_competitive || 0;
        case "Wingman":
          return this.player.wins_wingman || 0;
        case "Duel":
          return this.player.wins_duel || 0;
        default:
          return this.player.wins || 0;
      }
    },
    selectedLosses() {
      if (!this.player) return 0;
      switch (this.selectedMode) {
        case "Competitive":
          return this.player.losses_competitive || 0;
        case "Wingman":
          return this.player.losses_wingman || 0;
        case "Duel":
          return this.player.losses_duel || 0;
        default:
          return this.player.losses || 0;
      }
    },
    eloChartSeries() {
      if (!this.player) return [];
      const comp = this.player.competitive_elo_history || [];
      const wing = this.player.wingman_elo_history || [];
      const duel = this.player.duel_elo_history || [];

      const compSeries = {
        key: "Competitive",
        label: this.$t("pages.leaderboard.match_types.competitive"),
        history: comp,
      };
      const wingSeries = {
        key: "Wingman",
        label: this.$t("pages.leaderboard.match_types.wingman"),
        history: wing,
      };
      const duelSeries = {
        key: "Duel",
        label: this.$t("pages.leaderboard.match_types.duel"),
        history: duel,
      };

      switch (this.selectedMode) {
        case "Competitive":
          return [{ ...compSeries, focus: true }];
        case "Wingman":
          return [{ ...wingSeries, focus: true }];
        case "Duel":
          return [{ ...duelSeries, focus: true }];
        default:
          return [
            { ...compSeries, focus: true },
            { ...wingSeries, focus: false },
            { ...duelSeries, focus: false },
          ].filter((s) => s.history.length > 0);
      }
    },
    hasEloChartData() {
      return this.eloChartSeries.some((s) => s.history.length > 0);
    },
    winPercentage() {
      const total = this.selectedWins + this.selectedLosses;
      if (!this.player) {
        return 0;
      }
      return total > 0 ? (this.selectedWins / total) * 100 : 0;
    },

    kdPercentage() {
      if (
        !this.player?.stats ||
        !this.player.stats.kills ||
        !this.player.stats.deaths
      ) {
        return 0;
      }

      const kdRatio = this.player.stats.kills / this.player.stats.deaths;
      return Math.min((kdRatio / 2) * 100, 100);
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
        useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer)
      );
    },
    isSelfProfile() {
      return !!(
        this.me &&
        this.player &&
        this.player.steam_id === this.me.steam_id
      );
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
    getWeaponImageName(weaponName) {
      if (!weaponName || weaponName === "unknown") return "";

      const overrideMappings = {};

      return overrideMappings[weaponName] || weaponName;
    },
    handleImageError(event) {
      const img = event.target;
      img.style.display = "none";
    },
  },
};
</script>
