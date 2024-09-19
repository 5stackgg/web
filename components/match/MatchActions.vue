<script setup lang="ts">
import { MoreVertical } from "lucide-vue-next";
import MatchSelectServer from "~/components/match/MatchSelectServer.vue";
import MatchSelectWinner from "~/components/match/MatchSelectWinner.vue";
import DropdownMenuItem from "~/components/ui/dropdown-menu/DropdownMenuItem.vue";
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button size="icon" variant="outline">
        <MoreVertical class="h-3.5 w-3.5" />
        <span class="sr-only">More</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <template v-if="match.can_start">
        <DropdownMenuItem
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
        </DropdownMenuItem>
      </template>

      <template v-if="match.can_cancel">
        <DropdownMenuItem @click="cancelMatch">Cancel Match</DropdownMenuItem>
      </template>

      <DropdownMenuSeparator v-if="match.can_start || match.can_cancel" />

      <DropdownMenuItem v-if="match.can_assign_server">
        <MatchSelectServer :match="match"></MatchSelectServer>
      </DropdownMenuItem>

      <DropdownMenuItem>
        <MatchSelectWinner :match="match"></MatchSelectWinner>
      </DropdownMenuItem>

      <template v-if="match.is_in_lineup">
        <DropdownMenuSeparator />
        <DropdownMenuItem
          class="text-destructive"
          @click="callForOrganizer"
          :disabled="match.requested_organizer"
        >
          Request Organizer
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
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
    async callForOrganizer() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          callForOrganizer: [{ matchId: this.match.id }, { success: true }],
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
