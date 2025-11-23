<script setup lang="ts">
import type { SidebarProps } from "~/components/ui/sidebar";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";
import { Users } from "lucide-vue-next";
import { useRightSidebar } from "@/composables/useRightSidebar";

const props = withDefaults(defineProps<SidebarProps>(), {
  side: "left",
});

const { setRightSidebarOpen, rightSidebarOpen } = useRightSidebar();
</script>

<template>
  <Sidebar
    :side="props.side"
    :collapsible="props.side === 'right' ? 'icon' : 'offcanvas'"
  >
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem v-if="props.side === 'right'">
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
      <!-- Sidebar content can be added here -->
    </SidebarContent>
  </Sidebar>
</template>
