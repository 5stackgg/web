<script lang="ts" setup>
import { ChevronDown } from "lucide-vue-next";
import MatchLobbySelector from "./MathcLobbySelector.vue";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import MatchLobby from "~/components/matchmaking-lobby/MatchLobby.vue";
</script>

<template>
  <div v-if="match" class="flex gap-2">
    <MatchLobbySelector :match="match" :pulse="true" />

    <template v-if="lobbies.length > 1">
      <Popover v-model:open="choosingLobby">
        <PopoverTrigger>
          <Button variant="outline" class="px-3 py-5">
            <ChevronDown class="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent class="p-2 flex flex-col gap-2 border-none">
          <template v-for="lobby in lobbies" :key="lobby.match.id">
            <MatchLobbySelector
              @click="selectLobby(lobby.match.id)"
              :match="lobby.match"
              :show-switch="true"
              v-if="match.id !== lobby.match.id"
            />
          </template>
        </PopoverContent>
      </Popover>
    </template>
  </div>

  <template v-if="currentLobby">
    <ChatLobby
      class="max-h-[25vh]"
      :global="true"
      instance="matchmaking"
      :lobby-id="me.current_lobby_id"
      type="matchmaking"
    />

    <MatchLobby :lobby="currentLobby" />
  </template>
</template>

<script lang="ts">
export default {
  data() {
    return {
      choosingLobby: false,
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    lobbies() {
      return useMatchmakingStore().lobbies;
    },
    currentLobby() {
      return this.lobbies?.find((lobby: any) => {
        return lobby.id === this.me?.current_lobby_id;
      });
    },
    match() {
      if (this.matchId) {
        return useMatchLobbyStore().lobbies.get(this.matchId)?.match;
      }
      return Array.from(useMatchLobbyStore().lobbies.values()).at(0)?.match;
    },
    onMatchPage() {
      return this.$route.path === `/matches/${this.match?.id}`;
    },
    matchId() {
      return useMatchLobbyStore().viewMatchLobby;
    },
  },
  methods: {
    selectLobby(matchId: string) {
      this.choosingLobby = false;
      useMatchLobbyStore().viewMatchLobby = matchId;
    },
  },
};
</script>
