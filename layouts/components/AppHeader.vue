<script setup lang="ts">
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Separator } from "~/components/ui/separator";
import SystemUpdate from "./SystemUpdate.vue";
import BreadCrumbs from "~/components/BreadCrumbs.vue";
import SystemStatus from "./SystemStatus.vue";
import MatchLobbies from "./MatchLobbies.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import SpotlightPlayerSearch from "~/components/SpotlightPlayerSearch.vue";
import { Grid } from "lucide-vue-next";
import { useHubState } from "@/composables/useHubState";

const { isMobile } = useSidebar();
const { openLastOrDefaultHub } = useHubState();
</script>

<template>
  <header
    class="flex h-[60px] shrink-0 items-center gap-2 transition-[width] ease-linear bg-background sticky top-0 z-50"
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

        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 md:hidden relative"
          @click="openLastOrDefaultHub()"
        >
          <Grid class="h-4 w-4" />
          <span class="sr-only">{{ $t("ui.tooltips.toggle_right_sidebar") }}</span>
        </Button>
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
