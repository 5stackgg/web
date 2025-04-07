<script lang="ts" setup>
import PlayerSearch from "~/components/PlayerSearch.vue";
</script>

<template>
  <player-search
    :label="$t('match.coach.assign')"
    :exclude="exclude.map((player) => player.steam_id)"
    :team-id="lineup.team_id"
    @selected="(player) => updateCoach(player.steam_id, lineup.id)"
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
};
</script>
