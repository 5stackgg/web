<script setup lang="ts">
import { Users, MailPlus } from "lucide-vue-next";
</script>

<template>
  <div class="flex flex-col gap-4 mt-4">
    <div
      v-if="matchInvites.length > 0 || lobbyInvites.length > 0"
      class="flex items-center justify-center gap-2 text-sm text-muted-foreground relative"
    >
      <MailPlus class="h-4 w-4" />
      <div
        class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"
      ></div>
      <span>{{ matchInvites.length + lobbyInvites.length }}</span>
    </div>

    <div
      class="flex items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <Users class="h-4 w-4" />
      <span>{{ onlineFriends?.length || 0 }}</span>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  computed: {
    matchInvites() {
      return useMatchmakingStore().matchInvites;
    },
    lobbyInvites() {
      return useMatchmakingStore().lobbyInvites;
    },
    friends() {
      return useMatchmakingStore().friends.sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
    },
    onlineFriends() {
      return this.friends?.filter((friend) => {
        if (friend.status === "Pending") {
          return false;
        }

        return useMatchmakingStore().onlinePlayerSteamIds.includes(
          friend.steam_id,
        );
      });
    },
  },
};
</script>
