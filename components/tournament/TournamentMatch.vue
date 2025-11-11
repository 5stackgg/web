<script lang="ts" setup>
import TournamentRoundLineup from "~/components/tournament/TournamentRoundLineup.vue";
import TimeAgo from "~/components/TimeAgo.vue";
</script>

<template>
  <template v-for="bracket in brackets" :key="bracket.id">
    <div
      @click="handleClick($event, bracket)"
      v-if="!(bracket.bye && !bracket.team_1 && !bracket.team_2)"
      class="tournament-match cursor-pointer my-4 border-2 border-gray-700 rounded-lg m-4 p-4 transition-all duration-200 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/20 bg-gray-800/50 backdrop-blur-sm"
    >
      <div class="text-center">
        <Badge v-if="bracket.bye">
          {{ $t("tournament.match.bye_round") }}
        </Badge>
        <Badge v-else>{{
          $t("tournament.match.round_match", {
            round,
            match: bracket.match_number,
          })
        }}</Badge>
      </div>

      <!-- Display scheduled ETA if available -->
      <div v-if="bracket.scheduled_eta" class="text-center mt-2 mb-3">
        <div class="text-xs text-muted-foreground">
          {{ $t("tournament.match.scheduled_for") }}:
          <span class="text-blue-400 font-medium">
            <TimeAgo :date="bracket.scheduled_eta"></TimeAgo>
          </span>
        </div>
      </div>

      <!-- Show only team 1 if it's a bye round -->
      <div v-if="bracket.bye && bracket.team_1" class="items-center m-2">
        <div class="bg-gray-600 text-gray-300 rounded py-1 px-4">
          <span
            >{{ bracket.team_1.team?.name || bracket.team_1.name
            }}<span
              v-if="bracket.team_1_seed"
              class="text-muted-foreground ml-2"
              >(#{{ bracket.team_1_seed }})</span
            ></span
          >
        </div>
      </div>

      <!-- Show only team 2 if it's a bye round and team 1 doesn't exist -->
      <div v-else-if="bracket.bye && bracket.team_2" class="items-center m-2">
        <div class="bg-gray-600 text-gray-300 rounded py-1 px-4">
          <span
            >{{ bracket.team_2.team?.name || bracket.team_2.name
            }}<span
              v-if="bracket.team_2_seed"
              class="text-muted-foreground ml-2"
              >(#{{ bracket.team_2_seed }})</span
            ></span
          >
        </div>
      </div>

      <!-- Show both teams for regular matches -->
      <template v-else>
        <div class="items-center m-2">
          <div class="bg-gray-600 text-gray-300 rounded py-1 px-4">
            <span v-if="bracket.match" class="flex items-center gap-2">
              <TournamentRoundLineup
                :lineup_name="bracket.team_1.team?.name || bracket.team_1.name"
                :match="bracket.match"
                :lineup="bracket.match.lineup_1"
              ></TournamentRoundLineup>
              <span v-if="bracket.team_1_seed" class="text-muted-foreground"
                >(#{{ bracket.team_1_seed }})</span
              >
            </span>
            <template v-else>
              <span v-if="bracket.team_1">
                {{ bracket.team_1.name
                }}<span
                  v-if="bracket.team_1_seed"
                  class="text-muted-foreground ml-2"
                  >(#{{ bracket.team_1_seed }})</span
                >
              </span>
              <span v-else>
                {{ $t("tournament.match.team_1") }}
                <span
                  v-if="bracket.team_1_seed"
                  class="text-muted-foreground ml-2"
                  >(#{{ bracket.team_1_seed }})</span
                >
              </span>
            </template>
          </div>
        </div>

        <div class="items-center m-2">
          <div class="bg-gray-600 text-gray-300 rounded py-1 px-4">
            <span v-if="bracket.match" class="flex items-center gap-2">
              <TournamentRoundLineup
                :lineup_name="bracket.team_2.team?.name || bracket.team_2.name"
                :match="bracket.match"
                :lineup="bracket.match.lineup_2"
              ></TournamentRoundLineup>
              <span v-if="bracket.team_2_seed" class="text-muted-foreground"
                >(#{{ bracket.team_2_seed }})</span
              >
            </span>
            <template v-else>
              <span v-if="bracket.team_2">
                {{ bracket.team_2.team?.name || bracket.team_2.name
                }}<span
                  v-if="bracket.team_2_seed"
                  class="text-muted-foreground ml-2"
                  >(#{{ bracket.team_2_seed }})</span
                >
              </span>
              <span v-else>
                {{ $t("tournament.match.team_2") }}
                <span
                  v-if="bracket.team_2_seed"
                  class="text-muted-foreground ml-2"
                  >(#{{ bracket.team_2_seed }})</span
                >
              </span>
            </template>
          </div>
        </div>
      </template>
    </div>
  </template>
</template>

<script lang="ts">
export default {
  props: {
    round: {
      type: Number,
      required: true,
    },
    brackets: {
      type: Array,
      required: true,
    },
  },
  methods: {
    handleClick(event: MouseEvent, bracket: any) {
      if (!bracket.match) return;

      if (event.metaKey || event.ctrlKey || event.shiftKey) {
        window.open(`/matches/${bracket.match.id}`, "_blank");
        return;
      }

      this.$router.push({
        name: "matches-id",
        params: { id: bracket.match.id },
      });
    },
  },
};
</script>
