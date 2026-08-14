<script setup lang="ts">
import { Card, CardContent } from "~/components/ui/card";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import AssignCoachToLineup from "~/components/match/AssignCoachToLineup.vue";
import ScheduleMatch from "~/components/match/ScheduleMatch.vue";
import CheckIntoMatch from "~/components/match/CheckIntoMatch.vue";
import QuickMatchConnect from "~/components/match/QuickMatchConnect.vue";
import { e_match_status_enum } from "~/generated/zeus";
import { buildLineupAvatarOverride } from "~/utilities/teamRosterOverride";
import { matchIneligiblePlayers } from "~/utilities/matchIneligiblePlayers";
</script>

<template>
  <div v-if="hasContent" class="flex flex-col gap-4">
    <!-- Check In / Schedule and Server Connect are alternate states of one
         slot -- check-in ends, the match goes live, connect takes its place --
         so they trade through a measured height swap instead of one panel
         vanishing wholesale and another popping in. The slot is legitimately
         empty between them (during veto), so it hides itself at rest rather
         than holding a blank flex gap open above the coaches card. -->
    <HeightSwap class="empty:hidden">
      <div
        v-if="match.can_schedule || showCheckInSection"
        key="actions"
        class="rounded-xl border border-white/10 bg-background/80 backdrop-blur-sm p-4 flex flex-col gap-3"
      >
        <ScheduleMatch :match="match" v-if="match.can_schedule" />
        <CheckIntoMatch :match="match" v-if="showCheckInSection" />
      </div>

      <div v-else-if="showQuickConnectSection" key="connect">
        <QuickMatchConnect
          :match="match"
          :hide-booting="hideBooting"
          :camera-ready="cameraReady"
        />
      </div>
    </HeightSwap>

    <!-- Coaches -->
    <Card v-if="match.options.coaches">
      <CardContent class="flex flex-col gap-4 p-6">
        <h3 class="font-semibold text-lg">{{ $t("common.coaches") }}</h3>
        <ul class="flex flex-col gap-6">
          <li
            v-for="lineup in [match.lineup_1, match.lineup_2]"
            :key="lineup.name"
            class="flex flex-col gap-2"
          >
            <div class="text-muted-foreground">{{ lineup.name }}</div>
            <PlayerDisplay
              v-if="lineup.coach"
              :player="lineup.coach"
              :avatar-override="
                buildLineupAvatarOverride(lineup)(lineup.coach.steam_id)
              "
            />
            <AssignCoachToLineup
              v-if="lineup.can_update_lineup"
              :lineup="lineup"
              :ineligible="ineligiblePlayers"
            />
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
    // In the draft room the booting state is shown by the maps/"Match Starting"
    // panel, so suppress QuickMatchConnect's duplicate booting spinner there.
    hideBooting: {
      type: Boolean,
      default: false,
    },
    cameraReady: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    players() {
      if (!this.match) {
        return [];
      }

      const players = [];

      players.push(...this.match.lineup_1.lineup_players);
      players.push(...this.match.lineup_2.lineup_players);

      return players;
    },
    isInMatch() {
      return this.players.find((player) => {
        return player.steam_id === this.me?.steam_id;
      });
    },
    showCheckInSection() {
      return !!this.isInMatch && this.match.can_check_in;
    },
    showQuickConnectSection() {
      return this.match.status === e_match_status_enum.Live && !!this.me;
    },
    showAnyActionSection() {
      return (
        this.match.can_schedule ||
        this.showCheckInSection ||
        this.showQuickConnectSection
      );
    },
    hasContent() {
      return this.showAnyActionSection || this.match.options.coaches;
    },
    ineligiblePlayers() {
      return matchIneligiblePlayers(this.match, this.$t);
    },
  },
};
</script>
