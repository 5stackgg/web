<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tv } from "lucide-vue-next";
import ClipBoard from "~/components/ClipBoard.vue";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchStatus from "~/components/match/MatchStatus.vue";
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import AssignCoachToLineup from "~/components/match/AssignCoachToLineup.vue";
import { e_match_status_enum } from "~/generated/zeus";
</script>

<template>
  <Card>
    <CardHeader class="bg-muted/50">
      <CardTitle>
        <div class="flex items-center">
          <MatchStatus :match="match" />
          <ClipBoard
            v-if="match.tv_connection_string"
            :data="match.tv_connection_string"
            class="flex items-center"
          >
            <Tv class="h-4 w-4 mr-2" />
          </ClipBoard>
        </div>

        <div class="flex justify-between items-center">
          <div class="flex gap-1">
            {{ match.options.type }}
            <Badge class="text-xs">
              {{ $t("match.best_of", { count: match.options.best_of }) }}
            </Badge>
          </div>

          <MatchActions :match="match" />
        </div>
      </CardTitle>
    </CardHeader>
    <CardContent class="p-4">
      <div
        class="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-4"
      >
        <div
          class="flex flex-col items-center md:items-start space-y-2 md:w-2/5"
        >
          <span
            class="font-semibold text-center md:text-left truncate w-full"
            >{{ match.lineup_1.name }}</span
          >
          <span class="text-muted-foreground">
            (<MatchLineupScoreDisplay
              :match="match"
              :lineup="match.lineup_1"
            />)
          </span>
        </div>

        <span class="text-muted-foreground">{{ $t("match.vs") }}</span>

        <div class="flex flex-col items-center md:items-end space-y-2 md:w-2/5">
          <span
            class="font-semibold text-center md:text-right truncate w-full"
            >{{ match.lineup_2.name }}</span
          >
          <span class="text-muted-foreground">
            (<MatchLineupScoreDisplay
              :match="match"
              :lineup="match.lineup_2"
            />)
          </span>
        </div>
      </div>

      <div
        class="mt-4 flex flex-wrap justify-center md:justify-end space-x-4"
        v-if="match.cancels_at && match.status !== e_match_status_enum.Canceled"
      >
        <Badge variant="destructive" class="flex items-center mb-2 md:mb-0">
          <span class="mr-2">{{ $t("match.auto_canceling") }}</span>
          <TimeAgo :date="match.cancels_at" />
        </Badge>
      </div>
    </CardContent>

    <CardContent v-if="match.options.coaches">
      <h3 class="font-semibold text-lg mb-4">{{ $t("match.coaches") }}</h3>
      <ul class="space-y-6">
        <li
          v-for="lineup in [match.lineup_1, match.lineup_2]"
          :key="lineup.name"
        >
          <div class="text-muted-foreground mb-2">{{ lineup.name }}</div>
          <PlayerDisplay v-if="lineup.coach" :player="lineup.coach" />
          <AssignCoachToLineup
            v-if="lineup.can_update_lineup"
            :lineup="lineup"
            :exclude="excludePlayers"
          />
        </li>
      </ul>
    </CardContent>
  </Card>
</template>

<script lang="ts">
export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  computed: {
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
