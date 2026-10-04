<script setup lang="ts">
import { computed, onBeforeUnmount, provide, ref, toRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowRight, ChevronDown, ExternalLink, Play } from "lucide-vue-next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import { HeightGlide } from "~/components/ui/transitions";
import LineupOverview from "~/components/match/LineupOverview.vue";
import LineupUtility from "~/components/match/LineupUtility.vue";
import LineupTradeStats from "~/components/match/LineupTradeStats.vue";
import LineupAimStats from "~/components/match/LineupAimStats.vue";
import StackedTable from "~/components/common/StackedTable.vue";
import MatchRankBadge from "~/components/MatchRankBadge.vue";
import type { MatchRankMove } from "~/components/MatchRankBadge.vue";
import { provideFocusRow } from "~/composables/useCurrentUserRow";
import { tierFor, RANK_TIERS, PROVISIONAL_TIER } from "~/utils/eloTier";
import { csRankIcon } from "~/utilities/csRank";
import { dateLocale } from "~/utilities/dateLocale";
import mapLabel from "~/utilities/mapLabel";

// Inline match breakdown on the player profile: the match strip (map or
// series, score, this player's rank move) above the match page's own lineup
// tables with BOTH teams, this player's row pinned. Everything here renders
// from the one query PlayerMatchRow runs on expand.
const props = defineProps<{
  // Simple match fields, overlaid with the detailed lineups + elo_changes once
  // they load.
  match: any;
  focusSteamId: string | null;
  // A team's view: this lineup leads the table and no single row is pinned.
  focusLineupId?: string | null;
  loading: boolean;
  activeTab: string;
  selectedMapId: string | null;
  // steam_id -> per-match Valve rank, injected into PlayerDisplay like the
  // match page does.
  matchRanks: Record<string, any>;
  rankMove: MatchRankMove | null;
  seasonBest: string | null;
  score: { player: number; opponent: number };
  result: "won" | "lost" | "tied" | null;
  typeLabel: string;
  sourceLabel: string;
  clipsCount: number;
  // Narrow layout: this player's line as a list, the lobby on request.
  compact?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:active-tab", value: string): void;
  (e: "update:selected-map-id", value: string | null): void;
  (e: "open-clips"): void;
}>();

const { t } = useI18n();

provideFocusRow(toRef(props, "focusSteamId"));
provide("matchRanks", toRef(props, "matchRanks"));

const tabs = computed(() => [
  {
    value: "overview",
    label: t("match.tabs.overview"),
    component: LineupOverview,
    props: { showStats: true },
  },
  {
    value: "utility",
    label: t("match.tabs.utility"),
    component: LineupUtility,
    props: {},
  },
  {
    value: "trades",
    label: t("match.tabs.trade_stats"),
    component: LineupTradeStats,
    props: {},
  },
  {
    value: "aim",
    label: t("match.tabs.aim_stats"),
    component: LineupAimStats,
    props: {},
  },
]);

function hasFocus(lineup: any): boolean {
  const sid = props.focusSteamId;
  return (lineup?.lineup_players ?? []).some(
    (lp: any) => String(lp?.steam_id ?? lp?.player?.steam_id ?? "") === sid,
  );
}

// The focus player's side first, so their team leads the table.
const focusIsLineup2 = computed(() =>
  props.focusLineupId
    ? props.match?.lineup_2_id === props.focusLineupId
    : !hasFocus(props.match?.lineup_1) && hasFocus(props.match?.lineup_2),
);
const mineRaw = computed(() =>
  focusIsLineup2.value ? props.match?.lineup_2 : props.match?.lineup_1,
);
const theirsRaw = computed(() =>
  focusIsLineup2.value ? props.match?.lineup_1 : props.match?.lineup_2,
);

// Skeleton rows per team, from the lineups the row already carries.
const skeletonTeams = computed(() =>
  [mineRaw.value, theirsRaw.value].map(
    (lineup) => lineup?.lineup_players?.length || 5,
  ),
);

// Opened before the data: the tables fade in when they land. Opened with data:
// they rise in with the rest of the panel.
const fadeContent = props.loading;

// A load that lands fast never shows a skeleton — it would only blink. The
// placeholder holds the tables' height invisibly, fades in only once the wait
// runs past SKELETON_DELAY_MS, and once seen stays SKELETON_MIN_MS so it reads
// as a state rather than a flash.
const SKELETON_DELAY_MS = 200;
const SKELETON_MIN_MS = 350;
const skeletonShown = ref(false);
const skeletonHeld = ref(false);
let skeletonTimer: ReturnType<typeof setTimeout> | null = null;
let skeletonShownAt = 0;

watch(
  () => props.loading,
  (loading) => {
    if (skeletonTimer) clearTimeout(skeletonTimer);
    skeletonTimer = null;
    if (loading) {
      skeletonTimer = setTimeout(() => {
        skeletonShown.value = true;
        skeletonShownAt = Date.now();
      }, SKELETON_DELAY_MS);
      return;
    }
    if (!skeletonShown.value) return;
    skeletonHeld.value = true;
    skeletonTimer = setTimeout(
      () => {
        skeletonHeld.value = false;
        skeletonShown.value = false;
      },
      Math.max(0, SKELETON_MIN_MS - (Date.now() - skeletonShownAt)),
    );
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (skeletonTimer) clearTimeout(skeletonTimer);
});

const placeholder = computed(() => props.loading || skeletonHeld.value);

// Lineup tables read `match_stats ?? match_map_stats`, so a single map swaps
// the aggregate row out for that map's row (and its KAST rows).
function narrow(lineup: any) {
  if (!lineup) return null;
  const id = props.selectedMapId;
  return {
    ...lineup,
    lineup_players: (lineup.lineup_players ?? []).map((lp: any) => {
      if (!lp?.player) return lp;
      if (!id) {
        return { ...lp, player: { ...lp.player, match_map_stats: null } };
      }
      const mapRow = (lp.player.match_map_stats ?? []).find(
        (s: any) => s.match_map_id === id,
      );
      return {
        ...lp,
        player: {
          ...lp.player,
          match_stats: null,
          match_map_stats: mapRow ? [mapRow] : null,
          match_map_hltv: (lp.player.match_map_hltv ?? []).filter(
            (r: any) => r.match_map_id === id,
          ),
        },
      };
    }),
  };
}
const mine = computed(() => narrow(mineRaw.value));
const theirs = computed(() => narrow(theirsRaw.value));
// Just this player's row, for the compact list.
const focusLineup = computed(() => {
  const lineup = mine.value;
  const sid = props.focusSteamId;
  const member = (lineup?.lineup_players ?? []).find(
    (lp: any) => String(lp?.steam_id ?? lp?.player?.steam_id ?? "") === sid,
  );
  return member ? { ...lineup, lineup_players: [member] } : null;
});
const lobbySize = computed(
  () =>
    (mine.value?.lineup_players?.length ?? 0) +
    (theirs.value?.lineup_players?.length ?? 0),
);
const showLobby = ref(false);

const hasStats = computed(() =>
  (mine.value?.lineup_players ?? []).some(
    (lp: any) =>
      (lp?.player?.match_stats ?? lp?.player?.match_map_stats ?? []).length > 0,
  ),
);

const maps = computed(() =>
  (props.match?.match_maps ?? []).map((mm: any) => {
    const l1 = mm.lineup_1_score ?? 0;
    const l2 = mm.lineup_2_score ?? 0;
    const played = l1 > 0 || l2 > 0;
    const mineScore = focusIsLineup2.value ? l2 : l1;
    const theirScore = focusIsLineup2.value ? l1 : l2;
    return {
      id: mm.id,
      label: mapLabel(mm.map),
      patch: mm.map?.patch ?? null,
      poster: mm.map?.poster ?? null,
      played,
      mine: mineScore,
      theirs: theirScore,
      won: played && mineScore > theirScore,
      lost: played && mineScore < theirScore,
    };
  }),
);
const isSeries = computed(() => maps.value.length > 1);
const bestOf = computed(
  () => props.match?.options?.best_of ?? maps.value.length,
);
const focusMap = computed(
  () =>
    maps.value.find((m: any) => m.id === props.selectedMapId) ??
    maps.value[0] ??
    null,
);

function selectMap(id: string | null) {
  emit("update:selected-map-id", id);
}

const durationLabel = computed(() => {
  const start = props.match?.started_at;
  const end = props.match?.ended_at;
  if (!start || !end) return null;
  const minutes = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000,
  );
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return new Intl.NumberFormat(dateLocale(), {
    style: "unit",
    unit: "minute",
    unitDisplay: "short",
  }).format(minutes);
});

const metaLine = computed(() =>
  [props.typeLabel, props.sourceLabel, durationLabel.value]
    .filter(Boolean)
    .join(" · "),
);

const teamNames = computed(() => ({
  mine: mineRaw.value?.name ?? "",
  theirs: theirsRaw.value?.name ?? "",
}));

const scoreClass = computed(() => {
  if (props.result === "won") return "text-[hsl(142_71%_60%)]";
  if (props.result === "lost") return "text-[hsl(0_84%_66%)]";
  return "text-foreground";
});

const SKILL_RANK_TYPE = { competitive: 7, wingman: 6 } as const;

const rankLabel = computed(() => {
  switch (props.rankMove?.kind) {
    case "elo":
      return "ELO";
    case "premier":
      return t("player_match.premier");
    case "faceit":
      return "FACEIT";
    case "competitive":
      return t("player_match.competitive");
    case "wingman":
      return t("player_match.wingman");
    default:
      return "";
  }
});

const before = computed(() => {
  const move = props.rankMove;
  if (!move) return null;
  const value = move.value - move.change;
  if (move.kind === "competitive" || move.kind === "wingman") {
    return {
      icon: csRankIcon(SKILL_RANK_TYPE[move.kind], value),
      text: null,
    };
  }
  return { icon: null, text: value.toLocaleString() };
});

// 5Stack ELO only: how far into the tier this match left them.
const tierProgress = computed(() => {
  const move = props.rankMove;
  if (move?.kind !== "elo") return null;
  const tier = tierFor(move.value);
  const provisional = tier === PROVISIONAL_TIER;
  const next = provisional
    ? (RANK_TIERS.at(-1) ?? null)
    : (RANK_TIERS[RANK_TIERS.indexOf(tier) - 1] ?? null);
  if (!next) return null;
  const span = next.threshold - tier.threshold;
  return {
    rgb: tier.rgb,
    pct: provisional
      ? null
      : Math.max(
          4,
          Math.min(100, ((move.value - tier.threshold) / span) * 100),
        ),
    text: t("player_match.to_next", {
      points: (next.threshold - move.value).toLocaleString(),
      tier: next.label,
    }),
  };
});

const triggerClasses =
  "relative z-[1] rounded-md px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors duration-150 hover:text-foreground data-[state=active]:text-[hsl(var(--tac-amber))]";

const mapChipBase =
  "inline-flex h-8 items-center gap-2 rounded-md border px-2.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] transition-colors";
const mapChipOn =
  "border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]";
const mapChipOff =
  "border-border bg-muted/30 text-muted-foreground hover:text-foreground";

const actionClasses =
  "inline-flex h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-muted/40 px-3 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-foreground/80 transition-colors hover:border-[hsl(var(--tac-amber)/0.55)] hover:bg-background hover:text-[hsl(var(--tac-amber))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.6)]";
</script>

<template>
  <div class="space-y-3">
    <!-- MATCH STRIP — map (or series), score, and this player's rank move. -->
    <div
      class="sb-rise relative overflow-hidden rounded-lg border border-border bg-[hsl(240_8%_6%)]"
    >
      <img
        v-if="focusMap?.poster"
        :src="focusMap.poster"
        alt=""
        class="pointer-events-none absolute inset-y-0 right-0 h-full w-3/5 object-cover opacity-20 [mask-image:linear-gradient(90deg,transparent,#000_55%)]"
      />
      <div
        class="relative grid items-center gap-x-6 gap-y-3 px-4 py-3.5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
      >
        <div class="flex min-w-0 items-center gap-3">
          <img
            v-if="!isSeries && focusMap?.patch"
            :src="focusMap.patch"
            alt=""
            class="h-9 w-9 shrink-0"
          />
          <div class="min-w-0">
            <div class="truncate text-base font-bold tracking-[0.02em]">
              {{
                isSeries
                  ? $t("match.options.best_of.option", { count: bestOf })
                  : focusMap?.label
              }}
            </div>
            <div
              class="truncate font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              {{ metaLine }}
            </div>
          </div>
        </div>

        <div class="flex items-center justify-center gap-3.5">
          <span
            class="max-w-[10rem] truncate text-right text-sm font-semibold text-foreground/90"
            >{{ teamNames.mine }}</span
          >
          <span
            class="font-mono text-3xl font-extrabold leading-none tabular-nums"
            :class="scoreClass"
            >{{ score.player }}</span
          >
          <span class="font-mono text-xl text-muted-foreground/40">:</span>
          <span
            class="font-mono text-3xl font-extrabold leading-none tabular-nums text-muted-foreground"
            >{{ score.opponent }}</span
          >
          <span
            class="max-w-[10rem] truncate text-sm font-semibold text-foreground/90"
            >{{ teamNames.theirs }}</span
          >
        </div>

        <div v-if="rankMove" class="flex flex-col gap-2 lg:items-end">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80"
              >{{ rankLabel }}</span
            >
            <img
              v-if="before?.icon"
              :src="before.icon"
              alt=""
              class="h-5 w-auto opacity-70"
            />
            <span
              v-else-if="before?.text"
              class="font-mono text-xs tabular-nums text-muted-foreground"
              >{{ before.text }}</span
            >
            <ArrowRight class="h-3.5 w-3.5 text-muted-foreground/50" />
            <MatchRankBadge
              :kind="rankMove.kind"
              :value="rankMove.value"
              :change="rankMove.change"
              :faceit-level="rankMove.faceitLevel"
              :elo-change="rankMove.eloChange"
            />
          </div>
          <div v-if="tierProgress" class="flex items-center gap-2">
            <span
              v-if="tierProgress.pct !== null"
              class="relative h-[3px] w-28 overflow-hidden rounded-full bg-foreground/[0.06]"
            >
              <span
                class="absolute inset-y-0 left-0 rounded-full"
                :style="{
                  width: `${tierProgress.pct}%`,
                  background: `rgb(${tierProgress.rgb})`,
                }"
              />
            </span>
            <span
              class="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
              >{{ tierProgress.text }}</span
            >
          </div>
          <span
            v-if="seasonBest"
            class="inline-flex items-center gap-1.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
          >
            <span
              class="h-1.5 w-1.5 rounded-[1px] bg-[hsl(var(--tac-amber))]"
              aria-hidden="true"
            />
            {{ $t("player_match.season_best", { season: seasonBest }) }}
          </span>
        </div>
      </div>

      <!-- SERIES — every map in the series doubles as the stat filter. -->
      <div
        v-if="isSeries"
        class="relative flex flex-wrap items-center gap-1.5 border-t border-border/60 bg-background/40 px-4 py-2.5"
      >
        <button
          type="button"
          :class="[
            mapChipBase,
            selectedMapId === null ? mapChipOn : mapChipOff,
          ]"
          @click.stop="selectMap(null)"
        >
          {{ $t("match.player_details_panel.all_maps") }}
        </button>
        <button
          v-for="m in maps"
          :key="m.id"
          type="button"
          :disabled="!m.played"
          :title="
            m.played ? m.label : $t('match.player_details_panel.map_not_played')
          "
          :class="[
            mapChipBase,
            !m.played
              ? 'cursor-not-allowed border-border/40 bg-muted/10 text-muted-foreground/40'
              : selectedMapId === m.id
                ? mapChipOn
                : mapChipOff,
          ]"
          @click.stop="selectMap(selectedMapId === m.id ? null : m.id)"
        >
          <img
            v-if="m.patch"
            :src="m.patch"
            alt=""
            class="h-4 w-4"
            :class="{ 'opacity-40 grayscale': !m.played }"
          />
          <span>{{ m.label }}</span>
          <span v-if="m.played" class="tabular-nums">
            <span
              :class="
                m.won
                  ? 'text-[hsl(142_71%_60%)]'
                  : m.lost
                    ? 'text-[hsl(0_84%_66%)]'
                    : ''
              "
              >{{ m.mine }}</span
            ><span class="opacity-50">:</span>{{ m.theirs }}
          </span>
          <span v-else>—</span>
        </button>
      </div>
    </div>

    <!-- Glides to whatever the body becomes (skeleton → tables, tab → tab)
         instead of jumping; the skeleton is shaped like both teams' table so
         a late arrival barely moves. -->
    <HeightGlide class="sb-rise sb-rise-2">
      <div
        v-if="placeholder"
        class="space-y-2 transition-opacity duration-200"
        :class="skeletonShown ? 'opacity-100' : 'opacity-0'"
        aria-busy="true"
      >
        <Skeleton class="h-7 w-72" />
        <div
          v-for="(rows, team) in skeletonTeams"
          :key="team"
          class="space-y-px overflow-hidden rounded-md"
        >
          <Skeleton class="h-12 w-full rounded-none opacity-60" />
          <Skeleton
            v-for="row in rows"
            :key="row"
            class="h-[66px] w-full rounded-none"
          />
        </div>
      </div>

      <div
        v-else-if="!hasStats"
        class="py-6 text-center text-xs text-muted-foreground"
      >
        {{ $t("match.player_details_panel.stats_unavailable") }}
      </div>

      <div v-else :class="fadeContent && 'sb-fade'">
        <Tabs
          :model-value="activeTab"
          @update:model-value="(v) => emit('update:active-tab', v as string)"
        >
          <TabsList
            class="inline-flex h-auto items-center gap-1 bg-transparent p-0"
          >
            <TabsTrigger
              v-for="tab in tabs"
              :key="tab.value"
              :value="tab.value"
              :class="triggerClasses"
            >
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            v-for="tab in tabs"
            :key="tab.value"
            :value="tab.value"
            class="tab-panel-in pt-2"
          >
            <template v-if="compact && focusLineup">
              <div
                class="overflow-hidden rounded-md border border-border bg-card"
              >
                <LineupUtility
                  v-if="tab.value === 'utility'"
                  :match="match"
                  :lineup="focusLineup"
                  stacked
                />
                <StackedTable v-else>
                  <component
                    :is="tab.component"
                    :match="match"
                    :lineup="focusLineup"
                    hide-member
                    v-bind="tab.props"
                  />
                </StackedTable>
              </div>
              <div v-if="showLobby" class="mt-3 overflow-x-auto">
                <component
                  :is="tab.component"
                  :match="match"
                  :lineup="mine"
                  :combine-with="theirs"
                  v-bind="tab.props"
                />
              </div>
            </template>
            <div v-else class="overflow-x-auto">
              <component
                :is="tab.component"
                :match="match"
                :lineup="mine"
                :combine-with="theirs"
                v-bind="tab.props"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </HeightGlide>

    <div class="sb-rise sb-rise-3 flex flex-wrap gap-2">
      <button
        v-if="compact && focusLineup && hasStats && !placeholder"
        type="button"
        :class="[actionClasses, 'basis-full']"
        :aria-expanded="showLobby"
        @click.stop="showLobby = !showLobby"
      >
        <ChevronDown
          class="h-3.5 w-3.5 transition-transform [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
          :class="{ 'rotate-180': showLobby }"
        />
        {{
          showLobby
            ? $t("player_match.hide_lobby")
            : $t("player_match.show_lobby", { count: lobbySize })
        }}
      </button>
      <button
        v-if="clipsCount > 0"
        type="button"
        :class="actionClasses"
        @click.stop="emit('open-clips')"
      >
        <Play class="h-3 w-3 fill-current" />
        {{ $t("common.highlights") }} · {{ clipsCount }}
      </button>
      <NuxtLink :to="`/matches/${match.id}`" :class="actionClasses" @click.stop>
        <ExternalLink class="h-3.5 w-3.5" />
        {{ $t("match.open_match") }}
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
/* Opening: strip, tables and actions rise in on a short stagger. Opacity and
   transform only, so it stays smooth while the lobby table mounts. */
.sb-rise {
  animation: sb-rise 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.sb-rise-2 {
  animation-delay: 0.06s;
}
.sb-rise-3 {
  animation-delay: 0.12s;
}
@keyframes sb-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
/* Tables that arrive after the skeleton just fade over its spot; the
   HeightGlide around them absorbs any height difference. */
.sb-fade {
  animation: sb-fade 0.18s ease-out both;
}
@keyframes sb-fade {
  from {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sb-rise,
  .sb-fade {
    animation: none;
  }
}
</style>
