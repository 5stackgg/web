<script lang="ts" setup>
import AssignCoachToLineup from "~/components/match/AssignCoachToLineup.vue";
import AssignPlayerToLineup from "~/components/match/AssignPlayerToLineup.vue";
</script>

<template>
  <Card v-if="assigningLineups">
    <CardHeader class="pb-3">
      <CardContent class="flex">
        <AssignPlayerToLineup :lineup="matchLineups.lineup1" v-if="canAddToLineup1"></AssignPlayerToLineup>
        <AssignPlayerToLineup :lineup="matchLineups.lineup1" v-if="canAddToLineup2"></AssignPlayerToLineup>
      </CardContent>
    </CardHeader>
  </Card>

  <template v-if="match.coaches && (canUpdateLineup1 || canUpdateLineup2)">
    <Card v-if="canUpdateLineup1">
      <CardHeader class="pb-3">
        <CardTitle>Assign Coach for {{ matchLineups.lineup1.name }}</CardTitle>
        <CardContent>
            <AssignCoachToLineup :lineup="matchLineups.lineup1"></AssignCoachToLineup>
            <AssignCoachToLineup :lineup="matchLineups.lineup2"></AssignCoachToLineup>
        </CardContent>
      </CardHeader>
    </Card>
  </template>


</template>

<script lang="ts">
import { e_match_types_enum } from "~/generated/zeus";
import getMatchLineups from "~/utilities/getMatchLineups";

export default {
  props: {
    match: {
      type: Object,
      required: true,
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
