<script lang="ts" setup>
import { ArrowLeftRight } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <div class="flex gap-2 items-center" @click="goToMatch">
    <div class="flex items-center">
      <TooltipProvider v-for="member of myLineup">
        <Tooltip>
          <TooltipTrigger>
            <PlayerDisplay
              :show-flag="false"
              :show-steam-id="false"
              :show-name="false"
              :ping-status="true"
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
    </div>

    <span class="text-xl font-bold text-gray-600 dark:text-gray-400">VS</span>

    <div class="flex items-center">
      <TooltipProvider v-for="member of otherLineUp">
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
    </div>

    <Button
      class="flex gap-2 text-lg font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white animate-pulse"
      v-if="showLink"
    >
      <ArrowLeftRight />
    </Button>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    match: {
      required: true,
      type: Object,
    },
    showLink: {
      default: false,
      type: Boolean,
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    myLineup() {
      if (!this.match) {
        return;
      }
      const { lineup_1, lineup_2 } = this.match;

      return (
        lineup_1.is_on_lineup ? lineup_1.lineup_players : lineup_2.is_on_lineup
      ).sort((a, b) => {
        if (a.player?.steam_id === this.me?.steam_id) {
          return -1;
        }
        if (b.player?.steam_id === this.me?.steam_id) {
          return 1;
        }
        return 0;
      });
    },
    otherLineUp() {
      if (!this.match) {
        return;
      }
      const { lineup_1, lineup_2 } = this.match;

      return lineup_1.is_on_lineup
        ? lineup_2.lineup_players
        : lineup_1.is_on_lineup;
    },
  },
  methods: {
    goToMatch() {
      if (!this.showLink) {
        return;
      }

      this.$router.push(`/matches/${this.match.id}`);
    },
  },
};
</script>
