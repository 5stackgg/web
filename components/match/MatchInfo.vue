<script setup lang="ts">
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
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
    <CardContent class="p-6">
      <!-- Match Type and Best Of - Secondary Info -->
      <div
        class="mb-6 flex items-center justify-between text-sm text-muted-foreground"
      >
        <div class="flex flex-col items-center">
          <span>{{ match.options.type }}</span>
          <Badge
            v-if="match.options.best_of > 1"
            variant="secondary"
            class="text-[10px] leading-tight w-fit mt-0.5"
          >
            {{ $t("match.best_of", { count: match.options.best_of }) }}
          </Badge>
        </div>
        <MatchStatus :match="match" />
        <MatchActions :match="match" />
      </div>

      <!-- Teams and Scores - Primary Focus -->
      <div
        class="flex flex-col md:flex-row items-center justify-between space-y-6 md:space-y-0 md:space-x-6"
      >
        <div
          class="flex flex-col items-center md:items-start space-y-1 md:w-2/5"
        >
          <span
            class="text-xl font-bold text-center md:text-left truncate w-full"
            >{{ match.lineup_1.name }}</span
          >
          <span class="text-lg text-muted-foreground">
            <MatchLineupScoreDisplay :match="match" :lineup="match.lineup_1" />
          </span>
        </div>

        <span class="text-muted-foreground font-medium">{{
          $t("match.vs")
        }}</span>

        <div class="flex flex-col items-center md:items-end space-y-1 md:w-2/5">
          <span
            class="text-xl font-bold text-center md:text-right truncate w-full"
            >{{ match.lineup_2.name }}</span
          >
          <span class="text-lg text-muted-foreground">
            <MatchLineupScoreDisplay :match="match" :lineup="match.lineup_2" />
          </span>
        </div>
      </div>

      <!-- Auto Canceling or Finished Information -->
      <div
        v-if="
          (match.cancels_at && match.status !== e_match_status_enum.Canceled) ||
          (match.status === e_match_status_enum.Finished && match.ended_at)
        "
        class="mt-6 pt-4 border-t border-border"
      >
        <div class="flex justify-center sm:justify-start">
          <Badge
            v-if="
              match.cancels_at && match.status !== e_match_status_enum.Canceled
            "
            variant="destructive"
            class="flex items-center"
          >
            <span class="mr-2">{{ $t("match.auto_canceling") }}</span>
            <TimeAgo :date="match.cancels_at" />
          </Badge>
          <Badge
            v-else-if="
              match.status === e_match_status_enum.Finished && match.ended_at
            "
            variant="secondary"
            class="flex items-center"
          >
            <span class="mr-2">{{ $t("match.status.finished") }}</span>
            <TimeAgo :date="match.ended_at" />
          </Badge>
        </div>
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
