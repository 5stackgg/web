<script setup lang="ts">
import TopoBackground from "@/layouts/components/TopoBackground.vue";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { computed, defineAsyncComponent, provide } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";
import { useGtm } from "@/layouts/composables/useGtm";
import { useChatTabSetup } from "~/composables/useChatTabSetup";

const AppSidebar = defineAsyncComponent(
  () => import("@/components/AppSidebar.vue"),
);
const MainContent = defineAsyncComponent(
  () => import("@/layouts/components/MainContent.vue"),
);
const TopNav = defineAsyncComponent(
  () => import("@/layouts/components/TopNav.vue"),
);
const AppHeader = defineAsyncComponent(
  () => import("@/layouts/components/AppHeader.vue"),
);

useGtm();
useChatTabSetup();

const route = useRoute();
const authStore = useAuthStore();

const showLeftNav = computed(() => {
  return authStore.isRoleAbove(e_player_roles_enum.match_organizer);
});

const containContent = computed(() => {
  if (route.name?.toString().startsWith("settings-application")) {
    return false;
  }

  switch (route.name) {
    case "matches-id":
    case "map-pools":
    case "game-server-nodes":
    case "system-metrics":
    case "system-logs":
    case "database":
    case "game-server-nodes-nodeId-files":
    case "dedicated-servers-serverId-files":
      return false;
    default:
      return true;
  }
});

// Provide values to MainContent
provide("showLeftNav", showLeftNav);
provide("containContent", containContent);
</script>

<template>
  <TopoBackground />

  <SidebarProvider data-screenshot-root class="relative z-10 !bg-transparent">
    <AppSidebar v-if="showLeftNav" />

    <SidebarInset
      class="flex flex-col overflow-y-auto overflow-x-hidden !bg-transparent"
      style="height: 100svh"
    >
      <TopNav v-if="!showLeftNav" />
      <AppHeader class="px-6" v-if="showLeftNav" />

      <MainContent class="flex-1">
        <slot></slot>
      </MainContent>
    </SidebarInset>
  </SidebarProvider>

  <div id="global-chat-container"></div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { getCountryForTimezone } from "countries-and-timezones";

export default {
  watch: {
    detectedCountry: {
      immediate: true,
      async handler() {
        if (!this.me || this.me.country) {
          return;
        }

        await this.$apollo.mutate({
          mutation: generateMutation({
            update_players_by_pk: [
              {
                pk_columns: {
                  steam_id: this.me.steam_id,
                },
                _set: {
                  country: this.detectedCountry,
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });
      },
    },
  },

  computed: {
    me() {
      return useAuthStore().me;
    },
    detectedCountry() {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const country = getCountryForTimezone(timezone);

      if (country) {
        return country.id;
      }
    },
  },
};
</script>
