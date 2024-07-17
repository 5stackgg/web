<script lang="ts" setup>
import PlayerSearch from "~/components/PlayerSearch.vue";
import MatchAssignCoach from "~/components/match/MatchAssignCoach.vue";
</script>
<template>
  <Card class="sm:col-span-2" v-if="assigningLineups">
    <CardHeader class="pb-3">
      <CardContent class="flex">
        <div>
          Assign Players to {{ matchLineups.lineup1.name }}

          <template v-if="canAddToLineup1">
            <player-search
                label="Search for a player"
                :exclude="
              matchLineups.lineup1.lineup_players.map(
                (player) => player.steam_id
              )
            "
                :team-id="matchLineups.lineup1.team_id"
                @selected="
              (player) => addMember(player.steam_id, matchLineups.lineup1.id)
            "
            ></player-search>
          </template>
          <template v-else> Team 1 Lineup setup. </template>
        </div>

        <div>
          <template v-if="canAddToLineup2">
            Assign Players to {{ matchLineups.lineup2.name }}

            <player-search
                label="Search for a player"
                :exclude="
              matchLineups.lineup2.lineup_players.map(
                (player) => player.steam_id
              )
            "
                :team-id="matchLineups.lineup2.team_id"
                @selected="
              (player) => addMember(player.steam_id, matchLineups.lineup2.id)
            "
            ></player-search>
          </template>
          <template v-else> Team 2 Lineup setup. </template>
        </div>
      </CardContent>
    </CardHeader>
  </Card>






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
              <AvatarFallback>{{
                  matchLineups.lineup1.coach.name
                }}</AvatarFallback>
            </Avatar>

            {{ matchLineups.lineup1.coach.name }}
          </div>

          <player-search
              label="Assign Coach"
              :exclude="
              matchLineups.lineup1.lineup_players.map(
                (player) => player.steam_id
              )
            "
              :team-id="matchLineups.lineup1.team_id"
              @selected="
              (player) => updateCoach(player.steam_id, matchLineups.lineup1.id)
            "
          ></player-search>
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
              <AvatarFallback>{{
                  matchLineups.lineup2.coach.name
                }}</AvatarFallback>
            </Avatar>

            {{ matchLineups.lineup2.coach.name }}
          </div>

          <player-search
              label="Assign Coach"
              :exclude="
              matchLineups.lineup2.lineup_players.map(
                (player) => player.steam_id
              )
            "
              :team-id="matchLineups.lineup2.team_id"
              @selected="
              (player) => updateCoach(player.steam_id, matchLineups.lineup2.id)
            "
          ></player-search>
        </CardDescription>
      </CardHeader>
    </Card>
  </template>


</template>

<script lang="ts">
import { e_match_types_enum } from "~/generated/zeus";
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
    me() {
      return useAuthStore().me;
    },
    assigningLineups() {
      const currentStatus = this.match.status;
      return (
          this.match.organizer_steam_id == this.me.steam_id &&
          (currentStatus == "Warmup" ||
              currentStatus == "PickingPlayers" ||
              currentStatus == "Scheduled") &&
          (this.canAddToLineup1 || this.canAddToLineup2)
      );
    },
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
