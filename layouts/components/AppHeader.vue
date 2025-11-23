<script setup lang="ts">
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Separator } from "~/components/ui/separator";
import AppNotifications from "./AppNotifications.vue";
import SystemUpdate from "./SystemUpdate.vue";
import BreadCrumbs from "~/components/BreadCrumbs.vue";
import SystemStatus from "./SystemStatus.vue";
import OnlinePlayers from "./OnlinePlayers.vue";
import MatchLobbies from "./MatchLobbies.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-vue-next";
import { useRightSidebar } from "@/composables/useRightSidebar";

const { isMobile } = useSidebar();
const { setRightSidebarOpen, rightSidebarOpen } = useRightSidebar();
</script>

<template>
  <header
    class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12"
  >
    <div class="flex items-center justify-between w-full">
      <div class="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" class="h-4" />
        <bread-crumbs></bread-crumbs>
      </div>

      <div class="flex gap-4">
        <MatchLobbies></MatchLobbies>

        <SystemUpdate v-if="isAdmin"></SystemUpdate>

        <SystemStatus></SystemStatus>

        <OnlinePlayers></OnlinePlayers>

        <AppNotifications></AppNotifications>

        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          @click="setRightSidebarOpen(!rightSidebarOpen)"
        >
          <Users class="h-4 w-4" />
          <span class="sr-only">Toggle Right Sidebar</span>
        </Button>

        <div
          id="right-sidebar-trigger"
          class="flex items-center justify-center"
          v-show="isMobile"
        ></div>
      </div>
    </div>
  </header>
</template>

<script lang="ts">
export default {
  computed: {
    me() {
      return useAuthStore().me;
    },
    isAdmin() {
      return useAuthStore().isAdmin;
    },
    lobbies() {
      return useMatchmakingStore().lobbies;
    },
  },
};
</script>
