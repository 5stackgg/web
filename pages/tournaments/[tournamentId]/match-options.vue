<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
</script>

<template>
  <PageTransition :delay="0">
    <div v-if="tournament">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="icon" @click="$router.back()">
            <ArrowLeft class="h-4 w-4" />
          </Button>
          <h1 class="text-2xl font-bold">{{ $t("tournament.stage.match_options") }}</h1>
        </div>
      </div>
    </div>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <TournamentForm :tournament="tournament"></TournamentForm>
  </PageTransition>
</template>

<script lang="ts">
import { ArrowLeft } from "lucide-vue-next";
import TournamentForm from "~/components/tournament/TournamentForm.vue";
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { playerFields } from "~/graphql/playerFields";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";

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
              options: matchOptionsFields,
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
