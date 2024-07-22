<script setup lang="ts">
import TournamentTeamTable from "~/components/tournament/TournamentTeamTable.vue";
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
            {
              id: true,
              name: true,
              team: {
                name: true,
              },
              roster: [
                {},
                {
                  player: {
                    name: true,
                    steam_id: true,
                    avatar_url: true,
                  },
                },
              ],
              // matches: [{}, matchFields],
            },
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
