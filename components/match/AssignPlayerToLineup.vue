<script setup lang="ts">
import PlayerSearch from "~/components/PlayerSearch.vue";
</script>

<template>
  <player-search
    :label="$t('match.player.assign_slot')"
    :exclude="exclude.map((player) => player.steam_id)"
    :team-id="lineup.team_id"
    :self="true"
    @selected="(player) => addMember(player.steam_id)"
  ></player-search>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    lineup: {
      type: Object,
      required: true,
    },
    exclude: {
      type: Array,
      required: true,
      default: [],
    },
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
};
</script>
