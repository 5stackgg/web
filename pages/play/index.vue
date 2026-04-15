<script setup lang="ts">
import { ref } from "vue";
import { Settings2 } from "lucide-vue-next";
import MyUpcoming from "~/components/MyUpcoming.vue";
import Matchmaking from "~/components/matchmaking/Matchmaking.vue";
import MatchmakingSettings from "~/components/matchmaking/MatchmakingSettings.vue";
import OpenMatches from "~/components/match/OpenMatches.vue";
import CustomMatch from "~/components/CustomMatch.vue";
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
    <TacticalPageHeader>
      <template #title>{{ $t("pages.play.title") }}</template>
      <template v-if="matchmakingAllowed" #actions>
        <Popover v-model:open="settingsOpen">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              class="h-11 px-4 gap-2 bg-card/60 backdrop-blur"
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

  <PageTransition
    v-if="matchmakingAllowed || canCreateMatch"
    :delay="50"
    class="mt-6"
  >
    <div class="hidden md:block">
      <template v-if="matchmakingAllowed">
        <Matchmaking></Matchmaking>
      </template>
      <template v-else-if="canCreateMatch">
        <CustomMatch />
      </template>
    </div>
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

  <PageTransition :delay="300" class="mt-6">
    <div>
      <div :class="tacticalSectionLabelClasses">
        <span :class="tacticalSectionTickClasses"></span>
        OPEN.MATCHES
      </div>
      <div :class="tacticalSectionDescriptionClasses">
        {{ $t("pages.play.open_matches.description") }}
      </div>
      <OpenMatches />
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
    canCreateMatch() {
      return useApplicationSettingsStore().canCreateMatch;
    },
  },
};
</script>
