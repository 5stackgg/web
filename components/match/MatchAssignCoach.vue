<script lang="ts" setup>
import PlayerSearch from "~/components/PlayerSearch.vue";
</script>

<template>
  <template v-if="match.coaches && (canUpdateLineup1 || canUpdateLineup2)">
    <Card class="sm:col-span-2" v-if="canUpdateLineup1">
      <CardHeader class="pb-3">
        <CardTitle>Assign Coach for {{ matchLineups.lineup1.name }}</CardTitle>
        <CardDescription>
          <div v-if="matchLineups.lineup1.coach">
              <Avatar>
                <AvatarImage
                    :src="matchLineups.lineup1.coach.avatar_url"
                    :alt="matchLineups.lineup1.coach.name"
                />
                <AvatarFallback>{{ matchLineups.lineup1.coach.name }}</AvatarFallback>
              </Avatar>

              {{ matchLineups.lineup1.coach.name }}
          </div>

          <player-search label="Assign Coach" :exclude="matchLineups.lineup1.lineup_players.map((player) => player.steam_id)" :team-id="matchLineups.lineup1.team_id" @selected="(player) => updateCoach(player.steam_id, matchLineups.lineup1.id)"></player-search>
        </CardDescription>
      </CardHeader>
    </Card>

    <Card class="sm:col-span-2" v-if="canUpdateLineup2">
      <CardHeader class="pb-3">
        <CardTitle>Assign Coach for {{ matchLineups.lineup2.name }}</CardTitle>
        <CardDescription>
          <div v-if="matchLineups.lineup2.coach">
            <Avatar>
              <AvatarImage
                  :src="matchLineups.lineup2.coach.avatar_url"
                  :alt="matchLineups.lineup2.coach.name"
              />
              <AvatarFallback>{{ matchLineups.lineup2.coach.name }}</AvatarFallback>
            </Avatar>

            {{ matchLineups.lineup2.coach.name }}
          </div>

          <player-search label="Assign Coach" :exclude="matchLineups.lineup2.lineup_players.map((player) => player.steam_id)" :team-id="matchLineups.lineup2.team_id" @selected="(player) => updateCoach(player.steam_id, matchLineups.lineup2.id)"></player-search>
        </CardDescription>
      </CardHeader>
    </Card>
  </template>
</template>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";
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
    async updateCoach(steam_id: bigint, match_lineup_id: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_match_lineups_by_pk: [
            {
              pk_columns: {
                id: match_lineup_id,
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
    canUpdateLineup1() {
      return (
        this.match.organizer_steam_id === this.me.steam_id ||
        this.matchLineups.lineup1.captain.player.steam_id === this.me.steam_id
      );
    },
    canUpdateLineup2() {
      return (
        this.match.organizer_steam_id === this.me.steam_id ||
        this.matchLineups.lineup2.captain.player.steam_id === this.me.steam_id
      );
    },
  },
};
</script>
