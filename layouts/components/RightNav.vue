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
import { Users } from "lucide-vue-next";
import { useRightSidebar } from "@/composables/useRightSidebar";
import LobbyInvites from "~/components/matchmaking-lobby/LobbyInvites.vue";
import MatchInvites from "~/components/matchmaking-lobby/MatchInvites.vue";
import FriendsList from "~/components/matchmaking-lobby/FriendsList.vue";
import MiniDisplay from "~/components/matchmaking-lobby/MiniDisplay.vue";

const { setRightSidebarOpen, rightSidebarOpen } = useRightSidebar();
</script>

<template>
  <Sidebar collapsible="icon" side="right" variant="inset">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="icon"
            :tooltip="$t('layouts.app_nav.tooltips.toggle_right_sidebar')"
            @click="setRightSidebarOpen(!rightSidebarOpen)"
          >
            <Users class="h-4 w-4" />
            <span class="sr-only">Toggle Right Sidebar</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup class="overflow-hidden -mt-4">
        <template
          v-if="
            rightSidebarOpen &&
            (matchInvites.length > 0 || lobbyInvites.length > 0)
          "
        >
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
        <FriendsList v-if="rightSidebarOpen" />
        <MiniDisplay v-if="!rightSidebarOpen" />
      </SidebarGroup>
    </SidebarContent>
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
  },
};
</script>
