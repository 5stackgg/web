<script setup lang="ts">
import { MailPlus } from "lucide-vue-next";
import MatchInvites from "~/components/matchmaking-lobby/MatchInvites.vue";
import LobbyInvites from "~/components/matchmaking-lobby/LobbyInvites.vue";
import { SidebarSeparator } from "~/components/ui/sidebar";

defineProps<{
  showHeader?: boolean;
  showContent?: boolean;
  compact?: boolean;
}>();
</script>

<template>
  <div>
    <!-- Compact indicator for collapsed state -->
    <template v-if="compact">
      <div
        v-if="hasInvites"
        class="flex items-center justify-center gap-2 text-sm text-muted-foreground relative"
      >
        <MailPlus class="h-4 w-4" />
        <div
          class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"
        ></div>
        <span>{{
          matchInvites.length + lobbyInvites.length + pendingFriends.length
        }}</span>
      </div>
      <div
        v-else
        class="h-[1.5rem] flex items-center justify-center"
        aria-hidden="true"
      >
        <!-- Spacer to prevent layout shift -->
      </div>
    </template>

    <!-- Full section with header and content -->
    <template v-else-if="showContent && hasInvites">
      <div class="flex flex-col gap-4 mt-4">
        <h3
          v-if="showHeader"
          class="text-lg font-semibold flex items-center gap-2"
        >
          <div class="relative">
            <MailPlus class="h-5 w-5" />
            <div
              class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"
            ></div>
          </div>
          {{ $t("matchmaking.invites") }}
          <span class="text-sm text-muted-foreground"
            >({{
              matchInvites.length + lobbyInvites.length + pendingFriends.length
            }})</span
          >
        </h3>

        <MatchInvites />
        <LobbyInvites />
      </div>
      <SidebarSeparator class="my-4" />
    </template>
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
    pendingFriends() {
      return (this.friends as any[])?.filter((friend: any) => {
        return (
          friend.status === "Pending" &&
          friend.invited_by_steam_id !== useAuthStore().me?.steam_id
        );
      });
    },
    friends() {
      return (useMatchmakingStore().friends as any[]).sort((a: any, b: any) => {
        return a.name.localeCompare(b.name);
      });
    },
    hasInvites() {
      return (
        this.matchInvites.length > 0 ||
        this.lobbyInvites.length > 0 ||
        this.pendingFriends.length > 0
      );
    },
  },
};
</script>
