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
import SpotlightPlayerSearch from "~/components/SpotlightPlayerSearch.vue";

const { isMobile } = useSidebar();
</script>

<template>
  <header
    class="flex h-16 shrink-0 items-center gap-2 transition-[width] ease-linear bg-background sticky top-0 z-50"
  >
    <div class="flex items-center justify-between w-full">
      <div class="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" class="h-4" />
        <bread-crumbs></bread-crumbs>
      </div>

      <div class="flex gap-4">
        <SpotlightPlayerSearch v-if="me" />

        <MatchLobbies v-if="!isMobile"></MatchLobbies>

        <SystemUpdate v-if="isAdmin"></SystemUpdate>

        <SystemStatus></SystemStatus>

        <OnlinePlayers v-if="isMobile"></OnlinePlayers>

        <AppNotifications v-if="me"></AppNotifications>
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
  },
};
</script>
