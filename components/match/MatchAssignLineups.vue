<script lang="ts" setup>

import PlayerSearch from "~/components/PlayerSearch.vue";
</script>
<template>
  <Card class="sm:col-span-2">
    <CardHeader class="pb-3">
      <CardTitle>Assign Players to {{ matchLineups.lineup1.name }}</CardTitle>
      <CardDescription>
        <template v-if="canAddToLineup1">
          <player-search label="Search for a player" :exclude="matchLineups.lineup1.lineup_players.map((player) => player.steam_id)" :team-id="matchLineups.lineup1.team_id" @selected="(player) => addMember(player.steam_id, matchLineups.lineup1.id)"></player-search>
        </template>
        <template v-else> Team 1 Lineup setup. </template>
      </CardDescription>
    </CardHeader>
  </Card>

  <Card class="sm:col-span-2">
    <CardHeader class="pb-3">
      <CardTitle>Assign Players to {{ matchLineups.lineup2.name }}</CardTitle>
      <CardDescription>
        <template v-if="canAddToLineup2">
          <player-search label="Search for a player" :exclude="matchLineups.lineup2.lineup_players.map((player) => player.steam_id)" :team-id="matchLineups.lineup2.team_id" @selected="(player) => addMember(player.steam_id, matchLineups.lineup2.id)"></player-search>
        </template>
        <template v-else> Team 2 Lineup setup. </template>
      </CardDescription>
    </CardHeader>
  </Card>
</template>

<script lang="ts">
import {e_match_types_enum} from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import getMatchLineups from "~/utilities/getMatchLineups";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  methods: {
    async addMember(steam_id: bigint, match_lineup_id: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_match_lineup_players_one: [
            {
              object: {
                steam_id,
                match_lineup_id,
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
    matchLineups() {
      return getMatchLineups(this.match);
    },
    maxPlayersPerLineup() {
      return (
        (this.match?.type === e_match_types_enum.Wingman ? 2 : 5) +
        this.match.number_of_substitutes
      );
    },
    canAddToLineup1() {
      return (
        this.matchLineups.lineup1?.lineup_players.length <
        this.maxPlayersPerLineup
      );
    },
    canAddToLineup2() {
      return (
        this.matchLineups.lineup2?.lineup_players.length <
        this.maxPlayersPerLineup
      );
    },
  },
};
</script>
