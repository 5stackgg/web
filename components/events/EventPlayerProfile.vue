<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { ExternalLink, X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import EventPlayerPicker from "~/components/events/EventPlayerPicker.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import MatchesTable from "~/components/MatchesTable.vue";
import HighlightCard from "~/components/clips/HighlightCard.vue";
import { usePlayerCompareTarget } from "~/composables/usePlayerCompareTarget";
import type { Clip } from "~/types/clip";
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { matchClipFields } from "~/graphql/matchClip";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalTabsListClasses,
  tacticalTabsTriggerClasses,
} from "~/utilities/tacticalClasses";

// Embeddable event-scoped dossier: sub-tabs (Stats / Matches / Career) plus an
// inline "compare with" selector that mirrors event stats side-by-side and
// overlays the career charts (reusing the player page's compare machinery).
// Module-level cache of fetched profiles keyed by event+player, so clicking
// around the leaderboard re-renders a previously-viewed player instantly (no
// skeleton/flash). A background refetch keeps the cache fresh.
const profileCache = new Map<
  string,
  { stats: any; adr: number | null; matches: any[]; clips: any[] }
>();

const props = defineProps<{
  eventId: string;
  steamId: string;
  name: string;
  avatarUrl?: string | null;
  country?: string | null;
  rank?: number | null;
  // Hide the identity header when the parent row already shows it.
  compact?: boolean;
}>();

const STATS_QUERY = typedGql("query")({
  v_event_player_stats: [
    {
      where: {
        event_id: { _eq: $("eventId", "uuid!") },
        player_steam_id: { _eq: $("steamId", "bigint!") },
      },
    },
    {
      kills: true,
      deaths: true,
      assists: true,
      headshots: true,
      matches_played: true,
      kdr: true,
      headshot_percentage: true,
    },
  ],
  get_event_leaderboard: [
    {
      args: {
        _event_id: $("eventId", "uuid!"),
        _category: "adr",
        _match_type: null,
        _min_rounds: 0,
      },
      where: { player_steam_id: { _eq: $("steamIdText", "String!") } },
    },
    { player_steam_id: true, value: true },
  ],
});

const PLAYER_MATCHES_QUERY = typedGql("query")({
  event_match_links: [
    {
      where: {
        event_id: { _eq: $("eventId", "uuid!") },
        match: {
          _or: [
            {
              lineup_1: {
                _or: [
                  {
                    lineup_players: {
                      steam_id: { _eq: $("steamId", "bigint!") },
                    },
                  },
                  { coach_steam_id: { _eq: $("steamId", "bigint!") } },
                ],
              },
            },
            {
              lineup_2: {
                _or: [
                  {
                    lineup_players: {
                      steam_id: { _eq: $("steamId", "bigint!") },
                    },
                  },
                  { coach_steam_id: { _eq: $("steamId", "bigint!") } },
                ],
              },
            },
          ],
        },
      },
      order_by: [{ match: { created_at: order_by.desc } }],
      limit: 50,
    },
    { match_id: true, match: simpleMatchFields },
  ],
});

const CLIPS_QUERY = typedGql("query")({
  match_clips: [
    {
      where: {
        visibility: { _eq: "public" },
        target_steam_id: { _eq: $("steamId", "bigint!") },
        match_map: { match_id: { _in: $("matchIds", "[uuid!]!") } },
      },
      order_by: [{ views_count: order_by.desc_nulls_last }],
      limit: 6,
    },
    matchClipFields,
  ],
});

const { client: apolloClient } = useApolloClient();
const { setCompareTarget, clearCompareTarget } = usePlayerCompareTarget();

const tab = ref<"stats" | "matches">("stats");

// Tracks the in-flight fetch; the layout stays mounted (tiles show "-", the
// radar is empty) so there is never a skeleton→content swap to flash.
const loading = ref(true);
const stats = ref<any | null>(null);
const adr = ref<number | null>(null);
const matches = ref<any[]>([]);
const clips = ref<Clip[]>([]);

// Compare: a player picked from ALL event participants.
const comparePlayer = ref<any | null>(null);
const compareSteamId = computed(() =>
  comparePlayer.value ? String(comparePlayer.value.steam_id) : "",
);
const compareStats = ref<any | null>(null);
const compareAdr = ref<number | null>(null);

function pickCompare(player: any) {
  comparePlayer.value = player;
}
function clearCompare() {
  comparePlayer.value = null;
}

async function fetchStats(steamId: string) {
  const { data } = await apolloClient.query({
    query: STATS_QUERY,
    variables: {
      eventId: props.eventId,
      steamId,
      steamIdText: String(steamId),
    },
    fetchPolicy: "network-only",
  });
  const row = (data as any)?.v_event_player_stats?.[0] ?? null;
  const adrRow = (data as any)?.get_event_leaderboard?.[0];
  return { row, adr: adrRow ? Number(adrRow.value) : null };
}

let generation = 0;

async function loadProfile(steamId: string, gen: number) {
  const [statsResult, matchesResult] = await Promise.all([
    fetchStats(steamId),
    apolloClient.query({
      query: PLAYER_MATCHES_QUERY,
      variables: { eventId: props.eventId, steamId },
      fetchPolicy: "network-only",
    }),
  ]);
  if (gen !== generation) return null;
  const nextMatches = ((matchesResult.data as any)?.event_match_links || [])
    .map((link: any) => link.match)
    .filter(Boolean);
  let nextClips: any[] = [];
  const matchIds = nextMatches.map((match: any) => match.id);
  if (matchIds.length > 0) {
    const clipsResult = await apolloClient.query({
      query: CLIPS_QUERY,
      variables: { steamId, matchIds },
      fetchPolicy: "network-only",
    });
    if (gen !== generation) return null;
    nextClips = ((clipsResult.data as any)?.match_clips ?? []) as any[];
  }
  return {
    stats: statsResult.row,
    adr: statsResult.adr,
    matches: nextMatches,
    clips: nextClips,
  };
}

function applyProfile(data: {
  stats: any;
  adr: number | null;
  matches: any[];
  clips: any[];
}) {
  stats.value = data.stats;
  adr.value = data.adr;
  matches.value = data.matches;
  clips.value = data.clips as Clip[];
}

watch(
  () => props.steamId,
  async (steamId) => {
    if (!steamId) return;
    // Reset compare when the focused player changes.
    comparePlayer.value = null;
    clearCompareTarget();
    const gen = ++generation;
    const cacheKey = `${props.eventId}:${steamId}`;
    const cached = profileCache.get(cacheKey);

    if (cached) {
      // Instant render from cache (no skeleton), then refresh in the
      // background so revisiting a player never flashes.
      applyProfile(cached);
      loading.value = false;
      try {
        const fresh = await loadProfile(steamId, gen);
        if (fresh && gen === generation) {
          profileCache.set(cacheKey, fresh);
          applyProfile(fresh);
        }
      } catch (error) {
        console.error("Error refreshing event player profile:", error);
      }
      return;
    }

    loading.value = true;
    stats.value = null;
    adr.value = null;
    matches.value = [];
    clips.value = [];
    try {
      const data = await loadProfile(steamId, gen);
      if (data && gen === generation) {
        profileCache.set(cacheKey, data);
        applyProfile(data);
      }
    } catch (error) {
      if (gen === generation) {
        console.error("Error fetching event player profile:", error);
      }
    } finally {
      if (gen === generation) {
        loading.value = false;
      }
    }
  },
  { immediate: true },
);

// When a compare target is picked: fetch its event stats and drive the shared
// career-compare overlay used by the player-page charts.
watch(comparePlayer, async (target) => {
  if (!target) {
    compareStats.value = null;
    compareAdr.value = null;
    clearCompareTarget();
    return;
  }
  setCompareTarget({
    steam_id: String(target.steam_id),
    name: target.name,
    avatar_url: target.avatar_url ?? undefined,
  });
  try {
    const result = await fetchStats(String(target.steam_id));
    compareStats.value = result.row;
    compareAdr.value = result.adr;
  } catch (error) {
    console.error("Error fetching compare stats:", error);
  }
});

onBeforeUnmount(clearCompareTarget);

function formatNumber(value: unknown, digits = 0): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return digits > 0 ? num.toFixed(digits) : Math.round(num).toLocaleString();
}

function tilesFor(row: any, adrValue: number | null) {
  return [
    { key: "kills", value: formatNumber(row?.kills), raw: Number(row?.kills) },
    {
      key: "deaths",
      value: formatNumber(row?.deaths),
      raw: Number(row?.deaths),
      lower: true,
    },
    {
      key: "assists",
      value: formatNumber(row?.assists),
      raw: Number(row?.assists),
    },
    { key: "kdr", value: formatNumber(row?.kdr, 2), raw: Number(row?.kdr) },
    {
      key: "adr",
      value: adrValue !== null ? formatNumber(adrValue, 1) : "-",
      raw: adrValue ?? -1,
    },
    {
      key: "hs",
      value:
        row?.headshot_percentage != null
          ? `${formatNumber(row.headshot_percentage, 1)}%`
          : "-",
      raw: Number(row?.headshot_percentage),
    },
    {
      key: "matches",
      value: formatNumber(row?.matches_played),
      raw: Number(row?.matches_played),
    },
  ];
}

// Event-scoped performance radar built from the event stats (per-match
// frags, K/D, ADR, HS%, per-match assists) against sensible CS2 caps — a
// self-contained graph, no career data, works in single + compare.
const RADAR_AXES = [
  {
    key: "frags",
    cap: 28,
    get: (row: any) =>
      (Number(row?.kills) || 0) / Math.max(1, Number(row?.matches_played) || 1),
  },
  { key: "kd", cap: 2, get: (row: any) => Number(row?.kdr) || 0 },
  { key: "adr", cap: 120, get: (_row: any, a: number | null) => a ?? 0 },
  {
    key: "hs",
    cap: 100,
    get: (row: any) => Number(row?.headshot_percentage) || 0,
  },
  {
    key: "assist",
    cap: 8,
    get: (row: any) =>
      (Number(row?.assists) || 0) /
      Math.max(1, Number(row?.matches_played) || 1),
  },
];

const RADAR = { cx: 100, cy: 92, r: 66, n: RADAR_AXES.length };

function radarNorms(row: any, a: number | null): number[] {
  return RADAR_AXES.map((ax) =>
    Math.max(0, Math.min(1, ax.get(row, a) / ax.cap)),
  );
}
function radarPoint(i: number, v: number): [number, number] {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / RADAR.n;
  return [
    RADAR.cx + Math.cos(ang) * RADAR.r * v,
    RADAR.cy + Math.sin(ang) * RADAR.r * v,
  ];
}
function radarPolygon(norms: number[]): string {
  return norms.map((v, i) => radarPoint(i, v).join(",")).join(" ");
}
const radarRings = [1, 0.66, 0.33].map((k) =>
  RADAR_AXES.map((_, i) => radarPoint(i, k).join(",")).join(" "),
);
const radarLabels = RADAR_AXES.map((ax, i) => {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / RADAR.n;
  return {
    key: ax.key,
    x: RADAR.cx + Math.cos(ang) * (RADAR.r + 13),
    y: RADAR.cy + Math.sin(ang) * (RADAR.r + 13) + 3,
  };
});
const radarPolyA = computed(() =>
  stats.value ? radarPolygon(radarNorms(stats.value, adr.value)) : "",
);
const radarPolyB = computed(() =>
  compareStats.value
    ? radarPolygon(radarNorms(compareStats.value, compareAdr.value))
    : "",
);

const statTiles = computed(() => tilesFor(stats.value, adr.value));
const compareTiles = computed(() =>
  tilesFor(compareStats.value, compareAdr.value),
);

// Winner per stat for the mirrored compare rows: 1 = focused, 2 = compare.
function winner(index: number): 0 | 1 | 2 {
  const a = statTiles.value[index];
  const b = compareTiles.value[index];
  if (
    !Number.isFinite(a.raw) ||
    !Number.isFinite(b.raw) ||
    a.raw === b.raw ||
    a.raw < 0 ||
    b.raw < 0
  ) {
    return 0;
  }
  const focusedWins = a.lower ? a.raw < b.raw : a.raw > b.raw;
  return focusedWins ? 1 : 2;
}
</script>

<template>
  <div class="grid gap-4">
    <!-- identity header (hidden in leaderboard where the row already shows it) -->
    <div
      v-if="!compact"
      class="flex flex-wrap items-center justify-between gap-3"
    >
      <div class="flex items-center gap-3">
        <span
          v-if="rank"
          class="font-mono text-2xl font-bold tabular-nums"
          :class="
            rank <= 3 ? 'text-[hsl(var(--tac-amber))]' : 'text-muted-foreground'
          "
        >
          #{{ rank }}
        </span>
        <PlayerDisplay
          :player="{ steam_id: steamId, name, avatar_url: avatarUrl, country }"
          size="md"
          :show-elo="false"
          :show-online="false"
          :show-role="false"
          :linkable="false"
        />
      </div>
      <NuxtLink :to="{ name: 'players-id', params: { id: steamId } }">
        <Button variant="outline" size="sm" class="gap-1.5">
          <ExternalLink class="h-3.5 w-3.5" />
          {{ $t("event.player.full_profile") }}
        </Button>
      </NuxtLink>
    </div>

    <!-- control bar: sub-tabs + compare selector -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div :class="tacticalTabsListClasses">
        <button
          v-for="t in ['stats', 'matches']"
          :key="t"
          type="button"
          :class="[tacticalTabsTriggerClasses, 'rounded-md']"
          :data-state="tab === t ? 'active' : 'inactive'"
          @click="tab = t as any"
        >
          {{ $t(`event.player.tab_${t}`) }}
        </button>
      </div>

      <div class="flex items-center gap-2">
        <span
          v-if="comparePlayer"
          class="inline-flex items-center gap-1.5 rounded-md border border-[hsl(200_90%_62%/0.4)] bg-[hsl(200_90%_62%/0.1)] py-1 pl-2 pr-1 text-xs text-[hsl(200_90%_62%)]"
        >
          <span
            class="inline-block h-2 w-2 rounded-full bg-[hsl(200_90%_62%)]"
          ></span>
          {{ comparePlayer.name }}
          <Button
            variant="ghost"
            size="icon"
            class="h-5 w-5"
            :title="$t('event.player.clear_compare')"
            @click="clearCompare"
          >
            <X class="h-3 w-3" />
          </Button>
        </span>
        <div v-else class="w-[200px]">
          <EventPlayerPicker
            :event-id="eventId"
            :exclude="[steamId]"
            :label="$t('event.player.compare_with')"
            @selected="pickCompare"
          />
        </div>
      </div>
    </div>

    <Transition name="tab-fade" mode="out-in">
      <!-- STATS: one layout for both single + compare; the compare value sits
           right under each stat, and its polygon overlays the same radar. -->
      <div v-if="tab === 'stats'" :key="'stats'">
        <div class="grid gap-3 lg:grid-cols-[1fr_240px]">
          <!-- Compact tile matrix: seam grid, tiles stretch to the radar's
               height (grid-auto-rows:1fr) so no vertical space is wasted. -->
          <div
            class="overflow-hidden rounded-md border border-[hsl(var(--tac-amber)/0.3)]"
          >
            <div
              class="grid h-full grid-cols-2 gap-px bg-border/60 sm:grid-cols-4 [grid-auto-rows:1fr]"
            >
              <div
                v-for="(tile, index) in statTiles"
                :key="tile.key"
                class="flex flex-col justify-center gap-0.5 bg-[hsl(var(--card)/0.55)] px-4 py-3"
              >
                <span class="flex items-baseline gap-2">
                  <span
                    class="font-mono text-xl font-bold leading-none tabular-nums transition-colors"
                    :class="
                      comparePlayer && winner(index) === 1
                        ? 'text-[hsl(var(--tac-amber))]'
                        : ''
                    "
                  >
                    {{ tile.value }}
                  </span>
                  <span
                    v-if="comparePlayer"
                    class="font-mono text-sm font-bold leading-none tabular-nums transition-colors"
                    :class="
                      winner(index) === 2
                        ? 'text-[hsl(200_90%_62%)]'
                        : 'text-[hsl(200_90%_62%)]/70'
                    "
                  >
                    {{ compareTiles[index].value }}
                  </span>
                </span>
                <span
                  class="font-mono text-[0.56rem] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  {{ $t(`event.player.${tile.key}`) }}
                </span>
              </div>
              <!-- filler to complete the 4x2 matrix (7 stats + 1) -->
              <div class="bg-[hsl(var(--card)/0.55)]"></div>
            </div>
          </div>

          <div
            class="flex flex-col items-center justify-center gap-2 rounded-md border border-border/70 bg-card/40 p-2"
          >
            <svg viewBox="0 0 200 184" class="h-[184px] w-full max-w-[240px]">
              <polygon
                v-for="(ring, i) in radarRings"
                :key="i"
                :points="ring"
                fill="none"
                :stroke="
                  i === 0 ? 'hsl(var(--border))' : 'hsl(var(--border) / 0.5)'
                "
              />
              <line
                v-for="(lb, i) in radarLabels"
                :key="`ax-${i}`"
                x1="100"
                y1="92"
                :x2="lb.x - (lb.x - 100) * 0.16"
                :y2="lb.y - 3 - (lb.y - 3 - 92) * 0.16"
                stroke="hsl(var(--border) / 0.5)"
              />
              <polygon
                :points="radarPolyA"
                fill="hsl(var(--tac-amber) / 0.18)"
                stroke="hsl(var(--tac-amber))"
                stroke-width="1.5"
                class="[transition:all_0.3s_ease]"
              />
              <polygon
                v-if="comparePlayer && radarPolyB"
                :points="radarPolyB"
                fill="hsl(200 90% 62% / 0.14)"
                stroke="hsl(200 90% 62%)"
                stroke-width="1.5"
                class="[transition:all_0.3s_ease]"
              />
              <text
                v-for="lb in radarLabels"
                :key="lb.key"
                :x="lb.x"
                :y="lb.y"
                fill="hsl(var(--muted-foreground))"
                font-size="8"
                text-anchor="middle"
                class="font-mono uppercase"
              >
                {{ $t(`event.player.axis_${lb.key}`) }}
              </text>
            </svg>
            <div
              v-if="comparePlayer"
              class="flex items-center gap-4 font-mono text-[0.56rem] uppercase tracking-[0.14em]"
            >
              <span
                class="flex items-center gap-1 text-[hsl(var(--tac-amber))]"
              >
                <span
                  class="inline-block h-1.5 w-1.5 rounded-full bg-[hsl(var(--tac-amber))]"
                ></span>
                {{ name }}
              </span>
              <span class="flex items-center gap-1 text-[hsl(200_90%_62%)]">
                <span
                  class="inline-block h-1.5 w-1.5 rounded-full bg-[hsl(200_90%_62%)]"
                ></span>
                {{ comparePlayer.name }}
              </span>
            </div>
          </div>
        </div>

        <section v-if="clips.length > 0" class="mt-4">
          <div :class="[tacticalSectionLabelClasses]">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("event.story.highlights") }}
          </div>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <HighlightCard v-for="clip in clips" :key="clip.id" :clip="clip" />
          </div>
        </section>
      </div>

      <!-- MATCHES -->
      <div v-else :key="'matches'">
        <MatchesTable v-if="matches.length" :matches="matches.slice(0, 10)" />
        <p v-else class="py-6 text-center text-sm text-muted-foreground">
          {{ $t("event.matches.none") }}
        </p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
@media (prefers-reduced-motion: reduce) {
  .tab-fade-enter-active,
  .tab-fade-leave-active {
    transition: none;
  }
}
</style>
