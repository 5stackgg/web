<script setup lang="ts">
import { Card, CardContent } from "~/components/ui/card";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import AssignCoachToLineup from "~/components/match/AssignCoachToLineup.vue";
import ScheduleMatch from "~/components/match/ScheduleMatch.vue";
import CheckIntoMatch from "~/components/match/CheckIntoMatch.vue";
import QuickMatchConnect from "~/components/match/QuickMatchConnect.vue";
import { e_match_status_enum } from "~/generated/zeus";
import { buildLineupAvatarOverride } from "~/utilities/teamRosterOverride";
</script>

<template>
  <div v-if="hasContent" class="flex flex-col gap-4">
    <!-- Action Panel — Check In / Schedule -->
    <div
      v-if="match.can_schedule || showCheckInSection"
      class="rounded-xl border border-white/10 bg-background/80 backdrop-blur-sm p-4 flex flex-col gap-3"
    >
      <ScheduleMatch :match="match" v-if="match.can_schedule" />
      <CheckIntoMatch :match="match" v-if="showCheckInSection" />
    </div>

    <!-- Server Connect — standalone -->
    <QuickMatchConnect
      :match="match"
      :hide-booting="hideBooting"
      v-if="showQuickConnectSection"
    />

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
              :exclude="excludePlayers"
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
