<script setup lang="ts">
import { ChevronsRight, BookUser } from "lucide-vue-next";
import LobbyInvites from "~/components/matchmaking-lobby/LobbyInvites.vue";
import MatchInvites from "~/components/matchmaking-lobby/MatchInvites.vue";
import FriendsList from "~/components/matchmaking-lobby/FriendsList.vue";
import MiniDisplay from "~/components/matchmaking-lobby/MiniDisplay.vue";
import { useRightSidebar } from "~/composables/useRightSidebar";
const { setRightSidebarOpen, toggleRightSidebar } = useRightSidebar();
</script>

<template>
  <Teleport defer to="#right-sidebar">
    <SidebarProvider
      class="bg-muted/40"
      :open="rightSidebarOpen"
      v-slot="{ isMobile }"
    >
      <Teleport defer to="#right-sidebar-trigger">
        <SidebarTrigger @click="setRightSidebarOpen(true)" v-show="isMobile" />
      </Teleport>

      <Sidebar
        variant="inset"
        collapsible="icon"
        side="right"
        @click="setRightSidebarOpen(true)"
        :class="{ 'cursor-pointer': !rightSidebarOpen }"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem
              class="flex items-center justify-center"
              v-if="!isMobile"
            >
              <SidebarMenuButton as-child>
                <Button
                  size="icon"
                  variant="outline"
                  @click.stop="toggleRightSidebar()"
                >
                  <ChevronsRight
                    style="width: 1.5rem; height: 1.5rem"
                    :class="{ 'rotate-180': !rightSidebarOpen }"
                  />
                </Button>
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
    </SidebarProvider>
  </Teleport>
</template>

<script lang="ts">
import { useMediaQuery } from "@vueuse/core";

export default {
  watch: {
    isMedium: {
      immediate: true,
      handler(oldValue, newValue) {
        if (this.rightSidebarOpen && oldValue && newValue == false) {
          setRightSidebarOpen(false);
        }
      },
    },
  },
  computed: {
    matchInvites() {
      return useMatchmakingStore().matchInvites;
    },
    lobbyInvites() {
      return useMatchmakingStore().lobbyInvites;
    },
    isMedium() {
      return useMediaQuery("(max-width: 1400px)").value;
    },
    rightSidebarOpen() {
      return useRightSidebar().rightSidebarOpen.value;
    },
  },
};
</script>
