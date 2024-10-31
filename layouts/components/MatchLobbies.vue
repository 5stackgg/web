<script lang="ts" setup>
import MatchLobby from "./MatchLobby.vue";
import { ArrowRight, ChevronDown } from "lucide-vue-next";
</script>

<template>
  <div class="flex gap-4 items-center">
    <template v-if="match">
      <Button
        class="flex gap-2 text-lg font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white animate-pulse"
        @click="goToMatch"
        v-show="!onMatchPage"
      >
        <span class="md:inline hidden">{{
          match.e_match_status.description
        }}</span>
        <ArrowRight />
      </Button>

      <Popover v-model:open="choosingLobby">
        <PopoverTrigger>
          <div
            class="hidden md:flex gap-4 p-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-md"
          >
            <MatchLobby
              :match="match"
              :can-switch="lobbies.length > 1"
            ></MatchLobby>

            <Button variant="outline" v-if="lobbies.length > 1">
              <ChevronDown class="h-4 w-4" />
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0">
          <Command>
            <CommandList>
              <CommandGroup>
                <template v-for="lobby in lobbies" :key="lobby.match.id">
                  <CommandItem
                    :value="lobby.match.id"
                    @select="selectLobby(lobby.match.id)"
                    v-if="match.id !== lobby.match.id"
                  >
                    <MatchLobby :match="lobby.match" :show-switch="true" />
                  </CommandItem>
                </template>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </template>
  </div>
</template>

<script lang="ts">
export default {
  data() {
    return {
      choosingLobby: false,
    };
  },
  computed: {
    lobbies() {
      return Array.from(useMatchLobbyStore().lobbies.values());
    },
    match() {
      if (this.matchId) {
        return useMatchLobbyStore().lobbies.get(this.matchId)?.match;
      }

      return this.lobbies.at(0)?.match;
    },
    onMatchPage() {
      return this.$route.path === `/matches/${this.match?.id}`;
    },
    matchId() {
      return useMatchLobbyStore().viewMatchLobby;
    },
  },
  methods: {
    goToMatch() {
      this.$router.push(`/matches/${this.match.id}`);
    },
    selectLobby(matchId: string) {
      this.choosingLobby = false;
      useMatchLobbyStore().viewMatchLobby = matchId;
    },
  },
};
</script>
