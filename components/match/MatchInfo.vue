<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tv } from "lucide-vue-next";
import ClipBoard from "~/components/ClipBoard.vue";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchStatus from "~/components/match/MatchStatus.vue";
import ScheduleMatch from "~/components/match/ScheduleMatch.vue";
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import AssignCoachToLineup from "~/components/match/AssignCoachToLineup.vue";
</script>

<template>
  <Card>
    <CardHeader class="bg-muted/50">
      <CardTitle class="relative">
        <div class="flex">
          <match-status :match="match"></match-status>
          <clip-board
            :data="match.tv_connection_string"
            v-if="match.tv_connection_string"
          >
            <Tv></Tv>
          </clip-board>
        </div>

        <div class="flex py-2 items-center justify-between">
          <div class="flex flex-col space-y-2">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-semibold">{{ match.lineup_1.name }}</span>
                <span>
                  (<MatchLineupScoreDisplay
                    :match="match"
                    :lineup="match.lineup_1"
                  />)
                </span>
              </div>

              <span class="mx-2 text-muted-foreground">vs</span>

              <div>
                <span class="font-semibold">{{ match.lineup_2.name }}</span>

                <span>
                  (<MatchLineupScoreDisplay
                    :match="match"
                    :lineup="match.lineup_2"
                  />)
                </span>
              </div>
            </div>

            <div>
              <Badge variant="outline">
                {{ match.options.type }}
                <span
                  class="text-muted-foreground ml-1"
                  v-if="match.options.best_of > 1"
                >
                  across {{ match.options.best_of }} maps
                </span>
              </Badge>
            </div>
          </div>

          <MatchActions :match="match"></MatchActions>
        </div>

        <badge class="my-3" v-if="match.cancels_at"
          >Auto Canceling &nbsp; <TimeAgo :date="match.cancels_at"></TimeAgo>
        </badge>

        <template v-if="match.can_schedule">
          <ScheduleMatch :match="match"></ScheduleMatch>
        </template>
        <template v-else-if="match.can_start">
          <Button
            @click.prevent.stop="startMatch"
            class="-mr-2"
            :disabled="!hasMinimumLineupPlayers"
          >
            Start
            <template
              v-if="
                match.options.map_veto &&
                match.options.best_of != match.match_maps.length
              "
            >
              Veto
            </template>
            <template v-else> Match </template>
          </Button>
        </template>
      </CardTitle>
    </CardHeader>
    <CardContent class="p-6" v-if="match.options.coaches">
      <div class="space-y-4">
        <h3 class="font-semibold text-lg">Coaches</h3>
        <ul class="space-y-3">
          <li
            v-for="lineup in [match.lineup_1, match.lineup_2]"
            :key="lineup.name"
          >
            <div class="text-muted-foreground">{{ lineup.name }}</div>
            <PlayerDisplay v-if="lineup.coach" :player="lineup.coach" />

            <AssignCoachToLineup
              :lineup="lineup"
              :exclude="excludePlayers"
              v-if="lineup.can_update_lineup"
            ></AssignCoachToLineup>
          </li>
        </ul>
      </div>
    </CardContent>
  </Card>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  methods: {
    async startMatch() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          startMatch: [
            {
              match_id: this.match.id,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
  },
  computed: {
    hasMinimumLineupPlayers() {
      return (
        this.match.lineup_1?.lineup_players.length >=
          this.match.min_players_per_lineup &&
        this.match.lineup_2?.lineup_players.length >=
          this.match.min_players_per_lineup
      );
    },
    excludePlayers() {
      const players = [];

      players.push(...this.match.lineup_1.lineup_players);
      players.push(...this.match.lineup_2.lineup_players);

      if (this.match.lineup_1.coach) {
        players.push(this.match.lineup_1.coach);
      }

      if (this.match.lineup_2.coach) {
        players.push(this.match.lineup_2.coach);
      }

      return players;
    },
  },
};
</script>
