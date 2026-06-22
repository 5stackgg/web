<script setup lang="ts">
import { computed, onUnmounted, provide, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import { useMatchClips } from "~/composables/useMatchClips";
import MatchTabs from "~/components/match/MatchTabs.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import MatchMaps from "~/components/match/MatchMaps.vue";
import MatchAdminBottomBar from "~/components/match/MatchAdminBottomBar.vue";
import MatchInfo from "~/components/match/MatchInfo.vue";
import MatchHighlightsReel from "~/components/match/MatchHighlightsReel.vue";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchSourceBadge from "~/components/MatchSourceBadge.vue";
import MatchRegionVeto from "~/components/match/MatchRegionVeto.vue";
import { e_match_status_enum } from "~/generated/zeus";
import MatchMapVeto from "~/components/match/MatchMapVeto.vue";
import MatchPicksDisplay from "~/components/match/MatchPicksDisplay.vue";
import StreamEmbed from "~/components/StreamEmbed.vue";
import LiveStreamPlayer from "~/components/match/LiveStreamPlayer.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { AlertTriangle } from "lucide-vue-next";

definePageMeta({
  pageTransition: { name: "page", mode: "out-in" },
});

const activeStatsMap = ref<null | { id: string; map: { name: string } }>(null);

// One subscription shared by MatchTabs (Clips) + lineup row indicators.
const route = useRoute();
const routeMatchId = computed(() => String(route.params.id));

// Reserve scroll height when switching tabs / maps so a shorter tab can't yank
// the page up (same treatment as the player page).
const {
  minHeight: scrollFloorMinHeight,
  rootEl: pageRootEl,
  capture: captureScrollFloor,
} = useScrollFloor();
watch(
  () => [route.query.tab, activeStatsMap.value?.id],
  () => captureScrollFloor(),
);
const matchClipsState = useMatchClips(routeMatchId);
const hasMatchClips = computed(() => matchClipsState.clips.value.length > 0);
provide("matchClips", matchClipsState.clips);
provide("matchClipsLoading", matchClipsState.loading);
provide("matchClipsByTarget", matchClipsState.byTarget);

// Per-match Valve ranks for the lineup display — Premier CS Rating and
// per-map Competitive/Wingman skill groups, keyed by steam_id. Lives in its
// own lightweight subscription so PlayerDisplay can show each player's rank
// for this match via inject, without threading it through every layer.
const matchRanks = ref<
  Record<
    string,
    {
      rankType: number;
      rank: number;
      previousRank: number | null;
      change: number;
    }
  >
>({});
provide("matchRanks", matchRanks);

const { client: apolloClient } = useApolloClient();
const RANK_HISTORY_SUB = gql`
  subscription MatchRankHistory($matchId: uuid!) {
    player_premier_rank_history(where: { match_id: { _eq: $matchId } }) {
      steam_id
      rank
      rank_type
      previous_rank
    }
  }
`;
let rankSub: { unsubscribe: () => void } | null = null;
watch(
  routeMatchId,
  (id) => {
    rankSub?.unsubscribe();
    rankSub = null;
    matchRanks.value = {};
    if (!id) return;
    rankSub = apolloClient
      .subscribe({ query: RANK_HISTORY_SUB, variables: { matchId: id } })
      .subscribe({
        next: ({ data }: any) => {
          const map: Record<
            string,
            {
              rankType: number;
              rank: number;
              previousRank: number | null;
              change: number;
            }
          > = {};
          for (const r of data?.player_premier_rank_history ?? []) {
            const rank = Number(r.rank ?? 0);
            const prev =
              r.previous_rank == null ? null : Number(r.previous_rank);
            map[String(r.steam_id)] = {
              rankType: Number(r.rank_type),
              rank,
              previousRank: prev,
              change: prev == null ? 0 : rank - prev,
            };
          }
          matchRanks.value = map;
        },
      });
  },
  { immediate: true },
);
onUnmounted(() => rankSub?.unsubscribe());

const heroClasses =
  "relative min-w-0 max-w-full px-6 pt-5 pb-6 max-sm:p-4 border border-border [background:linear-gradient(180deg,hsl(var(--card)/0.2)_0%,hsl(var(--card)/0.04)_100%)] before:content-[''] before:absolute before:w-[14px] before:h-[14px] before:border-[hsl(var(--tac-amber))] before:border-solid before:top-2 before:left-2 before:border-t-2 before:border-l-2 after:content-[''] after:absolute after:w-[14px] after:h-[14px] after:border-[hsl(var(--tac-amber))] after:border-solid after:bottom-2 after:right-2 after:border-b-2 after:border-r-2";

const statusBaseClasses =
  "inline-flex items-center gap-2 px-[0.7rem] py-[0.3rem] font-mono text-[0.68rem] font-bold tracking-[0.2em] uppercase border rounded";

const statusTierClasses: Record<string, string> = {
  live: "bg-[hsl(var(--destructive)/0.15)] border-[hsl(var(--destructive)/0.6)] text-destructive",
  pending:
    "bg-[hsl(var(--tac-amber)/0.12)] border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]",
  veto: "bg-[hsl(var(--topnav-accent)/0.15)] border-[hsl(var(--topnav-accent)/0.5)] text-[hsl(var(--topnav-accent))]",
  finished:
    "bg-[hsl(var(--success)/0.15)] border-[hsl(var(--success)/0.5)] text-success",
  ended: "bg-[hsl(var(--muted)/0.4)] border-border text-muted-foreground",
  neutral: "bg-[hsl(var(--muted)/0.3)] border-border text-muted-foreground",
};

const teamClasses =
  "relative grid font-sans font-bold [font-stretch:80%] text-[clamp(1.5rem,3.5vw,2.75rem)] leading-[0.95] tracking-[0.02em] uppercase min-w-0 max-w-full break-words";

const teamMainClasses =
  "col-start-1 row-start-1 relative bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent";

const teamMainWinnerClasses =
  "from-[hsl(var(--tac-amber))] to-[hsl(var(--tac-amber))]";

const teamGhostClasses =
  "col-start-1 row-start-1 translate-x-1 translate-y-1 text-transparent [-webkit-text-stroke:1px_hsl(var(--tac-amber)/0.3)] pointer-events-none select-none";

const scoreClasses =
  "font-sans font-extrabold [font-stretch:80%] text-[clamp(2.5rem,5vw,4rem)] leading-none text-[hsl(var(--muted-foreground)/0.6)] [font-variant-numeric:tabular-nums] transition-colors duration-200 ease";

const vsBaseClasses =
  "font-mono text-[0.8rem] font-bold tracking-[0.3em] text-muted-foreground px-[0.6rem] py-[0.35rem] border border-border bg-[hsl(var(--card)/0.5)]";
</script>

<template>
  <div
    v-if="match"
    ref="pageRootEl"
    class="flex flex-col gap-4 md:gap-6 w-full max-w-[1600px] mx-auto"
    :style="
      scrollFloorMinHeight ? { minHeight: scrollFloorMinHeight + 'px' } : {}
    "
  >
    <PageTransition>
      <header :class="heroClasses">
        <div class="flex items-center gap-3 flex-wrap mb-5 max-sm:mb-[0.85rem]">
          <span
            :class="[
              statusBaseClasses,
              statusTierClasses[statusTier] || statusTierClasses.neutral,
            ]"
          >
            <span class="w-[6px] h-[6px] bg-current rounded-full"></span>
            {{ match.e_match_status?.description || match.status }}
          </span>
          <TimeAgo
            v-if="
              match.status === e_match_status_enum.Finished && match.ended_at
            "
            :date="match.ended_at"
            class="font-mono text-[0.7rem] tracking-[0.2em] uppercase text-muted-foreground"
          />
          <span
            v-if="match.label"
            class="font-mono text-[0.7rem] tracking-[0.2em] uppercase text-muted-foreground"
          >
            {{ match.label }}
          </span>
          <NuxtLink
            v-if="tournamentContext"
            :to="`/tournaments/${tournamentContext.id}`"
            class="inline-flex items-center gap-[0.4rem] font-mono text-[0.72rem] tracking-[0.15em] uppercase text-muted-foreground [transition:color_140ms_ease] hover:text-[hsl(var(--tac-amber))] max-sm:w-full max-sm:ml-0"
          >
            <span class="text-[hsl(var(--tac-amber))] text-[0.65rem]">◢</span>
            {{ tournamentContext.name }}
          </NuxtLink>

          <div class="inline-flex items-center gap-2 ml-auto">
            <span
              v-if="match.options?.type"
              class="inline-flex items-center self-stretch px-[0.7rem] py-[0.25rem] font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] leading-none rounded border border-border/70 bg-muted/35 text-muted-foreground"
            >
              {{ match.options.type }}
            </span>
            <MatchSourceBadge
              v-if="match.source !== 'faceit'"
              :source="match.source"
            />
            <MatchActions :match="match" />
          </div>
        </div>

        <div
          class="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-6 items-stretch lg:items-center"
        >
          <div
            class="flex items-center gap-3 min-w-0 justify-center text-center lg:justify-start lg:text-left"
          >
            <div
              class="shrink-0 h-12 w-12 border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.1)] flex items-center justify-center overflow-hidden"
            >
              <img
                v-if="lineup1AvatarSrc"
                :src="lineup1AvatarSrc"
                :alt="lineup1Name"
                class="h-full w-full object-cover"
              />
              <span
                v-else
                class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
              >
                {{ (lineup1Name || "?").slice(0, 3) }}
              </span>
            </div>
            <div
              class="flex flex-col gap-[0.35rem] min-w-0 items-start lg:items-start"
            >
              <span
                class="font-mono text-[0.6rem] tracking-[0.28em] uppercase text-muted-foreground/70"
              >
                {{ $t("match.lineup.lineup_1") }}
              </span>
              <NuxtLink
                v-if="lineup1TeamId"
                :to="`/teams/${lineup1TeamId}`"
                :class="[
                  teamClasses,
                  match.winning_lineup_id === match.lineup_1_id && 'is-winner',
                  'transition-opacity hover:opacity-80 cursor-pointer',
                ]"
              >
                <span :class="teamGhostClasses" aria-hidden="true">
                  {{ lineup1Name }}
                </span>
                <span
                  :class="[
                    teamMainClasses,
                    match.winning_lineup_id === match.lineup_1_id &&
                      teamMainWinnerClasses,
                  ]"
                >
                  {{ lineup1Name }}
                </span>
              </NuxtLink>
              <div
                v-else
                :class="[
                  teamClasses,
                  match.winning_lineup_id === match.lineup_1_id && 'is-winner',
                ]"
              >
                <span :class="teamGhostClasses" aria-hidden="true">
                  {{ lineup1Name }}
                </span>
                <span
                  :class="[
                    teamMainClasses,
                    match.winning_lineup_id === match.lineup_1_id &&
                      teamMainWinnerClasses,
                  ]"
                >
                  {{ lineup1Name }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-center">
            <div v-if="hasScores" class="inline-flex items-center gap-4">
              <span
                :class="[
                  scoreClasses,
                  mapScores.l1 > mapScores.l2 &&
                    '!text-[hsl(var(--tac-amber))] [text-shadow:0_0_18px_hsl(var(--tac-amber)/0.35)]',
                ]"
              >
                <AnimatedStat :value="mapScores.l1" />
              </span>
              <span :class="[vsBaseClasses, 'uppercase']">{{
                $t("common.vs")
              }}</span>
              <span
                :class="[
                  scoreClasses,
                  mapScores.l2 > mapScores.l1 &&
                    '!text-[hsl(var(--tac-amber))] [text-shadow:0_0_18px_hsl(var(--tac-amber)/0.35)]',
                ]"
              >
                <AnimatedStat :value="mapScores.l2" />
              </span>
            </div>
            <span
              v-else
              :class="[vsBaseClasses, 'text-base px-4 py-[0.6rem] uppercase']"
              >{{ $t("common.vs") }}</span
            >
          </div>

          <div
            class="flex items-center gap-3 min-w-0 justify-center text-center lg:justify-end lg:text-right flex-row-reverse lg:flex-row"
          >
            <div
              class="flex flex-col gap-[0.35rem] min-w-0 items-start lg:items-end"
            >
              <span
                class="font-mono text-[0.6rem] tracking-[0.28em] uppercase text-muted-foreground/70"
              >
                {{ $t("match.lineup.lineup_2") }}
              </span>
              <NuxtLink
                v-if="lineup2TeamId"
                :to="`/teams/${lineup2TeamId}`"
                :class="[
                  teamClasses,
                  match.winning_lineup_id === match.lineup_2_id && 'is-winner',
                  'transition-opacity hover:opacity-80 cursor-pointer',
                ]"
              >
                <span :class="teamGhostClasses" aria-hidden="true">
                  {{ lineup2Name }}
                </span>
                <span
                  :class="[
                    teamMainClasses,
                    match.winning_lineup_id === match.lineup_2_id &&
                      teamMainWinnerClasses,
                  ]"
                >
                  {{ lineup2Name }}
                </span>
              </NuxtLink>
              <div
                v-else
                :class="[
                  teamClasses,
                  match.winning_lineup_id === match.lineup_2_id && 'is-winner',
                ]"
              >
                <span :class="teamGhostClasses" aria-hidden="true">
                  {{ lineup2Name }}
                </span>
                <span
                  :class="[
                    teamMainClasses,
                    match.winning_lineup_id === match.lineup_2_id &&
                      teamMainWinnerClasses,
                  ]"
                >
                  {{ lineup2Name }}
                </span>
              </div>
            </div>
            <div
              class="shrink-0 h-12 w-12 border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.1)] flex items-center justify-center overflow-hidden"
            >
              <img
                v-if="lineup2AvatarSrc"
                :src="lineup2AvatarSrc"
                :alt="lineup2Name"
                class="h-full w-full object-cover"
              />
              <span
                v-else
                class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
              >
                {{ (lineup2Name || "?").slice(0, 3) }}
              </span>
            </div>
          </div>
        </div>

        <div
          class="flex items-center gap-[0.6rem] justify-center flex-wrap mt-4 pt-[0.85rem] border-t border-border font-mono text-[0.72rem] tracking-[0.15em] uppercase text-muted-foreground"
        >
          <span
            v-if="showAutoCancel"
            class="inline-flex items-center gap-[0.3rem] text-[0.6rem] leading-none tracking-[0.12em] text-destructive"
            :title="$t('match.auto_canceling')"
          >
            <AlertTriangle class="w-2.5 h-2.5 shrink-0" />
            <span>{{ $t("match.auto_canceling") }}</span>
            <TimeAgo :date="match.cancels_at" hide-icon />
          </span>
          <span
            v-if="showAutoCancel && isNative && match.options?.best_of"
            class="opacity-40"
            >·</span
          >
          <span v-if="isNative && match.options?.best_of">
            {{
              $t("match.options.best_of.option", {
                count: match.options.best_of,
              })
            }}
          </span>
          <span
            v-if="isNative && match.e_region?.description"
            class="opacity-40"
            >·</span
          >
          <span v-if="isNative && match.e_region?.description">
            {{ match.e_region.description }}
          </span>
          <span v-if="isNative && formattedSchedule" class="opacity-40">·</span>
          <span v-if="formattedSchedule">
            {{ formattedSchedule }}
          </span>
        </div>
      </header>
    </PageTransition>

    <PageTransition v-if="hasMatchClips" :delay="60">
      <MatchHighlightsReel :match="match" />
    </PageTransition>

    <div
      class="grid items-start gap-4 md:gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-[minmax(320px,_400px)_minmax(0,1fr)]"
    >
      <!-- Spectator stream surface. game-streamer rows get the
           full LiveStreamPlayer (WHEP + scoreboard pulldown);
           regular embeds stay in StreamEmbed. Mirrors the split
           that MatchLiveStreams uses on the Streams tab so the
           scoreboard is reachable from either view. Lives as its
           own grid item so on mobile (1-col) it appears above the
           maps, while on desktop it sits at the top of the right
           column. -->
      <PageTransition v-if="showLiveStreamBlock">
        <div
          class="order-first min-w-0 pb-6 space-y-4 lg:order-none lg:col-start-2 lg:row-start-1"
        >
          <LiveStreamPlayer
            v-if="hasGameStreamer"
            :match-id="match.id"
            class="max-w-[1500px] w-full"
          />
          <StreamEmbed
            v-if="embeddableStreams.length > 0"
            :streams="embeddableStreams"
            :match-id="match.id"
            class="max-w-[1500px] w-full overflow-x-auto"
          />
        </div>
      </PageTransition>

      <div
        class="grid grid-cols-1 gap-y-4 md:gap-y-6 min-w-0"
        :class="
          showLiveStreamBlock
            ? 'lg:col-start-1 lg:row-start-1 lg:row-span-2'
            : ''
        "
      >
        <PageTransition :delay="100">
          <MatchInfo :match="match"></MatchInfo>
        </PageTransition>

        <PageTransition :delay="200">
          <ChatLobby
            class="max-h-96"
            instance="matches/id"
            type="match"
            :lobby-id="match.id"
            :play-notification-sound="match.status !== e_match_status_enum.Live"
            v-if="canJoinLobby"
          />
        </PageTransition>

        <PageTransition :delay="200">
          <div
            v-if="match.options.best_of && match.options.best_of > 0"
            class="flex flex-col gap-3"
          >
            <div v-for="(slot, index) in mapSlots" :key="index">
              <MatchMaps
                v-if="slot"
                :match="match"
                :match-map="slot"
                :is-active="activeStatsMap?.id === slot.id"
                @open-stats="activeStatsMap = $event"
              ></MatchMaps>
              <div
                v-else
                class="rounded-xl overflow-hidden border-2 border-dashed border-border/60"
              >
                <div
                  class="aspect-[16/5] bg-muted/40 flex items-center justify-center text-muted-foreground"
                >
                  <div class="flex flex-col items-center gap-1">
                    <span class="text-sm uppercase tracking-wide font-semibold">
                      {{ $t("match.map_number", { count: index + 1 }) }}
                    </span>
                    <span class="text-xs">
                      {{ $t("match.map_tbd") }}
                    </span>
                  </div>
                </div>
                <div class="bg-muted/40 border-t border-border/30 px-3 py-2.5">
                  <div class="flex items-center justify-center">
                    <span class="text-xs text-muted-foreground">—</span>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-show="showVetoPicks && vetoPickCount !== 0"
              class="rounded-xl border border-border/40 bg-card/40 px-1.5 py-1.5"
            >
              <div
                class="font-mono text-[0.6rem] font-bold tracking-[0.28em] uppercase text-muted-foreground/70 text-center mb-1"
              >
                {{ $t("common.map_veto") }}
              </div>
              <MatchPicksDisplay
                v-if="showVetoPicks"
                :match="match"
                @update:count="vetoPickCount = $event"
              />
            </div>
          </div>
        </PageTransition>
      </div>

      <div
        class="min-w-0"
        :class="showLiveStreamBlock ? 'lg:col-start-2 lg:row-start-2' : ''"
      >
        <PageTransition :delay="100">
          <template
            v-if="
              regions.length === 0 && match.options.region_veto && !match.region
            "
          >
            <Alert
              variant="destructive"
              class="bg-red-600 text-white max-w-md mb-6"
            >
              <AlertTitle>{{
                $t("match.region_veto.no_regions_available")
              }}</AlertTitle>
              <AlertDescription>
                {{ $t("match.region_veto.no_regions_available_description") }}
              </AlertDescription>
            </Alert>
          </template>
        </PageTransition>

        <PageTransition :delay="100">
          <MatchRegionVeto :match="match" class="pb-6" />
        </PageTransition>

        <PageTransition :delay="100">
          <MatchMapVeto :match="match" class="pb-6" />
        </PageTransition>

        <PageTransition :delay="200">
          <MatchTabs
            :match="match"
            :active-map="activeStatsMap"
            @clear-active-map="activeStatsMap = null"
            @select-map="activeStatsMap = $event"
          ></MatchTabs>
        </PageTransition>
      </div>
    </div>

    <MatchAdminBottomBar v-if="match.is_organizer" :match="match" />
  </div>
</template>

<script lang="ts">
import { $, order_by, e_match_status_enum } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { mapFields } from "~/graphql/mapGraphql";
import { matchLineups } from "~/graphql/matchLineupsGraphql";
import { playerFields } from "~/graphql/playerFields";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import { eloFields } from "~/graphql/eloFields";
import { useMatchContext } from "~/composables/useMatchContext";

export default {
  unmounted() {
    useMatchContext().value = null;
  },
  beforeRouteLeave(_to: any, _from: any, next: any) {
    // Keep the live stream playing across navigation: if a stream was
    // mounted inline on this page and nothing is in the global PiP yet,
    // hand it off to the global player so the user isn't cut off when
    // they navigate away.
    const store = useApplicationSettingsStore();
    if (this.showLiveStreamBlock && !store.globalStream) {
      const streams = this.match?.streams || [];
      const promote =
        streams.find((s: any) => s.is_game_streamer) || streams[0];
      if (promote) {
        store.setGlobalStream({ ...promote, match_id: this.match.id });
      }
    }
    next();
  },
  data() {
    return {
      match: undefined,
      vetoPickCount: undefined,
    };
  },
  apollo: {
    $subscribe: {
      matches_by_pk: {
        variables: function () {
          return {
            matchId: this.$route.params.id,
            order_by_name: order_by.asc,
            order_by_round_kills: order_by.asc,
            order_by_round: order_by.desc,
          };
        },
        query: typedGql("subscription")({
          matches_by_pk: [
            {
              id: $("matchId", "uuid!"),
            },
            {
              id: true,
              status: true,
              source: true,
              invite_code: true,
              draft_games: [{}, { id: true }],
              e_match_status: {
                description: true,
              },
              region: true,
              e_region: {
                description: true,
              },
              is_coach: true,
              is_captain: true,
              is_in_lineup: true,
              is_organizer: true,
              can_start: true,
              can_schedule: true,
              can_check_in: true,
              requested_organizer: true,
              is_tournament_match: true,
              label: true,
              can_cancel: true,
              can_assign_server: true,
              can_stream_live: true,
              min_players_per_lineup: true,
              max_players_per_lineup: true,
              server_id: true,
              server_type: true,
              server_region: true,
              is_server_online: true,
              lineup_1_id: true,
              lineup_2_id: true,
              winning_lineup_id: true,
              map_veto_type: true,
              map_veto_picking_lineup_id: true,
              region_veto_picking_lineup_id: true,
              connection_link: true,
              connection_string: true,
              tv_connection_string: true,
              is_match_server_available: true,
              cancels_at: true,
              scheduled_at: true,
              ended_at: true,
              server_error: true,
              organizer: playerFields,
              options: {
                lobby_access: true,
                ...matchOptionsFields,
              },
              tournament_brackets: [
                { limit: 1 },
                {
                  stage: {
                    tournament: {
                      id: true,
                      name: true,
                    },
                  },
                },
              ],
              region_veto_picks: {
                type: true,
                region: true,
              },
              match_maps: [
                {
                  order_by: {
                    order: order_by.asc,
                  },
                },
                {
                  id: true,
                  order: true,
                  lineup_1_side: true,
                  lineup_2_side: true,
                  map: mapFields,
                  is_current_map: true,
                  demos_total_size: true,
                  demos_download_url: true,
                  status: true,
                  lineup_1_score: true,
                  lineup_2_score: true,
                  winning_lineup_id: true,
                  vetos: {
                    side: true,
                    type: true,
                    match_lineup_id: true,
                  },
                  demos: {
                    id: true,
                    size: true,
                    download_url: true,
                    metadata_parsed_at: true,
                    total_ticks: true,
                    geometry_validated: true,
                    created_at: true,
                  },
                  rounds: [
                    {
                      order_by: {
                        round: $("order_by_round", "order_by"),
                      },
                    },
                    {
                      lineup_1_score: true,
                      lineup_2_score: true,
                      lineup_1_money: true,
                      lineup_2_money: true,
                      lineup_1_side: true,
                      lineup_2_side: true,
                      winning_side: true,
                      winning_reason: true,
                      round: true,
                      kills: [
                        {
                          order_by: {
                            time: $("order_by_round_kills", "order_by"),
                          },
                        },
                        {
                          with: true,
                          headshot: true,
                          player: {
                            steam_id: true,
                          },
                          attacked_player: {
                            steam_id: true,
                          },
                        },
                      ],
                      assists: [
                        {},
                        {
                          attacker_steam_id: true,
                          attacked_steam_id: true,
                          flash: true,
                        },
                      ],
                    },
                  ],
                },
              ],
              lineup_1: [{}, matchLineups],
              lineup_2: [{}, matchLineups],
              elo_changes: [{}, eloFields],
              streams: [
                {
                  order_by: [
                    {
                      priority: order_by.asc,
                    },
                    {
                      title: order_by.asc,
                    },
                  ],
                },
                {
                  id: true,
                  match_id: true,
                  link: true,
                  title: true,
                  priority: true,
                  is_game_streamer: true,
                  is_live: true,
                  mode: true,
                  status: true,
                  stream_url: true,
                  error_message: true,
                  last_status_at: true,
                  status_history: true as any,
                },
              ],
            },
          ],
        }),
        result: function ({ data }) {
          const match = data.matches_by_pk;

          if (!match) {
            // Only redirect on initial load. If we previously had the match
            // and it disappeared (e.g., canceled), keep the subscription
            // alive so we pick it back up if it gets restarted.
            if (this.match === undefined) {
              this.match = null;
              useMatchContext().value = null;
              navigateTo("/watch");
            }
            return;
          }

          // Check-in and veto for a draft-created match happen in the draft
          // room, so the match page sends you there when a draft lobby exists.
          const draftGameId = match.draft_games?.[0]?.id;
          if (
            draftGameId &&
            [
              e_match_status_enum.WaitingForCheckIn,
              e_match_status_enum.Veto,
            ].includes(match.status)
          ) {
            navigateTo(`/draft-room/${draftGameId}`);
            return;
          }

          this.match = match;

          const mc = useMatchContext();
          const displayText =
            match.label ||
            `${match.lineup_1?.name ?? this.$t("common.tbd")} vs ${match.lineup_2?.name ?? this.$t("common.tbd")}`;
          const tournament = match.tournament_brackets?.[0]?.stage?.tournament;
          mc.value = {
            id: match.id,
            displayText,
            ...(tournament
              ? { tournament: { id: tournament.id, name: tournament.name } }
              : {}),
          };
        },
      },
    },
  },
  computed: {
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    lineup1Name() {
      return this.match?.lineup_1?.name || this.$t("match.lineup.lineup_1");
    },
    lineup2Name() {
      return this.match?.lineup_2?.name || this.$t("match.lineup.lineup_2");
    },
    lineup1AvatarSrc() {
      const avatarUrl = this.match?.lineup_1?.team?.avatar_url;
      if (!avatarUrl) return null;
      return `https://${this.apiDomain}/${avatarUrl}`;
    },
    lineup2AvatarSrc() {
      const avatarUrl = this.match?.lineup_2?.team?.avatar_url;
      if (!avatarUrl) return null;
      return `https://${this.apiDomain}/${avatarUrl}`;
    },
    lineup1TeamId() {
      return this.match?.lineup_1?.team_id ?? null;
    },
    lineup2TeamId() {
      return this.match?.lineup_2?.team_id ?? null;
    },
    mapScores() {
      const maps = this.match?.match_maps || [];
      const l1Id = this.match?.lineup_1_id;
      const l2Id = this.match?.lineup_2_id;
      let l1 = 0;
      let l2 = 0;
      for (const m of maps) {
        if (m.winning_lineup_id === l1Id) l1++;
        else if (m.winning_lineup_id === l2Id) l2++;
      }
      return { l1, l2 };
    },
    hasScores() {
      const scoreStates = [
        e_match_status_enum.Live,
        e_match_status_enum.Finished,
        e_match_status_enum.Forfeit,
        e_match_status_enum.Surrendered,
        e_match_status_enum.Tie,
      ];
      return (
        this.match?.status &&
        scoreStates.includes(this.match.status) &&
        this.mapScores.l1 + this.mapScores.l2 > 0
      );
    },
    statusTier() {
      const s = this.match?.status;
      if (s === e_match_status_enum.Live) return "live";
      if (
        s === e_match_status_enum.Scheduled ||
        s === e_match_status_enum.WaitingForCheckIn ||
        s === e_match_status_enum.WaitingForServer
      ) {
        return "pending";
      }
      if (
        s === e_match_status_enum.Veto ||
        s === e_match_status_enum.PickingPlayers
      ) {
        return "veto";
      }
      if (s === e_match_status_enum.Finished) return "finished";
      if (
        s === e_match_status_enum.Forfeit ||
        s === e_match_status_enum.Surrendered ||
        s === e_match_status_enum.Canceled
      ) {
        return "ended";
      }
      return "neutral";
    },
    tournamentContext() {
      return this.match?.tournament_brackets?.[0]?.stage?.tournament ?? null;
    },
    showAutoCancel() {
      return (
        this.match?.cancels_at &&
        this.match.status !== e_match_status_enum.Canceled
      );
    },
    formattedSchedule() {
      const when = this.match?.scheduled_at || this.match?.ended_at;
      if (!when) return null;
      try {
        return new Date(when).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
      } catch {
        return null;
      }
    },
    isNative() {
      return !this.match?.source || this.match.source === "5stack";
    },
    showVetoPicks() {
      if (!this.match) return false;
      if (this.match.source && this.match.source !== "5stack") return false;
      const hasVeto =
        this.match.options?.map_veto || this.match.options?.region_veto;
      if (!hasVeto) return false;
      return this.match.status !== e_match_status_enum.Veto;
    },
    mapSlots() {
      if (!this.match || !this.match.options?.best_of) {
        return this.match?.match_maps ?? [];
      }

      const bestOf = this.match.options.best_of;
      const maps = this.match.match_maps || [];
      const matchEnded = [
        e_match_status_enum.Finished,
        e_match_status_enum.Forfeit,
        e_match_status_enum.Surrendered,
        e_match_status_enum.Tie,
        e_match_status_enum.Canceled,
      ].includes(this.match.status);

      if (matchEnded) {
        return maps;
      }

      const slots = [];
      for (let i = 0; i < bestOf; i++) {
        slots.push(maps[i] || null);
      }

      return slots;
    },
    showSeparators() {
      return useApplicationSettingsStore().showSeparators;
    },
    matchId() {
      return this.$route.params.id;
    },
    regions() {
      return useApplicationSettingsStore().availableRegions.filter((region) => {
        return region.is_lan === false;
      });
    },
    canJoinLobby() {
      if (!this.match) {
        return false;
      }

      if (
        ![
          e_match_status_enum.Live,
          e_match_status_enum.PickingPlayers,
          e_match_status_enum.Scheduled,
          e_match_status_enum.Veto,
          e_match_status_enum.WaitingForCheckIn,
          e_match_status_enum.WaitingForServer,
        ].includes(this.match.status)
      ) {
        return false;
      }

      return (
        this.match.is_in_lineup ||
        this.match.is_organizer ||
        this.match.is_coach
      );
    },
    hasGameStreamer() {
      return (this.match?.streams || []).some((s) => s.is_game_streamer);
    },
    embeddableStreams() {
      return (this.match?.streams || []).filter((s) => !s.is_game_streamer);
    },
    showLiveStreamBlock() {
      return (
        this.showLiveStreams &&
        (this.match?.streams?.length || 0) > 0 &&
        !this.match?.is_in_lineup &&
        !this.match?.is_coach
      );
    },
    showLiveStreams() {
      if (
        [
          e_match_status_enum.Finished,
          e_match_status_enum.Forfeit,
          e_match_status_enum.Surrendered,
          e_match_status_enum.Tie,
          e_match_status_enum.Canceled,
        ].includes(this.match?.status)
      ) {
        if (this.match?.ended_at) {
          const allowExtraTime = new Date(this.match.ended_at);
          allowExtraTime.setMinutes(allowExtraTime.getMinutes() + 10);

          if (allowExtraTime > new Date()) {
            return true;
          }
        }

        return false;
      }

      return true;
    },
  },
};
</script>
