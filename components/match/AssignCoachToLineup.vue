<script lang="ts" setup>
import PlayerSearch from "~/components/PlayerSearch.vue";
</script>

<template>
  <player-search
      label="Assign Coach"
      :exclude="
                lineup.lineup_players.map(
                  (player) => player.steam_id
                )
              "
      :team-id="lineup.team_id"
      @selected="
                (player) => updateCoach(player.steam_id, lineup.id)
              "
  ></player-search>
</template>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";
import { generateMutation } from "~/graphql/graphqlGen";
import getMatchLineups from "~/utilities/getMatchLineups";

export default {
  props: {
    lineup: {
      type: Object,
      required: true,
    },
  },
  methods: {
    async updateCoach(steam_id: bigint) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_match_lineups_by_pk: [
            {
              pk_columns: {
                id: this.lineup.id,
              },
              _set: {
                coach_steam_id: steam_id,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    matchLineups() {
      return getMatchLineups(this.match);
    },
  },
};
</script>
