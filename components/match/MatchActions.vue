<script setup lang="ts">
import { MoreVertical } from "lucide-vue-next";
import { e_match_status_enum } from "~/generated/zeus";
import MatchSelectServer from "~/components/match/MatchSelectServer.vue";
</script>

<template>
  <template v-if="match.status == e_match_status_enum.PickingPlayers">
    <Button
      variant="outline"
      @click.prevent.stop="scheduleMatch"
      class="-mr-2"
      :disabled="canAddToLineup1 || canAddToLineup2"
    >
      Schedule Match!
    </Button>
  </template>
  <template v-if="match.status == e_match_status_enum.Scheduled">
    <Button
      variant="outline"
      @click.prevent.stop="startMatch"
      class="-mr-2"
      :disabled="!isServerAvailable"
    >
      Start Match
    </Button>
  </template>

  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button size="icon" variant="outline">
        <MoreVertical class="h-3.5 w-3.5" />
        <span class="sr-only">More</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem>
        <match-select-server :match="match"></match-select-server>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem @click="cancelMatch">Cancel Match</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import getMatchLineups from "~/utilities/getMatchLineups";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  methods: {
    async scheduleMatch() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          scheduleMatch: [
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
    async cancelMatch() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          cancelMatch: [
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
    me() {
      return useAuthStore().me;
    },
    isServerAvailable() {
      if (!this.match.server_id) {
        return true;
      }
      return this.match.server_id && this.match.is_match_server_available;
    },
    matchLineups() {
      return getMatchLineups(this.match);
    },
    maxPlayersPerLineup() {
      return this.match?.type === "Wingman" ? 2 : 5;
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
  },
};
</script>
