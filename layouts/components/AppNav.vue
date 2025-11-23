<script setup lang="ts">
import TopNav from "./TopNav.vue";
import LeftNav from "./LeftNav.vue";
import AppHeader from "./AppHeader.vue";
import RightSideBar from "./RightSideBar.vue";
</script>

<template>
  <SidebarProvider v-slot="{ open, isMobile }">
    <LeftNav
      :is-mobile="isMobile"
      :side-bar-open="open"
      v-if="showLeftNav"
    ></LeftNav>

    <SidebarInset class="bg-muted/40 pt-4 overflow-hidden">
      <TopNav v-if="!showLeftNav"></TopNav>
      <AppHeader class="px-6" v-if="showLeftNav"></AppHeader>
      <div class="px-6 py-4">
        <slot></slot>
      </div>
    </SidebarInset>

    <RightSideBar></RightSideBar>
    <div id="right-sidebar"></div>
  </SidebarProvider>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { e_player_roles_enum } from "~/generated/zeus";
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
    showLeftNav() {
      return true;
      //return useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer);
    },
  },
};
</script>
