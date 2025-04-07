<script lang="ts" setup>
import cleanMapName from "~/utilities/cleanMapName";
import PlayerDisplay from "../PlayerDisplay.vue";
</script>

<template>
  <div
    v-for="match_map in match.match_maps"
    :key="match_map.id"
    class="bg-secondary p-6 rounded-lg mb-8"
  >
    <h3 class="text-2xl font-bold mb-6 text-primary">
      {{ cleanMapName(match_map.map.name) }}
    </h3>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="round in match_map.rounds"
        :key="round.round"
        class="bg-background p-6 rounded-lg shadow-md transition-all duration-300 hover:shadow-lg"
      >
        <div class="flex justify-between items-center mb-4">
          <h4 class="text-xl font-semibold">
            {{ $t("match.clutches.round", { number: round.round }) }}
          </h4>
          <span
            v-if="clutches[match_map.id] && clutches[match_map.id][round.round]"
            :class="[
              'px-3 py-1 rounded-full text-sm font-medium',
              clutches[match_map.id][round.round].success
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800',
            ]"
          >
            {{
              clutches[match_map.id][round.round].success
                ? $t("match.clutches.won")
                : $t("match.clutches.lost")
            }}

            {{
              $t("match.clutches.vs", {
                count: clutches[match_map.id][round.round].against.length,
              })
            }}
          </span>
        </div>
        <div
          v-if="clutches[match_map.id] && clutches[match_map.id][round.round]"
          class="space-y-4"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <PlayerDisplay
                :player="clutches[match_map.id][round.round].player.player"
                class="text-lg"
              ></PlayerDisplay>
            </div>
          </div>
          <div class="mt-4">
            <p class="text-sm mb-2 font-medium">
              {{ $t("match.clutches.against") }}:
            </p>
            <div class="flex flex-wrap gap-4">
              <template
                v-for="{ player } of clutches[match_map.id][round.round]
                  .against"
              >
                <PlayerDisplay
                  :player="player"
                  class="w-full text-sm bg-secondary px-3 py-2 rounded"
                ></PlayerDisplay>
              </template>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500 italic mt-4">
          {{ $t("match.clutches.no_clutches") }}
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    match: {
      required: true,
      type: Object,
    },
    lineup1: {
      required: true,
      type: Object,
    },
    lineup2: {
      required: true,
      type: Object,
    },
  },
  methods: {
    getClutches(member: { steam_id: string }) {
      const clutches = [];
      for (const match_map_id in this.clutches) {
        for (const round in this.clutches[match_map_id]) {
          if (
            this.clutches[match_map_id][round].player.steam_id ===
            member.steam_id
          ) {
            clutches.push(this.clutches[match_map_id][round]);
          }
        }
      }
      return clutches;
    },
    getLineupIdBySteamId(steam_id: string) {
      if (
        this.lineup1.lineup_players.some(
          (player) => player.steam_id === steam_id,
        )
      ) {
        return this.lineup1.id;
      }
      if (
        this.lineup2.lineup_players.some(
          (player) => player.steam_id === steam_id,
        )
      ) {
        return this.lineup2.id;
      }
      return null;
    },
  },
  computed: {
    clutches() {
      const lineup1 = this.lineup1.lineup_players;
      const lineup2 = this.lineup2.lineup_players;

      const clutches: Record<
        string,
        Record<
          number,
          {
            success: boolean;
            round: number;
            match_map_id: string;
            player: Object;
            against: Object[];
          }
        >
      > = {};

      for (const match_map of this.match.match_maps) {
        clutches[match_map.id] = {};

        for (const round of match_map.rounds) {
          let lineups = [[...lineup1], [...lineup2]];

          let clutchStarted = false;
          let clutcher: { player: Object; team: number } | null = null;

          for (const kill of round.kills) {
            // Remove the killed player from their team
            for (let i = 0; i < 2; i++) {
              const playerIndex = lineups[i].findIndex(
                (player) => player.steam_id === kill.attacked_player.steam_id,
              );
              if (playerIndex !== -1) {
                lineups[i].splice(playerIndex, 1);
                break;
              }
            }

            const lineup1Alive = lineups[0].length;
            const lineup2Alive = lineups[1].length;

            // Check if a clutch situation has started
            if (!clutchStarted && (lineup1Alive === 1 || lineup2Alive === 1)) {
              clutchStarted = true;
              const clutchTeam = lineup1Alive === 1 ? 0 : 1;
              clutcher = {
                player: lineups[clutchTeam][0],
                team: clutchTeam,
              };

              clutches[match_map.id][round.round] = {
                success: false,
                round: round.round,
                match_map_id: match_map.id,
                player: clutcher.player,
                against: [...lineups[1 - clutchTeam]],
              };
            }

            // If clutch has started, check if the clutcher got a kill
            if (
              clutchStarted &&
              clutcher &&
              kill.player?.steam_id === clutcher.player.steam_id
            ) {
              if (lineups[1 - clutcher.team].length === 0) {
                // Clutch successful
                clutches[match_map.id][round.round].success = true;
                break;
              }
            }

            // If all players on one team are dead, end the round
            if (lineup1Alive === 0 || lineup2Alive === 0) {
              break;
            }
          }
        }
      }

      return clutches;
    },
  },
};
</script>
