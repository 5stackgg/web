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
</script>

<template>
  <div v-if="match" class="flex flex-col gap-4 md:gap-6">
    <PageTransition>
      <header class="match-hero">
        <div class="match-hero__top">
          <span
            class="match-hero__status"
            :class="`match-hero__status--${statusTier}`"
          >
            <span class="match-hero__status-dot"></span>
            {{ match.e_match_status?.description || match.status }}
          </span>
          <span v-if="match.label" class="match-hero__label">
            {{ match.label }}
          </span>
          <NuxtLink
            v-if="tournamentContext"
            :to="`/tournaments/${tournamentContext.id}`"
            class="match-hero__tournament"
          >
            <span class="match-hero__tournament-chevron">◢</span>
            {{ tournamentContext.name }}
          </NuxtLink>

          <div class="match-hero__actions">
            <span
              v-if="showAutoCancel"
              class="match-hero__auto-cancel"
              :title="$t('match.auto_canceling')"
            >
              <AlertTriangle class="w-3 h-3" />
              <span>{{ $t("match.auto_canceling") }}</span>
              <TimeAgo :date="match.cancels_at" />
            </span>
            <MatchActions :match="match" />
          </div>
        </div>

        <div class="match-hero__matchup">
          <div class="match-hero__side match-hero__side--left">
            <span class="match-hero__side-label">Lineup 1</span>
            <div
              class="match-hero__team"
              :class="{
                'match-hero__team--winner':
                  match.winning_lineup_id === match.lineup_1_id,
              }"
            >
              <span class="match-hero__team-ghost" aria-hidden="true">
                {{ lineup1Name }}
              </span>
              <span class="match-hero__team-main">{{ lineup1Name }}</span>
            </div>
          </div>

          <div class="match-hero__center">
            <div v-if="hasScores" class="match-hero__scores">
              <span
                class="match-hero__score"
                :class="{
                  'match-hero__score--winner': mapScores.l1 > mapScores.l2,
                }"
              >
                {{ mapScores.l1 }}
              </span>
              <span class="match-hero__vs">VS</span>
              <span
                class="match-hero__score"
                :class="{
                  'match-hero__score--winner': mapScores.l2 > mapScores.l1,
                }"
              >
                {{ mapScores.l2 }}
              </span>
            </div>
            <span v-else class="match-hero__vs match-hero__vs--solo">VS</span>
          </div>

          <div class="match-hero__side match-hero__side--right">
            <span class="match-hero__side-label">Lineup 2</span>
            <div
              class="match-hero__team"
              :class="{
                'match-hero__team--winner':
                  match.winning_lineup_id === match.lineup_2_id,
              }"
            >
              <span class="match-hero__team-ghost" aria-hidden="true">
                {{ lineup2Name }}
              </span>
              <span class="match-hero__team-main">{{ lineup2Name }}</span>
            </div>
          </div>
        </div>

        <div class="match-hero__meta">
          <span v-if="match.options?.best_of" class="match-hero__meta-item">
            Best of {{ match.options.best_of }}
          </span>
          <span
            v-if="match.e_region?.description"
            class="match-hero__meta-dot"
            >·</span
          >
          <span
            v-if="match.e_region?.description"
            class="match-hero__meta-item"
          >
            {{ match.e_region.description }}
          </span>
          <span v-if="formattedSchedule" class="match-hero__meta-dot">·</span>
          <span v-if="formattedSchedule" class="match-hero__meta-item">
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

<style scoped>
.match-hero {
  position: relative;
  min-width: 0;
  max-width: 100%;
  padding: 1.25rem 1.5rem 1.5rem 1.5rem;
  border: 1px solid hsl(var(--border));
  background: linear-gradient(
    180deg,
    hsl(var(--card) / 0.55) 0%,
    hsl(var(--card) / 0.25) 100%
  );
  backdrop-filter: blur(6px);
  clip-path: polygon(
    0 0,
    calc(100% - 18px) 0,
    100% 18px,
    100% 100%,
    18px 100%,
    0 calc(100% - 18px)
  );
}
.match-hero::before,
.match-hero::after {
  content: "";
  position: absolute;
  width: 14px;
  height: 14px;
  border-color: hsl(var(--tac-amber));
  border-style: solid;
}
.match-hero::before {
  top: 8px;
  left: 8px;
  border-width: 2px 0 0 2px;
}
.match-hero::after {
  bottom: 8px;
  right: 8px;
  border-width: 0 2px 2px 0;
}

.match-hero__top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

.match-hero__status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.7rem;
  font-family: "Oxanium", monospace;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  border: 1px solid hsl(var(--border));
  border-radius: 0.25rem;
  background: hsl(var(--muted) / 0.3);
  color: hsl(var(--muted-foreground));
}
.match-hero__status-dot {
  width: 6px;
  height: 6px;
  background: currentColor;
  border-radius: 9999px;
}
.match-hero__status--live {
  background: hsl(var(--destructive) / 0.15);
  border-color: hsl(var(--destructive) / 0.6);
  color: hsl(var(--destructive));
}
.match-hero__status--pending {
  background: hsl(var(--tac-amber) / 0.12);
  border-color: hsl(var(--tac-amber) / 0.5);
  color: hsl(var(--tac-amber));
}
.match-hero__status--veto {
  background: hsl(var(--topnav-accent) / 0.15);
  border-color: hsl(var(--topnav-accent) / 0.5);
  color: hsl(var(--topnav-accent));
}
.match-hero__status--finished {
  background: hsl(var(--success) / 0.15);
  border-color: hsl(var(--success) / 0.5);
  color: hsl(var(--success));
}
.match-hero__status--ended {
  background: hsl(var(--muted) / 0.4);
  border-color: hsl(var(--border));
  color: hsl(var(--muted-foreground));
}

.match-hero__label {
  font-family: "Oxanium", monospace;
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

.match-hero__tournament {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: "Oxanium", monospace;
  font-size: 0.72rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
  transition: color 140ms ease;
}
.match-hero__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.match-hero__auto-cancel {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.7rem;
  font-family: "Oxanium", monospace;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  border: 1px solid hsl(var(--destructive) / 0.6);
  border-radius: 0.25rem;
  background: hsl(var(--destructive) / 0.15);
  color: hsl(var(--destructive));
}
.match-hero__tournament:hover {
  color: hsl(var(--tac-amber));
}
.match-hero__tournament-chevron {
  color: hsl(var(--tac-amber));
  font-size: 0.65rem;
}

/* Matchup row */
.match-hero__matchup {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1.5rem;
}

.match-hero__side {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}
.match-hero__side--left {
  text-align: left;
  align-items: flex-start;
}
.match-hero__side--right {
  text-align: right;
  align-items: flex-end;
}

.match-hero__side-label {
  font-family: "Oxanium", monospace;
  font-size: 0.6rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground) / 0.7);
}

.match-hero__team {
  position: relative;
  font-family: "Oxanium", sans-serif;
  font-weight: 700;
  font-stretch: 80%;
  font-size: clamp(1.5rem, 3.5vw, 2.75rem);
  line-height: 0.95;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  min-width: 0;
  max-width: 100%;
}
.match-hero__team-main {
  position: relative;
  color: hsl(var(--foreground));
  background: linear-gradient(
    180deg,
    hsl(var(--foreground)) 0%,
    hsl(var(--foreground) / 0.7) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.match-hero__team-ghost {
  position: absolute;
  left: 4px;
  top: 4px;
  right: -4px;
  white-space: nowrap;
  overflow: hidden;
  color: transparent;
  -webkit-text-stroke: 1px hsl(var(--tac-amber) / 0.3);
  pointer-events: none;
  user-select: none;
}
.match-hero__team--winner .match-hero__team-main {
  background: linear-gradient(
    180deg,
    hsl(var(--tac-amber)) 0%,
    hsl(var(--tac-amber)) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Center: scores or VS */
.match-hero__center {
  display: flex;
  align-items: center;
  justify-content: center;
}
.match-hero__scores {
  display: inline-flex;
  align-items: center;
  gap: 1rem;
}
.match-hero__score {
  font-family: "Oxanium", sans-serif;
  font-weight: 800;
  font-stretch: 80%;
  font-size: clamp(2.5rem, 5vw, 4rem);
  line-height: 1;
  color: hsl(var(--muted-foreground) / 0.6);
  font-variant-numeric: tabular-nums;
  transition: color 200ms ease;
}
.match-hero__score--winner {
  color: hsl(var(--tac-amber));
  text-shadow: 0 0 18px hsl(var(--tac-amber) / 0.35);
}
.match-hero__vs {
  font-family: "Oxanium", monospace;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: hsl(var(--muted-foreground));
  padding: 0.35rem 0.6rem;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card) / 0.5);
}
.match-hero__vs--solo {
  font-size: 1rem;
  padding: 0.6rem 1rem;
}

/* Meta */
.match-hero__meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 1rem;
  padding-top: 0.85rem;
  border-top: 1px solid hsl(var(--border));
  font-family: "Oxanium", monospace;
  font-size: 0.72rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
.match-hero__meta-dot {
  opacity: 0.4;
}

@media (max-width: 640px) {
  .match-hero {
    padding: 1rem;
  }
  .match-hero__top {
    margin-bottom: 0.85rem;
  }
  .match-hero__tournament {
    margin-left: 0;
    width: 100%;
  }
  .match-hero__matchup {
    gap: 0.75rem;
  }
}
</style>
