<script setup lang="ts">
import LobbyInvite from "./LobbyInvite.vue";
import { Separator } from "~/components/ui/separator";
</script>

<template>
  <div v-for="invite in lobbyInvites" :key="(invite as any).id">
    <template v-if="getInviterName(invite) === 'Unknown'">
      {{ $t("matchmaking.invite_messages.unknown_inviter_lobby") }}
    </template>
    <template v-else>
      {{
        $t("matchmaking.invite_messages.known_inviter_lobby", {
          name: getInviterName(invite),
        })
      }}
    </template>
  </div>
  <div class="flex flex-col gap-4">
    <template v-for="(invite, index) in lobbyInvites" :key="(invite as any).id">
      <LobbyInvite type="lobby" :invite="invite" />
      <Separator v-if="index < lobbyInvites.length - 1" class="my-2" />
    </template>
  </div>
</template>

<script lang="ts">
export default {
  computed: {
    lobbyInvites() {
      return useMatchmakingStore().lobbyInvites as any[];
    },
    playersOnline() {
      return useMatchmakingStore().playersOnline as any[];
    },
    friends() {
      return useMatchmakingStore().friends as any[];
    },
  },
  methods: {
    getInviterName(invite: any) {
      // Lobby invites have a players array, find the captain
      if (!invite?.players) return "Unknown";

      const captain = invite.players.find((p: any) => p.captain === true);
      if (!captain?.player) return "Unknown";

      const steamId = captain.player.steam_id;
      if (!steamId) return "Unknown";

      // Try to find in online players first
      const onlinePlayer = this.playersOnline.find(
        (p: any) => p.steam_id === steamId
      );
      if (onlinePlayer) return onlinePlayer.name;

      // Try to find in friends
      const friend = this.friends.find((f: any) => f.steam_id === steamId);
      if (friend) return friend.name;

      // Fallback to the name from the invite data if available
      if (captain.player.name) return captain.player.name;

      return "Unknown";
    },
  },
};
</script>
