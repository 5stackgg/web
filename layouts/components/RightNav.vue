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
import FriendsList from "~/components/matchmaking-lobby/FriendsList.vue";
import MiniDisplay from "~/components/matchmaking-lobby/MiniDisplay.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";

const { setRightSidebarOpen, rightSidebarOpen } = useRightSidebar();
</script>

<template>
  <Sidebar collapsible="icon" side="right" variant="inset">
    <Tabs default-value="friends" class="w-full h-full flex flex-col">
      <SidebarHeader>
        <div class="flex items-center gap-4 justify-end">
          <TabsList v-if="rightSidebarOpen" class="grid w-full grid-cols-2 m-0">
            <TabsTrigger value="friends">
              {{ $t("matchmaking.friends.title") }}
            </TabsTrigger>
            <TabsTrigger value="online-friends">
              {{ $t("matchmaking.friends.online") }}
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
            <FriendsList />
          </TabsContent>
          <TabsContent value="online-friends" class="mt-0">
            <template :key="player.steam_id" v-for="player of playersOnline">
              <PlayerDisplay
                :player="player"
                class="my-2"
                :linkable="true"
              ></PlayerDisplay>
            </template>
          </TabsContent>
        </SidebarGroup>
      </SidebarContent>
    </Tabs>
  </Sidebar>
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
    playersOnline() {
      return useMatchmakingStore().playersOnline;
    },
  },
};
</script>
