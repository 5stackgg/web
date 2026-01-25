<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
</script>

<template>
  <div v-if="tournament">
    <PageTransition :delay="0">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="icon" @click="$router.back()">
            <ArrowLeft class="h-4 w-4" />
          </Button>
          <h1 class="text-2xl font-bold">Match Options</h1>
        </div>
      </div>
    </PageTransition>

    <PageTransition :delay="100">
      <AnimatedCard variant="gradient" class="p-6">
        <TournamentForm :tournament="tournament"></TournamentForm>
      </AnimatedCard>
    </PageTransition>
  </div>
</template>

<script lang="ts">
import { ArrowLeft } from "lucide-vue-next";
import TournamentForm from "~/components/tournament/TournamentForm.vue";
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { playerFields } from "~/graphql/playerFields";
import { mapFields } from "~/graphql/mapGraphql";

export default {
  components: {
    ArrowLeft,
    TournamentForm,
  },
  data() {
    return {
      tournament: null,
    };
  },
  apollo: {
    $subscribe: {
      tournaments_by_pk: {
        query: typedGql("subscription")({
          tournaments_by_pk: [
            {
              id: $("tournamentId", "uuid!"),
            },
            {
              id: true,
              name: true,
              start: true,
              status: true,
              e_tournament_status: {
                description: true,
              },
              description: true,
              is_organizer: true,
              can_join: true,
              can_cancel: true,
              can_open_registration: true,
              can_close_registration: true,
              min_players_per_lineup: true,
              max_players_per_lineup: true,
              admin: playerFields,
              options: {
                id: true,
                type: true,
                mr: true,
                map_veto: true,
                coaches: true,
                knife_round: true,
                overtime: true,
                region_veto: true,
                best_of: true,
                tv_delay: true,
                number_of_substitutes: true,
                timeout_setting: true,
                tech_timeout_setting: true,
                ready_setting: true,
                map_pool: [
                  {},
                  {
                    id: true,
                    type: true,
                    e_type: {
                      description: true,
                    },
                    maps: [{}, mapFields],
                  },
                ],
              },
            },
          ],
        }),
        variables() {
          return {
            tournamentId: this.$route.params.tournamentId,
          };
        },
        result({ data }) {
          this.tournament = data.tournaments_by_pk;
        },
      },
    },
  },
};
</script>
