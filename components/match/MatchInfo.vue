<script setup lang="ts">
import CaptainInfo from "~/components/CaptainInfo.vue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Tv } from "lucide-vue-next";
import ClipBoard from "~/components/ClipBoard.vue";
import MatchActions from "~/components/match/MatchActions.vue";
import MatchStatus from "~/components/match/MatchStatus.vue";
import BooleanToText from "~/components/BooleanToText.vue";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";
import { Separator } from "~/components/ui/separator";
import ScheduleMatch from "~/components/match/ScheduleMatch.vue";
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
import { separateByCapitalLetters } from "~/utilities/separateByCapitalLetters";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
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
          <div>
            {{ match.lineup_1.name }} (<MatchLineupScoreDisplay
              :match="match"
              :lineup="match.lineup_1"
            ></MatchLineupScoreDisplay
            >) vs {{ match.lineup_2.name }} (<MatchLineupScoreDisplay
              :match="match"
              :lineup="match.lineup_2"
            ></MatchLineupScoreDisplay
            >)
          </div>

          <MatchActions :match="match"></MatchActions>
        </div>

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
      <CardDescription>
        <QuickServerConnect :match="match"></QuickServerConnect>
      </CardDescription>
    </CardHeader>
    <CardContent class="p-6">
      <ul class="grid gap-3">
        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Match Type </span>
          <span>{{ match.options.type }}</span>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Best of </span>
          <span>{{ match.options.best_of }}</span>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Max Rounds </span>
          <span>{{ match.options.mr }}</span>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> TV Delay </span>
          <span>{{ match.options.tv_delay }} seconds</span>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Coaches </span>
          <BooleanToText :value="match.options.coaches"></BooleanToText>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Overtime </span>
          <BooleanToText :value="match.options.overtime"></BooleanToText>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Knife Round </span>
          <BooleanToText :value="match.options.knife_round"></BooleanToText>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Map Veto </span>
          <BooleanToText :value="match.options.map_veto"></BooleanToText>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Map Pool </span>
          <span class="text-right">
            {{ separateByCapitalLetters(match.options.map_pool.type) }}
            <br />
            <small>
              {{ match.options.map_pool.e_type.description }}
            </small>
          </span>
        </li>

        <li class="flex items-center justify-between">
          <span class="text-muted-foreground"> Substitutes </span>
          <span>{{ match.options.number_of_substitutes }}</span>
        </li>
      </ul>

      <Separator class="my-8" />

      <div class="grid gap-3">
        <div class="font-semibold">Captains</div>
        <ul class="grid gap-3">
          <li class="flex items-center justify-between">
            <span class="text-muted-foreground">
              {{ match.lineup_1.name }}
            </span>
            <span>
              <captain-info :captain="match.lineup_1.captain"></captain-info>
            </span>
          </li>
          <li class="flex items-center justify-between">
            <span class="text-muted-foreground">
              {{ match.lineup_2.name }}
            </span>
            <span>
              <captain-info :captain="match.lineup_2.captain"></captain-info>
            </span>
          </li>
        </ul>
      </div>

      <div class="grid gap-3" v-if="match.options.coaches">
        <div class="font-semibold">Coaches</div>
        <ul class="grid gap-3">
          <li class="flex items-center justify-between">
            <span class="text-muted-foreground">
              {{ match.lineup_1.name }}
            </span>
            <PlayerDisplay
              :player="match.lineup_1.coach"
              v-if="match.lineup_1.coach"
            ></PlayerDisplay>
          </li>
          <li class="flex items-center justify-between">
            <span class="text-muted-foreground">
              {{ match.lineup_2.name }}
            </span>
            <PlayerDisplay
              :player="match.lineup_2.coach"
              v-if="match.lineup_2.coach"
            ></PlayerDisplay>
          </li>
        </ul>
      </div>

      <Separator class="my-8" />

      <div class="grid gap-3">
        <div class="font-semibold">Match Organizers</div>
        <ul class="grid gap-3">
          <li class="flex items-center justify-between">
            <PlayerDisplay
              class="mx-3"
              :player="match.organizer"
            ></PlayerDisplay>
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
  },
};
</script>
