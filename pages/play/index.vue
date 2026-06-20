<script setup lang="ts">
import { ref } from "vue";
import { Settings2, Lock } from "lucide-vue-next";
import DraftGames from "~/components/draft-games/DraftGames.vue";
import MyUpcoming from "~/components/MyUpcoming.vue";
import Matchmaking from "~/components/matchmaking/Matchmaking.vue";
import MatchmakingSettings from "~/components/matchmaking/MatchmakingSettings.vue";
import TournamentTableRow from "~/components/tournament/TournamentTableRow.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  tacticalSectionDescriptionClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const settingsOpen = ref(false);
</script>

<template>
  <PageTransition>
    <TacticalPageHeader inline-actions>
      <template #title>{{ $t("pages.play.title") }}</template>
      <template v-if="matchmakingAllowed && !inLobbyNotLeader" #actions>
        <Popover v-model:open="settingsOpen">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              class="!py-0 h-[clamp(1.75rem,4.2vw,3rem)] gap-2 px-4 max-sm:aspect-square max-sm:!px-0 bg-card/60 backdrop-blur"
              :class="{
                'border-[hsl(var(--tac-amber)/0.55)] text-[hsl(var(--tac-amber))]':
                  settingsOpen,
              }"
            >
              <Settings2 class="w-4 h-4" />
              <span class="hidden sm:inline">
                {{ $t("matchmaking.settings_section.toggle") }}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            class="w-[min(92vw,520px)] origin-top-right p-4"
          >
            <div class="flex items-center justify-between mb-3">
              <h4
                class="font-mono text-xs tracking-[0.24em] uppercase text-muted-foreground"
              >
                {{ $t("pages.settings.matchmaking.title") }}
              </h4>
            </div>
            <MatchmakingSettings />
          </PopoverContent>
        </Popover>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition v-if="matchmakingAllowed" :delay="50" class="mt-6">
    <div class="hidden md:block">
      <div :class="tacticalSectionLabelClasses">
        <span :class="tacticalSectionTickClasses"></span>
        MATCHMAKING
      </div>
      <div :class="tacticalSectionDescriptionClasses">
        {{ $t("pages.play.matchmaking.description") }}
      </div>

      <div class="relative mt-4">
        <div
          :class="{
            'pointer-events-none select-none opacity-40 blur-[1px]':
              inLobbyNotLeader,
          }"
        >
          <Matchmaking></Matchmaking>
        </div>
        <div
          v-if="inLobbyNotLeader"
          class="absolute inset-0 z-10 grid place-items-center rounded-lg bg-background/40"
        >
          <div
            class="flex items-center gap-2 rounded-full border border-border bg-card/95 px-4 py-2 shadow-lg"
          >
            <Lock class="h-3.5 w-3.5 text-muted-foreground" />
            <span class="text-xs font-medium text-foreground">
              {{ $t("pages.play.matchmaking.leader_required") }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </PageTransition>

  <PageTransition :delay="75" class="mt-6">
    <DraftGames />
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <MyUpcoming></MyUpcoming>
  </PageTransition>

  <PageTransition
    v-if="openRegistrationTournaments?.length > 0"
    :delay="200"
    class="mt-6"
  >
    <div>
      <div :class="tacticalSectionLabelClasses">
        <span :class="tacticalSectionTickClasses"></span>
        TOURNAMENT.REGISTRATION
      </div>
      <div :class="tacticalSectionDescriptionClasses">
        {{ $t("pages.play.open_registration_tournaments.description") }}
      </div>
      <div class="space-y-3">
        <TournamentTableRow
          v-for="tournament of openRegistrationTournaments"
          :key="tournament.id"
          :tournament="tournament"
        ></TournamentTableRow>
      </div>
    </div>
  </PageTransition>
</template>

<script lang="ts">
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { mapFields } from "~/graphql/mapGraphql";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";

export default {
  data() {
    return {
      page: 1,
      perPage: 10,
      openRegistrationTournaments: [],
    };
  },
  apollo: {
    $subscribe: {
      openRegistrationTournaments: {
        query: typedGql("subscription")({
          tournaments: [
            {
              where: {
                status: {
                  _eq: e_tournament_status_enum.RegistrationOpen,
                },
                _not: {
                  rosters: {
                    player_steam_id: {
                      _eq: $("steam_id", "bigint!"),
                    },
                  },
                },
              },
              order_by: [
                {},
                {
                  start: order_by.asc,
                },
              ],
            },
            simpleTournamentFields,
          ],
        }),
        variables: function () {
          return {
            steam_id: useAuthStore().me?.steam_id,
          };
        },
        result({ data }: { data: { tournaments: any[] } }) {
          this.openRegistrationTournaments = data.tournaments;
        },
        skip: function () {
          return !useAuthStore().me?.steam_id;
        },
      },
    },
  },
  computed: {
    showSeparators() {
      return useApplicationSettingsStore().showSeparators;
    },
    me() {
      return useAuthStore().me;
    },
    regions() {
      return useApplicationSettingsStore().availableRegions;
    },
    matchmakingAllowed() {
      return useApplicationSettingsStore().matchmakingAllowed;
    },
    currentLobby() {
      return useMatchmakingStore().currentLobby;
    },
    isPartyLeader() {
      const lobby = this.currentLobby as any;
      if (!lobby) {
        return true;
      }
      const me = lobby.players?.find((p: any) => {
        return p.player.steam_id === this.me?.steam_id;
      });
      return !!me?.captain;
    },
    inLobbyNotLeader() {
      return !!this.currentLobby && !this.isPartyLeader;
    },
  },
};
</script>
