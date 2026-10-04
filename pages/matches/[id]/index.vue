<script setup lang="ts">
import { computed, markRaw, onUnmounted, provide, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import { useMatchClips } from "~/composables/useMatchClips";
import MatchTabs from "~/components/match/MatchTabs.vue";
import MatchMaps from "~/components/match/MatchMaps.vue";
import MatchAdminBottomBar from "~/components/match/MatchAdminBottomBar.vue";
import MatchInfo from "~/components/match/MatchInfo.vue";
import CameraRequirementOverlay from "~/components/match/CameraRequirementOverlay.vue";
import MatchHighlightsReel from "~/components/match/MatchHighlightsReel.vue";
import MatchHeader from "~/components/match/MatchHeader.vue";
import MatchRegionVeto from "~/components/match/MatchRegionVeto.vue";
import { e_match_status_enum } from "~/generated/zeus";
import MatchMapVeto from "~/components/match/MatchMapVeto.vue";
import MatchPicksDisplay from "~/components/match/MatchPicksDisplay.vue";
import StreamEmbed from "~/components/StreamEmbed.vue";
import LiveStreamPlayer from "~/components/match/LiveStreamPlayer.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import VoiceChannelCard from "~/components/voice/VoiceChannelCard.vue";
import { useMatchContext } from "~/composables/useMatchContext";

definePageMeta({
  pageTransition: { name: "page", mode: "out-in" },
});

// Reflect the match ("Team A vs Team B") in the browser tab / in-app title.
// The context is populated by the subscription in the Options block below.
const matchContext = useMatchContext();
useHead({
  title: () => matchContext.value?.displayText || undefined,
});

const activeStatsMap = ref<null | { id: string; map: { name: string } }>(null);

// One subscription shared by MatchTabs (Clips) + lineup row indicators.
const route = useRoute();
const routeMatchId = computed(() => String(route.params.id));

// Reserve scroll height when switching maps so a shorter map can't yank the
// page up. Tab switches are covered by ui/tabs itself.
const { capture: captureScrollFloor } = useScrollFloor();
watch(
  () => activeStatsMap.value?.id,
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
</script>

<template>
  <div class="flex flex-col gap-4 md:gap-6 w-full max-w-[1600px] mx-auto">
    <!-- Mounted for as long as this match asks the viewer for a camera, not
         just while one is missing: it owns the status poll, and unmounting it
         once the camera came up is what stopped anyone noticing it go away
         again. `open` is what actually shows the modal. -->
    <CameraRequirementOverlay
      v-if="cameraRequiredOfMe"
      :match-id="match.id"
      :open="cameraGateActive && !cameraOverlayDismissed"
      :allow-teammates="!!match.options?.camera_allow_teammates"
      @update:ready="onCameraReadyChanged"
      @dismiss="cameraOverlayDismissed = true"
    />

    <!-- Deliberately loud and pinned to the top: the requirement did not go
         away when the modal was dismissed, and check-in stays blocked until a
         camera is live. -->
    <!-- Animating grid rows rather than mounting the bar: a v-if would jump the
         whole page down a bar-height in one frame. The wrapper only exists while
         the gate is active, so a normal match never carries its flex gap. The
         delay lets the modal finish fading before the page starts moving. -->
    <div
      v-if="cameraGateActive"
      class="grid transition-[grid-template-rows] [transition-duration:320ms] ease-out motion-reduce:![transition-duration:1ms]"
      :class="
        cameraOverlayDismissed
          ? 'grid-rows-[1fr] delay-150 motion-reduce:delay-0'
          : 'grid-rows-[0fr]'
      "
    >
      <div class="overflow-hidden min-h-0">
        <button
          type="button"
          class="camera-nag flex w-full items-center gap-3 rounded-lg border border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] px-4 py-3 text-left transition-[background-color,opacity] duration-300 hover:bg-[hsl(var(--tac-amber)/0.2)]"
          :class="
            cameraOverlayDismissed ? 'opacity-100 delay-200' : 'opacity-0'
          "
          :tabindex="cameraOverlayDismissed ? 0 : -1"
          :aria-hidden="!cameraOverlayDismissed"
          @click="cameraOverlayDismissed = false"
        >
          <span class="relative flex size-2 flex-shrink-0" aria-hidden="true">
            <span
              class="absolute inline-flex size-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
            ></span>
            <span
              class="relative inline-flex size-2 rounded-full bg-[hsl(var(--tac-amber))]"
            ></span>
          </span>

          <span class="min-w-0 flex-1">
            <span
              class="block font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
            >
              {{ $t("camera.title") }}
            </span>
            <span class="block text-xs text-muted-foreground">
              {{ $t("camera.nag") }}
            </span>
          </span>

          <span
            class="flex-shrink-0 font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
          >
            {{ $t("camera.nag_action") }}
          </span>
        </button>
      </div>
    </div>
    <template v-if="match">
      <PageTransition>
        <!-- The match stage: scorebug band on top, highlights underneath, one
             rounded surface. The highlights fold in when the clips arrive. -->
        <section
          class="relative isolate overflow-hidden rounded-2xl bg-muted/20 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-white/[0.07]"
        >
          <MatchHeader :match="match" />
          <div
            class="grid transition-[grid-template-rows] [transition-duration:240ms] ease-out motion-reduce:transition-none"
            :class="hasMatchClips ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
          >
            <div class="min-h-0 overflow-hidden">
              <MatchHighlightsReel v-if="hasMatchClips" :match="match" />
            </div>
          </div>
        </section>
      </PageTransition>

      <div
        class="grid items-start gap-4 md:gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-[minmax(320px,_400px)_minmax(0,1fr)]"
      >
        <!-- Left column: match info, chat, maps. On desktop it's the
           first grid column; on mobile it drops below the stream. -->
        <div
          class="grid grid-cols-1 gap-y-4 md:gap-y-6 min-w-0"
          :class="showLiveStreamBlock ? 'order-2 lg:order-none' : ''"
        >
          <PageTransition :delay="100">
            <MatchInfo :match="match" :camera-ready="cameraReady"></MatchInfo>
          </PageTransition>

          <PageTransition :delay="200">
            <!-- Both rooms on one panel. Organizers and anyone not on a lineup
               get no `myLineupId`, so they get no team destination and this
               falls back to the match room alone.
               Wrapped so the read cursor can follow whether it is on screen,
               rather than whether it is allowed to be. -->
            <div ref="inlineChat" v-if="canJoinLobby">
              <ChatLobby
                class="max-h-96"
                instance="matches/id"
                type="match"
                :lobby-id="match.id"
                :team-lobby-id="
                  myLineupId ? `${match.id}:${myLineupId}` : undefined
                "
                :play-notification-sound="
                  match.status !== e_match_status_enum.Live
                "
              />
            </div>
          </PageTransition>

          <!-- Team voice, beside the chat rather than inside it: the voice
               channel and the text channel are the same room but not the same
               object, and nesting one in the other made the controls read as
               chat controls.
               Always present, because it is now the only way in. The strip that
               used to live on the chat composer existed to start a call before
               this section appeared -- which left the same three controls on
               screen twice as soon as it had. -->
          <VoiceChannelCard
            v-if="myVoiceLineupId"
            show-empty
            class="mt-1"
            kind="match"
            :channel-id="myVoiceLineupId"
            :label="$t('layouts.voice_panel.team_comms')"
          />

          <PageTransition :delay="200">
            <div
              v-if="match.options.best_of && match.options.best_of > 0"
              class="flex flex-col gap-3"
            >
              <!-- Each veto pick turns a dashed placeholder into a real map
                   card in place; the two are different heights, so each slot
                   trades through its own measured swap instead of jerking the
                   column on every pick. The group collapses the trailing
                   placeholders away when the match ends. -->
              <TransitionGroup
                tag="div"
                class="flex flex-col gap-3"
                leave-active-class="map-slot-collapse"
                leave-to-class="map-slot-collapse-to"
              >
                <!-- minmax(0,1fr) on the column, not just grid-rows: an auto
                     column track floors at the item's min-content, and a map
                     card's min-content is its round history at full width. The
                     card rendered ~730px wide inside a 400px column and drew
                     over the scoreboard. -->
                <div
                  v-for="(slot, index) in mapSlots"
                  :key="index"
                  class="grid grid-cols-[minmax(0,1fr)] grid-rows-[1fr]"
                >
                  <div class="min-h-0 min-w-0">
                    <HeightSwap>
                      <div v-if="slot" key="map">
                        <MatchMaps
                          :match="match"
                          :match-map="slot"
                          :is-active="activeStatsMap?.id === slot.id"
                          @open-stats="activeStatsMap = $event"
                        ></MatchMaps>
                      </div>
                      <div
                        v-else
                        key="tbd"
                        class="rounded-xl overflow-hidden border-2 border-dashed border-border/60"
                      >
                        <div
                          class="aspect-[16/5] bg-muted/40 flex items-center justify-center text-muted-foreground"
                        >
                          <div class="flex flex-col items-center gap-1">
                            <span
                              class="text-sm uppercase tracking-wide font-semibold"
                            >
                              {{ $t("match.map_number", { count: index + 1 }) }}
                            </span>
                            <span class="text-xs">
                              {{ $t("match.map_tbd") }}
                            </span>
                          </div>
                        </div>
                        <div
                          class="bg-muted/40 border-t border-border/30 px-3 py-2.5"
                        >
                          <div class="flex items-center justify-center">
                            <span class="text-xs text-muted-foreground">—</span>
                          </div>
                        </div>
                      </div>
                    </HeightSwap>
                  </div>
                </div>
              </TransitionGroup>
              <Transition
                enter-active-class="map-slot-collapse"
                enter-from-class="map-slot-collapse-to"
                leave-active-class="map-slot-collapse"
                leave-to-class="map-slot-collapse-to"
              >
                <div
                  v-show="showVetoPicks && vetoPickCount !== 0"
                  class="grid grid-cols-[minmax(0,1fr)] grid-rows-[1fr]"
                >
                  <div class="min-h-0 min-w-0">
                    <div
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
                </div>
              </Transition>
            </div>
          </PageTransition>
        </div>

        <!-- Right column: the live stream surface (game-streamer rows
           get the full WHEP LiveStreamPlayer; embeds stay in
           StreamEmbed) stacked above the scoreboard/tabs. On mobile it
           rises above the left column so the stream leads. -->
        <div
          class="min-w-0 flex flex-col gap-4 md:gap-6"
          :class="showLiveStreamBlock ? 'order-1 lg:order-none' : ''"
        >
          <PageTransition v-if="showLiveStreamBlock">
            <div class="min-w-0 space-y-4">
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

          <div class="min-w-0">
            <PageTransition :delay="100">
              <template
                v-if="
                  regions.length === 0 &&
                  match.options.region_veto &&
                  !match.region
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
                    {{
                      $t("match.region_veto.no_regions_available_description")
                    }}
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
      </div>

      <MatchAdminBottomBar v-if="match.is_organizer" :match="match" />
    </template>
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
// Aliased deliberately. `<script setup>` and this block compile into one
// module, so a module-scope import wins over a computed of the same name when
// the template resolves it -- the template rendered the function's source into
// the team lobby id, which reached Postgres as a uuid and killed chat.
import {
  myLineupId as resolveMyLineupId,
  myVoiceLineupId as resolveMyVoiceLineupId,
} from "~/utilities/matchTeamLobby";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";
import { setPageChatFocus } from "~/composables/useChatPresence";
import { chatThreadKey } from "~/utilities/chatThread";
import socket from "~/web-sockets/Socket";

export default {
  unmounted() {
    useMatchContext().value = null;
    setPageChatFocus(null);
  },
  beforeUnmount() {
    this.inlineChatObserver?.disconnect();
    this.inlineChatObserver = null;
  },
  provide() {
    return {
      refetchMatchStatic: () => this.refetchMatchStatic(),
    };
  },
  watch: {
    matchContext: {
      immediate: true,
      handler(context) {
        useMatchContext().value = context;
      },
    },
    // A status change is what turns most of the static half over: who may
    // cancel, check in or assign a server all follow from it.
    "matchLive.status"(status, previousStatus) {
      if (previousStatus !== undefined && status !== previousStatus) {
        void this.refetchMatchStatic();
      }
    },
    // Assigning a server does not move the status, but it does decide whether
    // this viewer is offered the server controls.
    "matchLive.server_id"(serverId, previousServerId) {
      if (previousServerId !== undefined && serverId !== previousServerId) {
        void this.refetchMatchStatic();
      }
    },
    // The inline chat on this page is a real room being read, and until now it
    // told the server nothing -- so reading a match chat here left the badge up
    // everywhere else and kept the phone buzzing for messages already on
    // screen.
    chatThread: {
      immediate: true,
      handler(thread, previous) {
        setPageChatFocus(thread ?? null);

        if (thread && thread !== previous) {
          socket.markLobbyRead("match", this.match.id);
        }
      },
    },
    // The chat is only rendered once the match says this viewer may join it,
    // which is after the subscription's first result.
    canJoinLobby: {
      immediate: true,
      handler() {
        void this.$nextTick(() => this.watchInlineChat());
      },
    },
  },
  data() {
    return {
      matchLive: undefined,
      matchStatic: undefined,
      vetoPickCount: undefined,
      cameraReady: false,
      cameraOverlayDismissed: false,
      inlineChatVisible: false,
      inlineChatObserver: null as IntersectionObserver | null,
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
              // The permission and membership fields moved to `matchStatic`.
              // Each is a function call the database re-runs for this row on
              // every tick, and none of them change without either a status
              // change or an organizer action -- both of which refetch that
              // half explicitly.
              //
              // can_start and can_check_in stay here: they read lineup
              // readiness, which is live. can_start is only costly in the
              // pre-match states anyway, since it returns on its first status
              // check once a match is Live or over.
              can_start: true,
              can_check_in: true,
              label: true,
              server_id: true,
              server_type: true,
              server_region: true,
              server_plugin_runtime: true,
              is_server_online: true,
              lineup_1_id: true,
              lineup_2_id: true,
              winning_lineup_id: true,
              map_veto_picking_lineup_id: true,
              region_veto_picking_lineup_id: true,
              veto_pick_expires_at: true,
              connection_link: true,
              connection_string: true,
              tv_connection_string: true,
              is_match_server_available: true,
              cancels_at: true,
              scheduled_at: true,
              ended_at: true,
              server_error: true,
              options: {
                ...matchOptionsFields,
              },
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
                  started_at: true,
                  ended_at: true,
                  demo_processing_started_at: true,
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
            // Deleted/gone — leave. Canceling keeps the row, so we stay.
            if (this.matchLive !== null) {
              this.matchLive = null;
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

          this.matchLive = match;
        },
      },
    },
    // The half of the match that only an organizer action or a status change
    // can move. Fetched once instead of on every tick of the subscription
    // above; see the note on the permission fields there.
    matchStatic: {
      variables: function () {
        return {
          matchId: this.$route.params.id,
        };
      },
      fetchPolicy: "cache-and-network",
      query: typedGql("query")({
        matches_by_pk: [
          {
            id: $("matchId", "uuid!"),
          },
          {
            id: true,
            is_coach: true,
            is_captain: true,
            is_in_lineup: true,
            is_organizer: true,
            can_schedule: true,
            can_cancel: true,
            can_assign_server: true,
            can_stream_live: true,
            requested_organizer: true,
            is_tournament_match: true,
            min_players_per_lineup: true,
            max_players_per_lineup: true,
            map_veto_type: true,
            organizer: playerFields,
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
          },
        ],
      }),
      update: (data: any) => data.matches_by_pk,
    },
  },
  computed: {
    // Both halves presented as the single object the rest of the page (and
    // every child it feeds) already expects, so the split stops here.
    // `matchLive` gates it: until the subscription has said the match exists
    // there is nothing to show, and a null from it means the row is gone.
    match(): Record<string, any> | null | undefined {
      if (!this.matchLive) {
        return this.matchLive;
      }
      return { ...this.matchStatic, ...this.matchLive };
    },
    // Assigned on every tick before the split as well -- this keeps that
    // behaviour and simply picks the title back up once the static half,
    // which owns `label` and the tournament, has landed.
    matchContext(): Record<string, any> | null {
      if (!this.match) {
        return null;
      }
      const tournament = this.match.tournament_brackets?.[0]?.stage?.tournament;
      return {
        id: this.match.id,
        displayText:
          this.match.label ||
          `${this.match.lineup_1?.name ?? this.$t("common.tbd")} vs ${this.match.lineup_2?.name ?? this.$t("common.tbd")}`,
        ...(tournament
          ? { tournament: { id: tournament.id, name: tournament.name } }
          : {}),
      };
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
    // Shared with the sidebar and the pop-out, which offer the same team room.
    myLineupId() {
      return resolveMyLineupId(this.match, useAuthStore().me?.steam_id);
    },
    // Null once the match is over: the API closes the channel a few minutes
    // after that and stops admitting it, so a card here would offer a call that
    // cannot be joined -- and asking it for a roster is what used to make every
    // visit to a finished match log a membership failure.
    //
    // A call that is actually running is the exception. It outlives the match by
    // that same grace window, and taking its controls off the page the instant
    // the last round lands would leave people talking with no way to hang up.
    myVoiceLineupId() {
      const live = resolveMyVoiceLineupId(
        this.match,
        useAuthStore().me?.steam_id,
      );

      if (live) {
        return live;
      }

      return useActiveVoiceChannel().session.value?.id === this.myLineupId
        ? this.myLineupId
        : null;
    },
    // Null unless the inline chat is actually on screen, so neither being on
    // the page nor merely being allowed into the room is mistaken for reading
    // it.
    chatThread() {
      return this.match && this.canJoinLobby && this.inlineChatVisible
        ? chatThreadKey("match", this.match.id)
        : null;
    },
    // Whether this match asks this viewer for a camera at all. Deliberately
    // says nothing about whether one is currently live: the overlay stays
    // mounted either way so its status poll keeps running, which is the only
    // thing that notices a camera going down again.
    //
    // is_on_lineup is only true for a rostered player row, so the coach is
    // checked separately below.
    cameraRequiredOfMe() {
      if (!this.match?.options?.camera_required) {
        return false;
      }

      if (
        ![
          // Check-in is gated on a live camera server-side, so the overlay has
          // to be up by then or a player has no way to satisfy it.
          e_match_status_enum.WaitingForCheckIn,
          e_match_status_enum.Veto,
          e_match_status_enum.Live,
          e_match_status_enum.WaitingForServer,
        ].includes(this.match.status)
      ) {
        return false;
      }

      // Coaches too. They stand behind the team during a technical timeout and
      // are the one person on a side who can coach out loud without the server
      // seeing it, so the API mints them a token like anyone else.
      const mySteamId = useAuthStore().me?.steam_id;

      return !!(
        this.match.lineup_1?.is_on_lineup ||
        this.match.lineup_2?.is_on_lineup ||
        (mySteamId &&
          (this.match.lineup_1?.coach?.steam_id === mySteamId ||
            this.match.lineup_2?.coach?.steam_id === mySteamId))
      );
    },
    // The requirement is outstanding: asked of me, and not currently satisfied.
    // Drives the modal and the banner; the overlay itself stays mounted past it.
    cameraGateActive() {
      return this.cameraRequiredOfMe && !this.cameraReady;
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
  methods: {
    // Injected by the organizer controls, which change fields this half owns
    // and would otherwise not see their own edit until the next status change.
    refetchMatchStatic() {
      return this.$apollo?.queries?.matchStatic?.refetch();
    },
    // Tracks the camera both ways. It used to be a one-way latch -- the overlay
    // only ever announced going live -- so a player who closed their camera mid
    // match was left with no gate, no banner and no way back to the QR code.
    onCameraReadyChanged(ready: boolean) {
      // Losing the camera raises the modal again, dismissal or not: dismissing
      // it meant "this is in my way right now", not "I no longer need one", and
      // the requirement has just become unmet again.
      if (this.cameraReady && !ready) {
        this.cameraOverlayDismissed = false;
      }

      this.cameraReady = ready;
    },
    // Whether the inline chat is actually on screen. Being allowed into the
    // room is not reading it: the panel sits partway down a long page, and
    // stamping the cursor on the permission alone cleared the badge on every
    // device the moment the page loaded, and dropped the push for messages
    // nobody had seen.
    watchInlineChat() {
      this.inlineChatObserver?.disconnect();
      this.inlineChatObserver = null;

      const element = this.$refs.inlineChat as HTMLElement | undefined;

      if (!element || typeof IntersectionObserver === "undefined") {
        this.inlineChatVisible = false;
        return;
      }

      this.inlineChatObserver = markRaw(
        new IntersectionObserver((entries) => {
          this.inlineChatVisible = entries.some(
            ({ isIntersecting }) => isIntersecting,
          );
        }),
      );

      this.inlineChatObserver.observe(element);
    },
  },
};
</script>

<style scoped>
/* A map slot leaving (trailing placeholders when the match ends) or the veto
   picks panel toggling folds its height instead of vanishing in one frame. */
.map-slot-collapse {
  transition:
    grid-template-rows 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.11s ease-in;
}
.map-slot-collapse > * {
  overflow: hidden;
}
.map-slot-collapse-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .map-slot-collapse {
    transition-duration: 1ms;
  }
}
</style>
