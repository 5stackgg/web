<script setup lang="ts">
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Separator } from "~/components/ui/separator";
import SystemUpdate from "./SystemUpdate.vue";
import BreadCrumbs from "~/components/BreadCrumbs.vue";
import SystemStatus from "./SystemStatus.vue";
import MatchLobbies from "./MatchLobbies.vue";
import UtilityPracticeNav from "~/components/utility/UtilityPracticeNav.vue";
import DraftRoomNav from "./DraftRoomNav.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import SpotlightPlayerSearch from "~/components/SpotlightPlayerSearch.vue";
import MobileHubButton from "./MobileHubButton.vue";

const { isMobile } = useSidebar();
</script>

<template>
  <header
    class="flex h-[60px] shrink-0 items-center gap-2 transition-[width] ease-linear bg-background sticky top-0 z-50"
  >
    <div class="flex items-center justify-between w-full">
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <SidebarTrigger class="shrink-0" />
        <Separator orientation="vertical" class="h-4 shrink-0" />
        <bread-crumbs></bread-crumbs>
      </div>

      <div class="flex items-center gap-4 shrink-0">
        <SpotlightPlayerSearch v-if="me" />

        <UtilityPracticeNav v-if="!isMobile" />

        <DraftRoomNav v-if="!isMobile"></DraftRoomNav>

        <MatchLobbies v-if="!isMobile"></MatchLobbies>

        <SystemUpdate v-if="isAdmin"></SystemUpdate>

        <SystemStatus></SystemStatus>

        <MobileHubButton />
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
