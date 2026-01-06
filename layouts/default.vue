<script setup lang="ts">
import AppSidebar from "@/components/AppSidebar.vue";
import MainContent from "@/layouts/components/MainContent.vue";
import TopNav from "@/layouts/components/TopNav.vue";
import AppHeader from "@/layouts/components/AppHeader.vue";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { computed, provide } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";
import { useGtm } from "@/layouts/composables/useGtm";

useGtm();

const route = useRoute();
const authStore = useAuthStore();

const showLeftNav = computed(() => {
  return authStore.isRoleAbove(e_player_roles_enum.match_organizer);
});

const containContent = computed(() => {
  switch (route.name) {
    case "matches-id":
    case "map-pools":
    case "game-server-nodes":
    case "system-metrics":
    case "system-logs":
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
  <SidebarProvider>
    <AppSidebar v-if="showLeftNav" />

    <SidebarInset>
      <TopNav v-if="!showLeftNav" />
      <AppHeader class="px-6" v-if="showLeftNav" />

      <div class="flex flex-1 flex-col">
        <MainContent>
          <slot></slot>
        </MainContent>
      </div>
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
