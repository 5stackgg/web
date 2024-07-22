<script setup lang="ts">
import TournamentTeamTable from "~/components/tournament/TournamentTeam.vue";
</script>
<template>
  <div v-if="team">
    <template v-if="team.team">
      <pre>{{ team.team.name }}</pre>
    </template>

    Tournament Roster

    <TournamentTeamTable :team="team"> </TournamentTeamTable>
  </div>
</template>

<script lang="ts">
import { $ } from "~/generated/zeus/index";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import tournamentTeamFields from "~/graphql/tournamentTeamFields";

export default {
  data() {
    return {
      team: undefined,
    };
  },
  apollo: {
    $subscribe: {
      tournament_teams_by_pk: {
        query: typedGql("subscription")({
          tournament_teams_by_pk: [
            {
              id: $("teamId", "uuid!"),
            },
            tournamentTeamFields,
          ],
        }),
        variables: function () {
          return {
            teamId: this.$route.params.teamId,
          };
        },
        result: function ({ data }) {
          this.team = data.tournament_teams_by_pk;
        },
      },
    },
  },
};
</script>
