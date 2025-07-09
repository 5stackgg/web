<script setup lang="ts">
import MatchmakingLobbyAccess from "./MatchmakingLobbyAccess.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import { XIcon, LogOut, PlusIcon } from "lucide-vue-next";
</script>

<template>
  <div
    class="flex items-center justify-between gap-2 bg-background rounded-full px-2 py-1 border border-gray-700"
  >
    <MatchmakingLobbyAccess :lobby="lobby" v-if="isCaptain" />

    <div class="flex items-center -space-x-2">
      <template
        v-for="(player, index) of lobby?.players"
        :key="player.player.steam_id"
      >
        <div
          class="relative group transition-transform hover:scale-110 hover:z-10"
          :class="{
            'animate-pulse': player.status === 'Invited',
          }"
          :style="{ zIndex: index }"
        >
          <div class="relative">
            <div class="w-8 h-8 rounded-full p-0.5">
              <PlayerDisplay
                :player="player.player"
                :showOnline="false"
                :showFlag="false"
                :showName="false"
                :showRole="false"
                size="xs"
                class="rounded-full w-full h-full overflow-hidden bg-gray-800"
              />
            </div>
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
      </template>
    </div>

    <div class="flex items-center gap-2">
      <slot name="actions">
        <div
          class="relative group transition-transform hover:scale-110 hover:z-10"
          :style="{ zIndex: lobby?.players.length + 1 }"
          v-if="isCaptain"
        >
          <div
            class="w-8 h-8 rounded-full p-0.5 bg-gray-800 border border-gray-600 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors duration-200"
            @click="openPlayerSearch"
          >
            <PlusIcon class="h-3 w-3 text-white" />
          </div>

          <player-search
            v-model:open="playerSearchOpen"
            :label="$t('matchmaking.lobby.invite_player')"
            :self="false"
            @selected="(player) => inviteToLobby(player.steam_id)"
            class="absolute inset-0 opacity-0 pointer-events-none"
          ></player-search>
        </div>

        <div
          class="relative group transition-transform hover:scale-110 hover:z-10 ml-auto"
          :style="{ zIndex: lobby?.players.length + 2 }"
        >
          <div
            class="w-8 h-8 rounded-full p-0.5 bg-red-800 border border-red-600 flex items-center justify-center cursor-pointer hover:bg-red-700 transition-colors duration-200"
            @click="removeFromLobby(lobby.id, me?.steam_id)"
            :title="$t('matchmaking.lobby.leave')"
          >
            <LogOut class="h-3 w-3 text-white" />
          </div>
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
      this.$apollo.mutate({
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
    },
  },
};
</script>
