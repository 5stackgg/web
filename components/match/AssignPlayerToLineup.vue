<script setup lang="ts">
import PlayerSearch from "~/components/PlayerSearch.vue";
</script>

<template>
  <PlayerSearch
    :label="$t('match.player.assign_slot')"
    :ineligible="ineligible"
    :team-id="lineup.team_id"
    :self="true"
    @selected="(player) => addMember(player.steam_id)"
  >
    <template v-if="$slots.default" #default>
      <slot />
    </template>
  </PlayerSearch>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    lineup: {
      type: Object,
      required: true,
    },
    matchId: {
      type: String,
      required: true,
    },
    ineligible: {
      type: Object as () => Record<string, string>,
      required: false,
      default: () => ({}),
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
