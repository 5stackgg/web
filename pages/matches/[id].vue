<script setup lang="ts">
import MatchTabs from "~/components/match/MatchTabs.vue";
import MatchMaps from "~/components/match/MatchMaps.vue";
import MatchInfo from "~/components/match/MatchInfo.vue";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchRegionVeto from "~/components/match/MatchRegionVeto.vue";
import { e_match_status_enum } from "~/generated/zeus";
import MatchMapVeto from "~/components/match/MatchMapVeto.vue";
import StreamEmbed from "~/components/StreamEmbed.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { CardContent } from "~/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "~/components/ui/alert";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { AlertTriangle } from "lucide-vue-next";

const heroClasses =
  "relative min-w-0 max-w-full px-6 pt-5 pb-6 max-sm:p-4 border border-border [background:linear-gradient(180deg,hsl(var(--card)/0.55)_0%,hsl(var(--card)/0.25)_100%)] backdrop-blur-[6px] [clip-path:polygon(0_0,calc(100%-18px)_0,100%_18px,100%_100%,18px_100%,0_calc(100%-18px))] before:content-[''] before:absolute before:w-[14px] before:h-[14px] before:border-[hsl(var(--tac-amber))] before:border-solid before:top-2 before:left-2 before:border-t-2 before:border-l-2 after:content-[''] after:absolute after:w-[14px] after:h-[14px] after:border-[hsl(var(--tac-amber))] after:border-solid after:bottom-2 after:right-2 after:border-b-2 after:border-r-2";

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
  "relative font-sans font-bold [font-stretch:80%] text-[clamp(1.5rem,3.5vw,2.75rem)] leading-[0.95] tracking-[0.02em] uppercase min-w-0 max-w-full";

const teamMainClasses =
  "relative bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent";

const teamMainWinnerClasses =
  "from-[hsl(var(--tac-amber))] to-[hsl(var(--tac-amber))]";

const teamGhostClasses =
  "absolute left-1 top-1 -right-1 whitespace-nowrap overflow-hidden text-transparent [-webkit-text-stroke:1px_hsl(var(--tac-amber)/0.3)] pointer-events-none select-none";

const scoreClasses =
  "font-sans font-extrabold [font-stretch:80%] text-[clamp(2.5rem,5vw,4rem)] leading-none text-[hsl(var(--muted-foreground)/0.6)] [font-variant-numeric:tabular-nums] transition-colors duration-200 ease";

const vsBaseClasses =
  "font-mono text-[0.8rem] font-bold tracking-[0.3em] text-muted-foreground px-[0.6rem] py-[0.35rem] border border-border bg-[hsl(var(--card)/0.5)]";
</script>

<template>
  <div v-if="match" class="flex flex-col gap-4 md:gap-6">
    <PageTransition>
      <header :class="heroClasses">
        <div
          class="flex items-center gap-3 flex-wrap mb-5 max-sm:mb-[0.85rem]"
        >
          <span
            :class="[
              statusBaseClasses,
              statusTierClasses[statusTier] || statusTierClasses.neutral,
            ]"
          >
            <span class="w-[6px] h-[6px] bg-current rounded-full"></span>
            {{ match.e_match_status?.description || match.status }}
          </span>
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
              v-if="match.server_error"
              class="inline-flex items-center gap-[0.4rem] px-[0.7rem] py-[0.3rem] font-mono text-[0.68rem] font-bold tracking-[0.15em] uppercase border border-[hsl(var(--destructive)/0.6)] rounded bg-[hsl(var(--destructive)/0.15)] text-destructive"
              :title="match.server_error"
            >
              <AlertTriangle class="w-3 h-3" />
              <span>{{ $t("match.server_error.short_label") }}</span>
            </span>
            <span
              v-if="showAutoCancel"
              class="inline-flex items-center gap-[0.4rem] px-[0.7rem] py-[0.3rem] font-mono text-[0.68rem] font-bold tracking-[0.15em] uppercase border border-[hsl(var(--destructive)/0.6)] rounded bg-[hsl(var(--destructive)/0.15)] text-destructive"
              :title="$t('match.auto_canceling')"
            >
              <AlertTriangle class="w-3 h-3" />
              <span>{{ $t("match.auto_canceling") }}</span>
              <TimeAgo :date="match.cancels_at" />
            </span>
            <MatchActions :match="match" />
          </div>
        </div>

        <div
          class="grid grid-cols-[1fr_auto_1fr] items-center gap-6 max-sm:gap-3"
        >
          <div
            class="flex flex-col gap-[0.35rem] min-w-0 text-left items-start"
          >
            <span
              class="font-mono text-[0.6rem] tracking-[0.28em] uppercase text-muted-foreground/70"
            >
              Lineup 1
            </span>
            <div
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

          <div class="flex items-center justify-center">
            <div
              v-if="hasScores"
              class="inline-flex items-center gap-4"
            >
              <span
                :class="[
                  scoreClasses,
                  mapScores.l1 > mapScores.l2 &&
                    '!text-[hsl(var(--tac-amber))] [text-shadow:0_0_18px_hsl(var(--tac-amber)/0.35)]',
                ]"
              >
                {{ mapScores.l1 }}
              </span>
              <span :class="vsBaseClasses">VS</span>
              <span
                :class="[
                  scoreClasses,
                  mapScores.l2 > mapScores.l1 &&
                    '!text-[hsl(var(--tac-amber))] [text-shadow:0_0_18px_hsl(var(--tac-amber)/0.35)]',
                ]"
              >
                {{ mapScores.l2 }}
              </span>
            </div>
            <span v-else :class="[vsBaseClasses, 'text-base px-4 py-[0.6rem]']">VS</span>
          </div>

          <div
            class="flex flex-col gap-[0.35rem] min-w-0 text-right items-end"
          >
            <span
              class="font-mono text-[0.6rem] tracking-[0.28em] uppercase text-muted-foreground/70"
            >
              Lineup 2
            </span>
            <div
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
        </div>

        <div
          class="flex items-center gap-[0.6rem] justify-center flex-wrap mt-4 pt-[0.85rem] border-t border-border font-mono text-[0.72rem] tracking-[0.15em] uppercase text-muted-foreground"
        >
          <span v-if="match.options?.best_of">
            Best of {{ match.options.best_of }}
          </span>
          <span v-if="match.e_region?.description" class="opacity-40">·</span>
          <span v-if="match.e_region?.description">
            {{ match.e_region.description }}
          </span>
          <span v-if="formattedSchedule" class="opacity-40">·</span>
          <span v-if="formattedSchedule">
            {{ formattedSchedule }}
          </span>
        </div>
      </header>
    </PageTransition>

  <div
    class="grid items-start gap-4 md:gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-[minmax(320px,_400px)_minmax(0,1fr)]"
  >
    <div class="grid grid-cols-1 gap-y-4 md:gap-y-6 min-w-0">
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
          v-if="
            match.options.best_of &&
            match.options.best_of > 0 &&
            match.status !== e_match_status_enum.Veto
          "
          class="flex flex-col gap-3"
        >
          <div v-for="(slot, index) in mapSlots" :key="index">
            <MatchMaps v-if="slot" :match="match" :match-map="slot"></MatchMaps>
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
        </div>
      </PageTransition>
    </div>

    <div class="min-w-0">
      <PageTransition>
        <StreamEmbed
          v-if="showLiveStreams && match.streams.length > 0"
          :streams="match.streams"
          class="pb-6 max-w-[1500px] w-full overflow-x-auto"
        />
      </PageTransition>

      <PageTransition :delay="100">
        <Alert
          v-if="showServerErrorAlert"
          variant="destructive"
          class="bg-red-600 text-white max-w-md mb-6"
        >
          <AlertTriangle class="h-4 w-4" />
          <AlertTitle>{{ $t("match.server_error.title") }}</AlertTitle>
          <AlertDescription class="whitespace-pre-wrap break-words">
            {{ match.server_error }}
          </AlertDescription>
        </Alert>
      </PageTransition>

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
        <CardContent class="p-4">
          <MatchTabs :match="match"></MatchTabs>
        </CardContent>
      </PageTransition>
    </div>
    </div>
  </div>
</template>

<script lang="ts">
import { $, order_by, e_match_status_enum } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { mapFields } from "~/graphql/mapGraphql";
import { matchLineups } from "~/graphql/matchLineupsGraphql";
import { playerFields } from "~/graphql/playerFields";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import { useMatchContext } from "~/composables/useMatchContext";

export default {
  unmounted() {
    useMatchContext().value = null;
  },
  data() {
    return {
      match: undefined,
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
            order_by_round: order_by.asc,
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
              invite_code: true,
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
                    size: true,
                    download_url: true,
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
                      lineup_1_side: true,
                      lineup_2_side: true,
                      winning_side: true,
                      has_backup_file: true,
                      round: true,
                      kills: [
                        {
                          order_by: {
                            time: $("order_by_round_kills", "order_by"),
                          },
                        },
                        {
                          player: {
                            steam_id: true,
                          },
                          attacked_player: {
                            steam_id: true,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
              lineup_1: [{}, matchLineups],
              lineup_2: [{}, matchLineups],
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
                  link: true,
                  title: true,
                  priority: true,
                },
              ],
            },
          ],
        }),
        result: function ({ data }) {
          const match = data.matches_by_pk;

          if (!match) {
            this.match = null;
            useMatchContext().value = null;
            navigateTo("/watch");
            return;
          }

          this.match = match;

          const mc = useMatchContext();
          const displayText =
            match.label ||
            `${match.lineup_1?.name ?? "TBD"} vs ${match.lineup_2?.name ?? "TBD"}`;
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
    lineup1Name() {
      return this.match?.lineup_1?.name || "Lineup 1";
    },
    lineup2Name() {
      return this.match?.lineup_2?.name || "Lineup 2";
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
    showServerErrorAlert() {
      if (!this.match?.server_error) {
        return false;
      }
      const visibleStatuses = [
        e_match_status_enum.Scheduled,
        e_match_status_enum.WaitingForCheckIn,
        e_match_status_enum.WaitingForServer,
        e_match_status_enum.Veto,
        e_match_status_enum.PickingPlayers,
        e_match_status_enum.Live,
      ];
      return visibleStatuses.includes(this.match.status);
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
    mapSlots() {
      if (!this.match || !this.match.options?.best_of) {
        return this.match?.match_maps ?? [];
      }

      const slots = [];
      const bestOf = this.match.options.best_of;
      const maps = this.match.match_maps || [];

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

