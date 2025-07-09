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

const { isMobile } = useSidebar();
</script>

<template>
  <header
    class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 px-4"
  >
    <div class="flex items-center justify-between w-full">
      <div class="flex items-center gap-2">
        <SidebarTrigger v-if="showLeftNav" />
        <Separator orientation="vertical" class="h-4" />
        <bread-crumbs></bread-crumbs>
      </div>

      <div class="flex gap-4" v-if="showLeftNav">
        <MatchLobbies></MatchLobbies>

        <SystemUpdate v-if="isAdmin"></SystemUpdate>

        <SystemStatus></SystemStatus>

        <OnlinePlayers></OnlinePlayers>

        <AppNotifications></AppNotifications>

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
import { e_player_roles_enum } from "~/generated/zeus";

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

    showLeftNav() {
      return useAuthStore().isRoleAbove(e_player_roles_enum.verified_user);
    },
  },
};
</script>
