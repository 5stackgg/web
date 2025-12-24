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
    <CardContent class="p-6 flex flex-col gap-6">
      <!-- Match Type and Best Of - Secondary Info -->
      <div
        class="flex items-start justify-between text-sm text-muted-foreground"
      >
        <div class="flex flex-col items-start gap-2">
          <MatchStatus :match="match" />
          <div class="flex items-center gap-2">
            <span>{{ match.options.type }}</span>
            <span>•</span>
            <span>{{
              $t("match.best_of", { count: match.options.best_of })
            }}</span>
          </div>
        </div>
        <MatchActions :match="match" />
      </div>

      <!-- Teams and Scores - Primary Focus -->
      <div class="flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="flex flex-col items-center md:items-start gap-1 md:w-2/5">
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
        class="flex flex-col gap-4 pt-4 border-t border-border"
      >
        <div class="flex justify-center sm:justify-start">
          <Badge
            v-if="
              match.cancels_at && match.status !== e_match_status_enum.Canceled
            "
            variant="destructive"
            class="flex items-center gap-2"
          >
            <span>{{ $t("match.auto_canceling") }}</span>
            <TimeAgo :date="match.cancels_at" />
          </Badge>
          <Badge
            v-else-if="
              match.status === e_match_status_enum.Finished && match.ended_at
            "
            variant="secondary"
            class="flex items-center gap-2"
          >
            <span>{{ $t("match.status.finished") }}</span>
            <TimeAgo :date="match.ended_at" />
          </Badge>
        </div>
      </div>
    </CardContent>

    <CardContent v-if="match.options.coaches" class="flex flex-col gap-4">
      <h3 class="font-semibold text-lg">{{ $t("match.coaches") }}</h3>
      <ul class="flex flex-col gap-6">
        <li
          v-for="lineup in [match.lineup_1, match.lineup_2]"
          :key="lineup.name"
          class="flex flex-col gap-2"
        >
          <div class="text-muted-foreground">{{ lineup.name }}</div>
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
