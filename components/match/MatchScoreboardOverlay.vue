<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { ChevronDown, Trophy } from "lucide-vue-next";
import { order_by } from "~/generated/zeus";
import { generateSubscription } from "~/graphql/graphqlGen";
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
import formatStatValue from "~/utilities/formatStatValue";
import { kdColor } from "~/utils/statTiers";

// Drop-in scoreboard pulldown for any player surface (WHEP, Twitch,
// YouTube, Kick, iframe). Renders a small floating toggle pill at the
// top of its parent container and a slide-down panel with the current
// map score + per-player K/D/A/HS%/DMG/ADR and the result row for
// every other map. Owns its own match subscription so callers only
// need to provide the matchId.

const props = withDefaults(
  defineProps<{
    matchId: string;
    // Compact = small / single-purpose surface (StreamGlobal floating
    // popout, dedicated popout window). Moves the toggle pill to the
    // top-left near the drag handle so it doesn't sit on top of the
    // action in tiny windows. Pure visual hint — doesn't change panel
    // behavior. The panel itself always slides down as an overlay.
    compact?: boolean;
    // When true, the toggle pill + panel only render while the page
    // is in HTML5 fullscreen (the inline match-page case — the user
    // doesn't want the scoreboard chrome stealing space until they
    // ask for it via fullscreen). Auto-closes the panel on exit.
    requireFullscreen?: boolean;
    // Suppresses the floating toggle pill — caller is providing its
    // own toggle. The panel still renders, driven by v-model:open.
    hideToggle?: boolean;
  }>(),
  {
    compact: false,
    requireFullscreen: false,
    hideToggle: false,
  },
);

const open = defineModel<boolean>("open", { default: false });

// Fullscreen tracking — gates visibility when requireFullscreen is set.
const isFullscreen = ref(false);
function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}

const { client: apolloClient } = useApolloClient();
const match = ref<any | null>(null);
let matchSubscription: { unsubscribe: () => void } | undefined;
// Lazy-subscribe: this query pulls the full match (every lineup
// player, all per-map stats, all rounds) and most viewers never open
// the panel. Wait until the user first toggles it open (or in the
// requireFullscreen flow, enters fullscreen) so the subscription
// only spins up when the data is actually needed. Once started we
// keep it alive so repeated open/close doesn't churn the socket.
function ensureSubscribed() {
  if (matchSubscription) return;
  matchSubscription = apolloClient
    .subscribe({
      query: generateSubscription({
        matches_by_pk: [
          { id: props.matchId },
          {
            id: true,
            status: true,
            winning_lineup_id: true,
            lineup_1_id: true,
            lineup_2_id: true,
            options: { best_of: true },
            lineup_1: {
              id: true,
              name: true,
              lineup_players: [
                { order_by: [{ captain: order_by.desc_nulls_last }] },
                {
                  captain: true,
                  steam_id: true,
                  placeholder_name: true,
                  player: {
                    steam_id: true,
                    name: true,
                    match_map_stats: [
                      { where: { match_id: { _eq: props.matchId } } },
                      {
                        match_map_id: true,
                        kills: true,
                        assists: true,
                        deaths: true,
                        hs_kills: true,
                        damage: true,
                      },
                    ],
                  },
                },
              ],
            },
            lineup_2: {
              id: true,
              name: true,
              lineup_players: [
                { order_by: [{ captain: order_by.desc_nulls_last }] },
                {
                  captain: true,
                  steam_id: true,
                  placeholder_name: true,
                  player: {
                    steam_id: true,
                    name: true,
                    match_map_stats: [
                      { where: { match_id: { _eq: props.matchId } } },
                      {
                        match_map_id: true,
                        kills: true,
                        assists: true,
                        deaths: true,
                        hs_kills: true,
                        damage: true,
                      },
                    ],
                  },
                },
              ],
            },
            match_maps: [
              { order_by: [{ order: order_by.asc }] },
              {
                id: true,
                order: true,
                status: true,
                map: { name: true, patch: true },
                lineup_1_score: true,
                lineup_2_score: true,
                winning_lineup_id: true,
                rounds: [
                  { order_by: [{ round: order_by.desc }], limit: 1 },
                  {
                    lineup_1_score: true,
                    lineup_2_score: true,
                    lineup_1_side: true,
                    lineup_2_side: true,
                    round: true,
                  },
                ],
              },
            ],
          },
        ],
      } as any),
    })
    .subscribe({
      next: (result: any) => {
        match.value = result?.data?.matches_by_pk ?? null;
      },
      error: (err: any) => {
        // eslint-disable-next-line no-console
        console.error("[match-scoreboard] subscription error", err);
      },
    });
}

onMounted(() => {
  document.addEventListener("fullscreenchange", onFullscreenChange);
  onFullscreenChange();
  // Non-fullscreen surfaces (StreamGlobal PiP, popout window) render
  // the toggle pill as soon as we have match data — subscribe on
  // mount so the pill appears. The inline match-page surface gates
  // on `requireFullscreen` and only needs data the moment the user
  // enters fullscreen.
  if (!props.requireFullscreen) ensureSubscribed();
});

// requireFullscreen surfaces: spin up the subscription the first
// time the user enters fullscreen (or, fallback, opens the panel via
// some external v-model:open toggle).
watch(
  [open, isFullscreen],
  ([isOpen, isFs]) => {
    if (!props.requireFullscreen) return;
    if (isOpen || isFs) ensureSubscribed();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  matchSubscription?.unsubscribe();
  document.removeEventListener("fullscreenchange", onFullscreenChange);
});

const matchMaps = computed<any[]>(() => match.value?.match_maps ?? []);
const hasMatchData = computed(() => !!match.value);
const hasMaps = computed(() => matchMaps.value.length > 0);
const currentMap = computed(() => {
  const maps = matchMaps.value;
  return (
    maps.find((m: any) => !m.winning_lineup_id) ?? maps[maps.length - 1] ?? null
  );
});
const otherMaps = computed(() =>
  matchMaps.value.filter((m: any) => m.id !== currentMap.value?.id),
);
const showOtherMaps = computed(() => matchMaps.value.length > 1);

const lineup1Players = computed<any[]>(
  () => match.value?.lineup_1?.lineup_players ?? [],
);
const lineup2Players = computed<any[]>(
  () => match.value?.lineup_2?.lineup_players ?? [],
);

const currentMapRounds = computed(() => {
  const cm = currentMap.value;
  if (!cm) return 0;
  return (cm.lineup_1_score ?? 0) + (cm.lineup_2_score ?? 0);
});

function toggle() {
  open.value = !open.value;
}

// Don't render any chrome (toggle pill OR panel) unless we have
// match data AND (no fullscreen requirement, or we're in fullscreen).
const canShow = computed(
  () => hasMatchData.value && (!props.requireFullscreen || isFullscreen.value),
);

// Auto-close the panel when the user exits fullscreen in
// requireFullscreen mode — leaving it open would just hide it.
watch(isFullscreen, (val) => {
  if (!val && props.requireFullscreen) open.value = false;
});

// Expose the matchData + helpers so parents can reuse if needed
defineExpose({ hasMatchData, toggle });

function statsForCurrentMap(lp: any): any | null {
  const arr = lp?.player?.match_map_stats ?? [];
  const mapId = currentMap.value?.id;
  if (!mapId) return null;
  return arr.find((s: any) => s.match_map_id === mapId) ?? null;
}

function playerName(lp: any): string {
  return lp?.player?.name ?? lp?.placeholder_name ?? "—";
}

function playerKDNum(lp: any): number {
  const s = statsForCurrentMap(lp);
  if (!s) return 0;
  const kills = s.kills ?? 0;
  const deaths = s.deaths ?? 0;
  if (deaths === 0) return kills;
  return kills / deaths;
}

function playerKDLabel(lp: any): string | number {
  const s = statsForCurrentMap(lp);
  if (!s) return "—";
  const kills = s.kills ?? 0;
  const deaths = s.deaths ?? 0;
  if (deaths === 0) return kills;
  return formatStatValue((kills / deaths) as unknown as string);
}

function playerHS(lp: any): string {
  const s = statsForCurrentMap(lp);
  if (!s) return "—";
  const kills = s.kills ?? 0;
  if (kills === 0) return "0%";
  return (
    formatStatValue((((s.hs_kills ?? 0) / kills) * 100) as unknown as string) +
    "%"
  );
}

function playerADR(lp: any): number | string {
  const s = statsForCurrentMap(lp);
  const rounds = currentMapRounds.value;
  if (!s || rounds === 0) return 0;
  return formatStatValue(((s.damage ?? 0) / rounds) as unknown as string);
}

function statCell(lp: any, key: "kills" | "deaths" | "assists" | "damage") {
  const s = statsForCurrentMap(lp);
  return s?.[key] ?? "—";
}
</script>

<template>
  <button
    v-if="canShow && !hideToggle"
    type="button"
    class="absolute z-30 inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--tac-amber)/0.55)] bg-black/70 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] backdrop-blur-sm transition-colors cursor-pointer opacity-70 hover:opacity-100"
    :class="[
      open ? 'opacity-100' : '',
      compact ? 'top-2 left-8' : 'top-2 left-1/2 -translate-x-1/2',
    ]"
    :aria-expanded="open"
    :title="$t('match.scoreboard')"
    @click="toggle"
  >
    <Trophy class="h-3 w-3" />
    {{ $t("match.scoreboard") }}
    <ChevronDown
      class="h-3 w-3 transition-transform duration-200"
      :class="open ? 'rotate-180' : ''"
    />
  </button>

  <Transition name="scoreboard-slide">
    <div
      v-if="open && canShow"
      class="absolute inset-x-0 top-0 z-20 max-h-full overflow-auto border-b border-[hsl(var(--tac-amber)/0.5)] bg-card/95 backdrop-blur-sm shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]"
    >
      <div class="px-4 pt-11 pb-3">
        <div
          v-if="!hasMaps"
          class="rounded border border-border/60 bg-background/40 px-3 py-3 text-center font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
        >
          {{ $t("match.maps_not_picked") }}
        </div>
        <template v-else-if="currentMap">
          <div
            class="rounded border border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-2"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex min-w-0 items-center gap-2">
                <span
                  class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-[hsl(var(--tac-amber))]"
                >
                  {{
                    currentMap.winning_lineup_id
                      ? $t("match.scoreboard_overlay.final")
                      : $t("match.scoreboard_overlay.live")
                  }}
                </span>
                <span class="truncate text-sm font-semibold">{{
                  match.lineup_1.name
                }}</span>
                <MatchLineupScoreDisplay
                  :match="match"
                  :lineup="match.lineup_1"
                  :match-map="currentMap"
                />
              </div>
              <span
                class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                {{ currentMap.map?.name }}
              </span>
              <div class="flex min-w-0 items-center justify-end gap-2">
                <MatchLineupScoreDisplay
                  :match="match"
                  :lineup="match.lineup_2"
                  :match-map="currentMap"
                />
                <span class="truncate text-sm font-semibold">{{
                  match.lineup_2.name
                }}</span>
              </div>
            </div>
          </div>

          <!-- Per-map player stats for the current/highlighted map. -->
          <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div
              v-for="(team, idx) in [
                { name: match.lineup_1.name, players: lineup1Players },
                { name: match.lineup_2.name, players: lineup2Players },
              ]"
              :key="idx"
              class="overflow-hidden rounded border border-border/50 bg-background/40"
            >
              <div
                class="flex items-center justify-between border-b border-border/40 bg-card/40 px-2 py-1"
              >
                <span
                  class="truncate font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
                >
                  {{ team.name }}
                </span>
              </div>
              <table class="w-full text-[0.65rem]">
                <thead
                  class="font-mono uppercase tracking-[0.12em] text-muted-foreground/70"
                >
                  <tr class="border-b border-border/30">
                    <th class="px-2 py-1 text-left font-normal">
                      {{ $t("common.player") }}
                    </th>
                    <th class="px-1 py-1 text-center font-normal">K</th>
                    <th class="px-1 py-1 text-center font-normal">D</th>
                    <th class="px-1 py-1 text-center font-normal">A</th>
                    <th class="px-1 py-1 text-center font-normal">K/D</th>
                    <th class="px-1 py-1 text-center font-normal">HS%</th>
                    <th class="px-1 py-1 text-center font-normal">DMG</th>
                    <th class="px-1 py-1 text-center font-normal">ADR</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="lp in team.players"
                    :key="lp.steam_id ?? lp.placeholder_name"
                    class="border-t border-border/20"
                  >
                    <td
                      class="max-w-[140px] truncate px-2 py-0.5 text-left"
                      :title="playerName(lp)"
                    >
                      <span
                        v-if="lp.captain"
                        class="mr-1 font-mono text-[0.55rem] text-[hsl(var(--tac-amber))]"
                        >★</span
                      >{{ playerName(lp) }}
                    </td>
                    <td class="px-1 py-0.5 text-center tabular-nums">
                      {{ statCell(lp, "kills") }}
                    </td>
                    <td class="px-1 py-0.5 text-center tabular-nums">
                      {{ statCell(lp, "deaths") }}
                    </td>
                    <td class="px-1 py-0.5 text-center tabular-nums">
                      {{ statCell(lp, "assists") }}
                    </td>
                    <td class="px-1 py-0.5 text-center tabular-nums">
                      <span
                        :style="
                          statsForCurrentMap(lp)
                            ? { color: kdColor(playerKDNum(lp)) }
                            : undefined
                        "
                      >
                        {{ playerKDLabel(lp) }}
                      </span>
                    </td>
                    <td class="px-1 py-0.5 text-center tabular-nums">
                      {{ playerHS(lp) }}
                    </td>
                    <td class="px-1 py-0.5 text-center tabular-nums">
                      {{ statCell(lp, "damage") }}
                    </td>
                    <td class="px-1 py-0.5 text-center tabular-nums">
                      {{ playerADR(lp) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <div v-if="showOtherMaps" class="mt-2 flex flex-col gap-1">
          <div
            v-for="mm in otherMaps"
            :key="mm.id"
            class="flex items-center justify-between gap-3 rounded border border-border/50 bg-background/40 px-3 py-1.5"
          >
            <div class="flex min-w-0 items-center gap-2">
              <span class="truncate text-xs">{{ match.lineup_1.name }}</span>
              <MatchLineupScoreDisplay
                :match="match"
                :lineup="match.lineup_1"
                :match-map="mm"
                :halves="false"
              />
            </div>
            <span
              class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground"
            >
              {{ mm.map?.name }}
            </span>
            <div class="flex min-w-0 items-center justify-end gap-2">
              <MatchLineupScoreDisplay
                :match="match"
                :lineup="match.lineup_2"
                :match-map="mm"
                :halves="false"
              />
              <span class="truncate text-xs">{{ match.lineup_2.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.scoreboard-slide-enter-active,
.scoreboard-slide-leave-active {
  transition:
    transform 220ms ease,
    opacity 220ms ease;
}
.scoreboard-slide-enter-from,
.scoreboard-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
