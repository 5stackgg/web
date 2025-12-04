<script lang="ts" setup>
import MatchLobbyLineup from "./MatchLobbyLineup.vue";
</script>

<template>
  <div class="flex gap-2 items-center justify-center pr-3">
    <MatchLobbyLineup :match="match" :lineup="myLineup" :flip="true" />

    <span class="text-xs font-bold text-red-400/90 dark:text-red-400/90 ml-5">{{
      $t("layouts.match_lobby.versus")
    }}</span>

    <MatchLobbyLineup :match="match" :lineup="otherLineUp" />
  </div>
</template>

<script lang="ts">
import socket from "~/web-sockets/Socket";
import type { Lobby } from "~/web-sockets/Socket";
export default {
  props: {
    match: {
      required: true,
      type: Object,
    },
  },
  data() {
    return {
      lobby: undefined as unknown as Lobby,
    };
  },
  created() {
    this.lobby = socket.joinLobby(`match-lobby`, "match", this.match.id);
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    matchId() {
      return this.match.id;
    },
    myLineup() {
      if (!this.match) {
        return;
      }
      const { lineup_1, lineup_2 } = this.match;

      return (
        lineup_1.is_on_lineup
          ? lineup_1.lineup_players
          : lineup_2.lineup_players
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
        : lineup_1.lineup_players;
    },
  },
  unmounted() {
    this.lobby?.leave();
  },
};
</script>
