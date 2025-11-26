<script lang="ts" setup>
import { ChevronDown, Merge } from "lucide-vue-next";
import MatchLobbySelector from "./MathcLobbySelector.vue";
import ChatLobby from "~/components/chat/ChatLobby.vue";
import MatchLobby from "~/components/matchmaking-lobby/MatchLobby.vue";
</script>

<template>
  <div v-if="currentMatch" class="flex gap-2">
    <MatchLobbySelector :match="currentMatch" :pulse="true" />

    <template v-if="myMatches.length > 1">
      <Popover v-model:open="choosingLobby">
        <PopoverTrigger>
          <Button variant="outline" class="px-3 py-5">
            <ChevronDown class="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent class="p-2 flex flex-col gap-2 border-none">
          <template v-for="match in myMatches" :key="match.id">
            <MatchLobbySelector
              @click="selectLobby(match.id)"
              :match="match"
              :show-switch="true"
              v-if="match.id !== currentMatch.id"
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

  <template v-else>
    <Button
      @click="createLobby"
      class="relative group overflow-hidden rounded bg-transparent text-white shadow-lg hover:shadow px-5 py-4 transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
    >
      <span
        class="absolute inset-0 rounded p-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
      >
        <span class="block h-full w-full bg-zinc-900/90"></span>
      </span>

      <span
        class="pointer-events-none absolute inset-0 rounded bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300 ease-out"
      ></span>

      <div class="relative flex items-center gap-2 z-10">
        <Merge class="h-5 w-5 drop-shadow-sm" />
        <span class="font-semibold">Create Lobby</span>
      </div>
    </Button>
  </template>
</template>

<script lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
export default {
  data() {
    return {
      choosingLobby: false,
      playMatchFoundSound: useSound().playMatchFoundSound,
    };
  },
  watch: {
    match: {
      immediate: true,
      handler(currentMatch, oldMatch) {
        if (!currentMatch || currentMatch.id === oldMatch?.id) {
          return;
        }

        switch (this.currentMatch.status) {
          case e_match_status_enum.Veto:
          case e_match_status_enum.Live:
            if (oldMatch && currentMatch.status !== oldMatch.status) {
              this.playMatchFoundSound();
            }
            break;
          case e_match_status_enum.WaitingForCheckIn:
            const matchLineups =
              this.currentMatch.lineup_1.lineup_players.concat(
                this.currentMatch.lineup_2.lineup_players,
              );
            const meInMatch = matchLineups.find((lobby: any) => {
              return lobby.player.steam_id === this.me.steam_id;
            });

            if (meInMatch.checked_in === false) {
              this.playMatchFoundSound();
            }
            break;
        }
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    myMatches() {
      return useMatchLobbyStore().myMatches;
    },
    lobbies() {
      return useMatchmakingStore().lobbies;
    },
    currentLobby() {
      return this.lobbies?.find((lobby: any) => {
        return lobby.id === this.me?.current_lobby_id;
      });
    },
    currentMatch() {
      if (this.matchId) {
        return useMatchLobbyStore().lobbies.get(this.matchId)?.match;
      }
      return Array.from(useMatchLobbyStore().lobbies.values()).at(0)?.match;
    },
    onMatchPage() {
      return this.$route.path === `/matches/${this.currentMatch?.id}`;
    },
    matchId() {
      return useMatchmakingStore().viewingMatchId;
    },
  },
  methods: {
    selectLobby(matchId: string) {
      this.choosingLobby = false;
      useMatchmakingStore().viewingMatchId = matchId;
    },
    createLobby() {
      useMatchmakingStore().createLobby();
    },
  },
};
</script>
