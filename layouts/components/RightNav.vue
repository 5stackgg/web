<script setup lang="ts">
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "~/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import ScrollArea from "~/components/ui/scroll-area/ScrollArea.vue";
import { useRightSidebar } from "@/composables/useRightSidebar";
import LobbyInvites from "~/components/matchmaking-lobby/LobbyInvites.vue";
import MatchInvites from "~/components/matchmaking-lobby/MatchInvites.vue";
import PlayersList from "~/components/matchmaking-lobby/PlayersList.vue";
import MiniDisplay from "~/components/matchmaking-lobby/MiniDisplay.vue";

const { setRightSidebarOpen, rightSidebarOpen } = useRightSidebar();
</script>

<template>
  <Sidebar collapsible="icon" side="right" variant="inset">
    <Tabs default-value="friends" class="w-full h-full flex flex-col">
      <SidebarHeader>
        <div class="flex items-center gap-2 justify-end">
          <TabsList v-if="rightSidebarOpen" class="grid w-full grid-cols-2 m-0">
            <TabsTrigger value="friends">
              {{ $t("matchmaking.friends.title") }}
              <span class="text-xs text-muted-foreground ml-1"
                >({{ friendsOnline?.length || 0 }})</span
              >
            </TabsTrigger>
            <TabsTrigger value="online-friends">
              {{ $t("matchmaking.players.title") }}
              <span class="text-xs text-muted-foreground ml-1"
                >({{ totalPlayersCount }})</span
              >
            </TabsTrigger>
          </TabsList>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Open Friends List"
                @click="setRightSidebarOpen(!rightSidebarOpen)"
                class="w-full h-auto mt-0 group-data-[collapsible=icon]:!h-auto group-data-[collapsible=icon]:!w-full"
              >
                <MiniDisplay />
                <span class="sr-only">Toggle Right Sidebar</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarHeader>
      <SidebarContent v-if="rightSidebarOpen">
        <SidebarGroup>
          <TabsContent value="friends" class="mt-0">
            <template v-if="matchInvites.length > 0 || lobbyInvites.length > 0">
              <div class="flex flex-col gap-4 mt-4">
                <h3 class="text-lg font-semibold">
                  {{ $t("matchmaking.invites") }}
                  <span class="text-sm text-muted-foreground"
                    >({{ matchInvites.length + lobbyInvites.length }})</span
                  >
                </h3>

                <MatchInvites></MatchInvites>
                <LobbyInvites></LobbyInvites>
              </div>
              <SidebarSeparator class="my-4" />
            </template>
            <PlayersList ref="friendsListRef" :friends-only="true" />
          </TabsContent>
          <TabsContent value="online-friends" class="mt-0">
            <PlayersList ref="playersListRef" />
          </TabsContent>
        </SidebarGroup>
      </SidebarContent>
    </Tabs>
  </Sidebar>
</template>

<script lang="ts">
export default {
  data() {
    return {
      playersListRef: null as any,
      friendsListRef: null as any,
    };
  },
  computed: {
    matchInvites() {
      return useMatchmakingStore().matchInvites;
    },
    lobbyInvites() {
      return useMatchmakingStore().lobbyInvites;
    },
    playersOnline() {
      return useMatchmakingStore().playersOnline;
    },
    friendsOnline() {
      // Get count from friendsListRef if available
      if (this.friendsListRef?.totalPlayersCount !== undefined) {
        return this.friendsListRef.totalPlayersCount;
      }
      // Fallback: count online friends
      const matchmakingStore = useMatchmakingStore();
      const onlineSteamIds = new Set(matchmakingStore.onlinePlayerSteamIds);
      return matchmakingStore.friends.filter((friend: any) =>
        onlineSteamIds.has(friend.steam_id)
      ).length;
    },
    totalPlayersCount() {
      // Get total count from PlayersList component, excluding current user
      if (this.playersListRef?.totalPlayersCount !== undefined) {
        return this.playersListRef.totalPlayersCount;
      }
      // Fallback: count online players excluding current user
      const me = useAuthStore().me;
      const onlinePlayers = useMatchmakingStore().playersOnline;
      return onlinePlayers.filter(
        (player: any) => player.steam_id !== me?.steam_id
      ).length;
    },
  },
};
</script>
