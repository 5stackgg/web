<template>
  <div v-if="tournament">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="icon" @click="$router.back()">
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <h1 class="text-2xl font-bold">Tournament Organizers</h1>
      </div>
    </div>

    <TournamentOrganizers :tournament="tournament"></TournamentOrganizers>
  </div>
</template>

<script lang="ts">
import { ArrowLeft } from "lucide-vue-next";
import TournamentOrganizers from "~/components/tournament/TournamentOrganizers.vue";
import { $, e_tournament_status_enum, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { playerFields } from "~/graphql/playerFields";

interface Tournament {
  id: string;
  name: string;
  start: string;
  status: e_tournament_status_enum;
  e_tournament_status: {
    description: string;
  };
  description?: string;
  is_organizer: boolean;
  can_join: boolean;
  can_cancel: boolean;
  can_open_registration: boolean;
  can_close_registration: boolean;
  min_players_per_lineup: number;
  max_players_per_lineup: number;
  admin: any;
  organizers: Array<{
    organizer: any;
  }>;
}

export default {
  components: {
    ArrowLeft,
    TournamentOrganizers,
  },
  data() {
    return {
      tournament: undefined as Tournament | undefined,
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
              can_start: true,
              can_cancel: true,
              can_open_registration: true,
              can_close_registration: true,
              min_players_per_lineup: true,
              max_players_per_lineup: true,
              admin: playerFields,
              organizers: [
                {},
                {
                  organizer: playerFields,
                },
              ],
            },
          ],
        }),
        variables() {
          return {
            tournamentId: this.$route.params.tournamentId,
          };
        },
        result({ data }: { data: { tournaments_by_pk: Tournament } }) {
          this.tournament = data.tournaments_by_pk;
        },
      },
    },
  },
};
</script>
