<script setup lang="ts">
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useRightSidebar } from "@/composables/useRightSidebar";
import PlayersList from "~/components/matchmaking-lobby/PlayersList.vue";
import MiniDisplay from "~/components/matchmaking-lobby/MiniDisplay.vue";
import InvitesHeader from "~/components/matchmaking-lobby/InvitesHeader.vue";
import InvitesContent from "~/components/matchmaking-lobby/InvitesContent.vue";

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
                >({{ onlineFriends.length }})</span
              >
            </TabsTrigger>
            <TabsTrigger value="online-friends">
              {{ $t("matchmaking.others.title") }}
              <span class="text-xs text-muted-foreground ml-1"
                >({{ playersOnline }})</span
              >
            </TabsTrigger>
          </TabsList>
          <div class="flex flex-col items-center gap-1">
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
        </div>
        <InvitesHeader :sidebar-open="rightSidebarOpen" />
      </SidebarHeader>
      <SidebarContent v-if="rightSidebarOpen">
        <SidebarGroup>
          <TabsContent value="friends" class="mt-0">
            <InvitesContent />
            <PlayersList :friends-only="true" />
          </TabsContent>
          <TabsContent value="online-friends" class="mt-0">
            <InvitesContent />
            <PlayersList />
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
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    onlineFriends() {
      return useMatchmakingStore().onlineFriends;
    },
    playersOnline() {
      return (
        useMatchmakingStore().playersOnline.length -
        this.onlineFriends.length -
        1
      );
    },
  },
};
</script>
