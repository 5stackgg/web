<script lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";

export const description = "An inset sidebar with secondary navigation.";

export const iframeHeight = "800px";

export default {
  computed: {
    showLeftNav() {
      return true;
      //return useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer);
    },
  },
};
</script>

<script setup lang="ts">
import AppSidebar from "@/components/AppSidebar.vue";
import MainContent from "@/layouts/components/MainContent.vue";
import TopNav from "@/layouts/components/TopNav.vue";
import AppHeader from "@/layouts/components/AppHeader.vue";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-vue-next";
import { useRightSidebar } from "@/composables/useRightSidebar";
import { e_player_roles_enum } from "~/generated/zeus";

const { setRightSidebarOpen, rightSidebarOpen } = useRightSidebar();
</script>

<template>
  <SidebarProvider>
    <AppSidebar />

    <SidebarInset>
      <TopNav v-if="!showLeftNav" />
      <AppHeader class="px-6" v-if="showLeftNav" />

      <div class="flex flex-1 flex-col">
        <MainContent />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
