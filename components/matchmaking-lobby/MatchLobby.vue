<script setup lang="ts">
import MatchmakingLobbyAccess from "./MatchmakingLobbyAccess.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import { XIcon, LogOut, PlusIcon } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
</script>

<template>
  <div
    class="relative flex items-center justify-between gap-2 bg-background rounded-full px-2 py-1 border border-gray-700 h-12"
  >
    <MatchmakingLobbyAccess :lobby="lobby" v-if="isCaptain" />

    <TransitionGroup tag="div" name="avatar" class="flex items-center -space-x-2">
      <div
        v-for="(player, index) of lobby?.players"
        :key="player.player.steam_id"
        class="relative group transition-transform hover:scale-110 hover:z-10"
        :class="{
          'animate-pulse': player.status === 'Invited',
        }"
        :style="{ zIndex: index }"
      >
        <div class="relative">
            <FiveStackToolTip>
              <template #trigger>
                <PlayerDisplay
                  :player="player.player"
                  :showOnline="false"
                  :showFlag="false"
                  :showName="false"
                  :showRole="false"
                  size="xs"
                />
              </template>
              {{ player.player.name }}
            </FiveStackToolTip>
            <Button
              class="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rounded-full h-5 w-5 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-red-400 hover:bg-red-500 border-2 border-gray-900"
              variant="destructive"
              size="xs"
              @click="removeFromLobby(lobby.id, player.player.steam_id)"
              v-if="
                (player.status === 'Invited' || player.status === 'Accepted') &&
                player.player.steam_id !== me?.steam_id &&
                isCaptain
              "
            >
              <XIcon class="h-3 w-3" />
            </Button>
          </div>
      </div>
    </TransitionGroup>

    <div class="flex items-center gap-2">
      <slot name="actions">
        <div
          class="relative group transition-transform hover:scale-110 hover:z-10"
          :style="{ zIndex: lobby?.players.length + 1 }"
          v-if="isCaptain"
        >
          <PlayerSearch
            :label="$t('matchmaking.lobby.invite_player')"
            :self="false"
            @selected="(player) => inviteToLobby(player.steam_id)"
            :registeredOnly="true"
            :exclude="lobby?.players.map((player) => player.player.steam_id)"
          >
            <div
              class="w-8 h-8 rounded-full p-0.5 bg-gray-800 border border-gray-600 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors duration-200"
              @click="openPlayerSearch"
            >
              <PlusIcon class="h-3 w-3 text-white" />
            </div>
          </PlayerSearch>
        </div>

        <div
          class="relative group transition-transform hover:scale-110 hover:z-10 ml-auto"
          :style="{ zIndex: lobby?.players.length + 2 }"
        >
          <Button
            size="icon-sm"
            variant="destructive"
            class="rounded-full"
            @click="removeFromLobby(lobby.id, me?.steam_id)"
            :title="$t('matchmaking.lobby.leave')"
          >
            <LogOut class="h-3 w-3" />
          </Button>
        </div>
      </slot>
    </div>
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    lobby: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      playerSearchOpen: false,
      removingFromLobby: false,
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    isCaptain() {
      const me = this.lobby?.players.find(({ player }: { player: any }) => {
        return this.me.steam_id === player.steam_id;
      });
      return me?.captain;
    },
  },
  methods: {
    openPlayerSearch() {
      this.playerSearchOpen = true;
    },
    async inviteToLobby(steam_id: string) {
      await useMatchmakingStore().inviteToLobby(steam_id);
    },
    async removeFromLobby(lobby_id: string, steam_id: string) {
      if (this.removingFromLobby) {
        return;
      }
      this.removingFromLobby = true;
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            delete_lobby_players_by_pk: [
              {
                lobby_id,
                steam_id,
              },
              {
                __typename: true,
              },
            ],
          }),
        });
      } finally {
        this.removingFromLobby = false;
      }
    },
  },
};
</script>

<style scoped>
/* Lobby avatars adding / removing */
.avatar-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.avatar-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.avatar-enter-from {
  opacity: 0;
  transform: scale(0.3) translateY(4px);
}
.avatar-leave-to {
  opacity: 0;
  transform: scale(0.3);
}
.avatar-move {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
