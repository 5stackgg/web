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
    <Tabs
      v-if="rightSidebarOpen"
      default-value="friends"
      class="w-full h-full flex flex-col"
    >
      <SidebarHeader>
        <div class="flex items-center justify-between w-auto flex-shrink-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Open Friends List"
                @click="setRightSidebarOpen(!rightSidebarOpen)"
                class="w-auto flex-shrink-0 group-data-[collapsible=icon]:!h-auto"
              >
                <MiniDisplay />
                <span class="sr-only">Toggle Right Sidebar</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <TabsList class="grid w-full grid-cols-2 m-0">
            <TabsTrigger value="friends">
              {{ $t("matchmaking.friends.title") }}
            </TabsTrigger>
            <TabsTrigger value="online-friends">
              {{ $t("matchmaking.friends.online") }}
            </TabsTrigger>
          </TabsList>
        </div>
      </SidebarHeader>
      <SidebarContent>
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
    <SidebarHeader v-else>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Open Friends List"
            @click="setRightSidebarOpen(!rightSidebarOpen)"
            class="w-auto flex-shrink-0 group-data-[collapsible=icon]:!h-auto"
          >
            <MiniDisplay />
            <span class="sr-only">Toggle Right Sidebar</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  </Sidebar>
</template>

<script lang="ts">
export default {
  mounted() {
    // Add fake data for 30 online friends
    const matchmakingStore = useMatchmakingStore();
    const fakeFriends = [];
    const fakeSteamIds = [];
    const fakePlayers = [];

    for (let i = 1; i <= 30; i++) {
      const steamId = `7656119800000000${i.toString().padStart(2, "0")}`;
      fakeSteamIds.push(steamId);

      fakeFriends.push({
        steam_id: steamId,
        name: `Friend ${i}`,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=Friend${i}`,
        status: "Accepted",
        elo: 1000 + Math.floor(Math.random() * 2000),
        country: ["US", "CA", "GB", "DE", "FR", "BR", "AU"][
          Math.floor(Math.random() * 7)
        ],
        role: "player",
        invited_by_steam_id: null,
        player: {
          is_in_lobby: false,
          is_in_another_match: false,
          lobby_players: [],
        },
      });

      fakePlayers.push({
        steam_id: steamId,
        name: `Friend ${i}`,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=Friend${i}`,
        elo: 1000 + Math.floor(Math.random() * 2000),
        country: ["US", "CA", "GB", "DE", "FR", "BR", "AU"][
          Math.floor(Math.random() * 7)
        ],
        role: "player",
        is_banned: false,
        is_gagged: false,
        is_muted: false,
      });
    }

    // Add fake friends to store
    matchmakingStore.friends = [...matchmakingStore.friends, ...fakeFriends];
    // Add fake steam IDs to online players list
    matchmakingStore.onlinePlayerSteamIds = [
      ...matchmakingStore.onlinePlayerSteamIds,
      ...fakeSteamIds,
    ];
    // Add fake players to online players
    matchmakingStore.playersOnline = [
      ...matchmakingStore.playersOnline,
      ...fakePlayers,
    ];
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
  },
};
</script>
