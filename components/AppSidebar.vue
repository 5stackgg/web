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
import { Button } from "@/components/ui/button";
import { Users } from "lucide-vue-next";
import { useRightSidebar } from "@/composables/useRightSidebar";

const props = withDefaults(defineProps<SidebarProps>(), {
  side: "left",
});

const { setRightSidebarOpen, rightSidebarOpen } = useRightSidebar();
</script>

<template>
  <Sidebar :side="props.side">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child>
            <a href="#">
              <div class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <span class="text-sm font-bold">5S</span>
              </div>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">5Stack</span>
                <span class="truncate text-xs">Platform</span>
              </div>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem v-if="props.side === 'right'">
          <div class="flex items-center justify-end w-full px-2">
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              @click="setRightSidebarOpen(!rightSidebarOpen)"
            >
              <Users class="h-4 w-4" />
              <span class="sr-only">Toggle Right Sidebar</span>
            </Button>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <!-- Sidebar content can be added here -->
    </SidebarContent>
  </Sidebar>
</template>

