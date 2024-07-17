<script setup lang="ts">
import PlayerSearch from "~/components/PlayerSearch.vue";
</script>

<template>
  <div>
    Assign Players to {{ lineup.name }}

    <player-search
        label="Search for a player"
        :exclude="
              lineup.lineup_players.map(
                (player) => player.steam_id
              )
            "
        :team-id="lineup.team_id"
        @selected="
              (player) => addMember(player.steam_id)
            "
    ></player-search>
  </div>
</template>

<script lang="ts">
import {generateMutation} from "~/graphql/graphqlGen";
import getMatchLineups from "~/utilities/getMatchLineups";

export default {
  props: {
    lineup: {
      type: Object,
      required:true,
    }
  },
  methods: {
    async addMember(steam_id: bigint) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_match_lineup_players_one: [
            {
              object: {
                steam_id,
                match_lineup_id: this.lineup.id,
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
}
</script>