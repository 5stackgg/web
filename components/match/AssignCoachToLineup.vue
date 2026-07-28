<script lang="ts" setup>
import PlayerSearch from "~/components/PlayerSearch.vue";
</script>

<template>
  <PlayerSearch
    :label="$t('match.coach.assign')"
    :ineligible="ineligible"
    :team-id="lineup.team_id"
    @selected="(player) => updateCoach(player.steam_id, lineup.id)"
  ></PlayerSearch>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    lineup: {
      type: Object,
      required: true,
    },
    ineligible: {
      type: Object as () => Record<string, string>,
      required: false,
      default: () => ({}),
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
