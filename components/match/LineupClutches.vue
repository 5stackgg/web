<template>
  <div v-for="member of lineup1?.lineup_players">
    <lineup-member :member="member" :lineup_id="lineup1.id"></lineup-member>
    <div v-for="clutch of getClutches(member)">
      <p>{{ clutch.success }} - {{ clutch.round }} - {{ clutch.against }}</p>
      <small>
        {{ clutch.match_map_id }}
      </small>
    </div>
  </div>
  <div v-for="member of lineup2?.lineup_players">
    <lineup-member :member="member" :lineup_id="lineup2.id"></lineup-member>
  </div>
</template>

<script lang="ts">
import LineupMember from "~/components/match/LineupMember.vue";

export default {
  components: { LineupMember },
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
    getClutches(member) {
      const clutches = [];

      for (const match_map_id in this.clutches) {
        for (const round in this.clutches[match_map_id]) {
          if (this.clutches[match_map_id][round].steam_id === member.steam_id) {
            clutches.push(this.clutches[match_map_id][round]);
          }
        }
      }
      return clutches;
    },
  },
  computed: {
    clutches() {
      const lineup1 = this.lineup1.lineup_players.map(({ steam_id }) => {
        return steam_id;
      });

      const lineup2 = this.lineup2.lineup_players.map(({ steam_id }) => {
        return steam_id;
      });

      const clutches = {};

      for (const match_map of this.match.match_maps) {
        clutches[match_map.id] = {};

        for (const round of match_map.rounds) {
          let lineups = [
            Object.assign([], lineup1),
            Object.assign([], lineup2),
          ];

          for (const kill of round.kills) {
            for (const key in lineups) {
              const foundPlayer = lineups[key].findIndex((steam_id) => {
                return steam_id === kill.attacked_player.steam_id;
              });
              if (foundPlayer !== -1) {
                lineups[key].splice(foundPlayer, 1);
              }
              break;
            }

            const lineup1Alive = lineups[0].length;
            const lineup2Alive = lineups[1].length;

            if (lineup1Alive == 1 || lineup2Alive === 1) {
              clutches[match_map.id][round.round] = {
                success: false,
                round: round.round,
                match_map_id: match_map.id,
                steam_id: lineup1Alive ? lineup1.at(0) : lineup2.at(0),
                against: lineup1Alive
                  ? Object.assign([], lineup2)
                  : Object.assign([], lineup1),
              };
              continue;
            }

            const clutcher_steam_id =
              clutches[match_map.id]?.[round.round]?.steam_id;

            if (
              ((lineup1Alive == 0 || lineup2Alive === 0) &&
                lineups[0].at(0) === clutcher_steam_id) ||
              lineups[1].at(0) === clutcher_steam_id
            ) {
              clutches[match_map.id][round.round].success = true;
            }
          }
        }
      }

      return clutches;
    },
  },
};
</script>
