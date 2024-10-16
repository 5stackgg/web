<script lang="ts" setup>
import { ArrowRight } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <div class="flex">
    <template v-if="match">
      <Button
        class="flex gap-2 text-lg font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white animate-pulse"
        @click="goToMatch"
        v-if="!onMatchPage"
      >
        {{ match.e_match_status.description }}
        <ArrowRight />
      </Button>

      <TooltipProvider v-for="member of lineupPlayers">
        <Tooltip>
          <TooltipTrigger>
            <PlayerDisplay
              :show-flag="false"
              :show-steam-id="false"
              :show-name="false"
              :player="
                member.placeholder_name
                  ? {
                      name: member.placeholder_name,
                    }
                  : member.player
              "
            />
          </TooltipTrigger>
          <TooltipContent>
            {{ member.placeholder_name || member.player.name }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </template>
  </div>
</template>

<script lang="ts">
export default {
  data() {
    return {
      matchId: null as null | string,
    };
  },
  computed: {
    minPlayers() {
      return 4;
    },
    lobbies() {
      return useMatchLobbyStore().lobbies;
    },
    me() {
      return useAuthStore().me;
    },
    match() {
      const keys = Array.from(this.lobbies?.keys() || []);

      if (keys.length === 0) {
        return null;
      }

      if (this.matchId) {
        return this.lobbies.get(this.matchId);
      }

      return this.lobbies.get(keys[0])?.match;
    },
    lineupPlayers() {
      if (!this.match) {
        return;
      }
      const { lineup_1, lineup_2 } = this.match;

      return (
        lineup_1.is_on_lineup ? lineup_1.lineup_players : lineup_2.is_on_lineup
      ).sort((a, b) => {
        if (a.player?.steam_id === this.me?.steam_id) {
          return 1;
        }
        if (b.player?.steam_id === this.me?.steam_id) {
          return -1;
        }
        return 0;
      });
    },
    onMatchPage() {
      return this.$route.path === `/matches/${this.match?.id}`;
    },
  },
  methods: {
    goToMatch() {
      this.$router.push(`/matches/${this.match.id}`);
    },
  },
};
</script>
