<script setup lang="ts">
import AppNav from "~/layouts/components/AppNav.vue";
import MatchmakingConfirm from "~/components/matchmaking/MatchmakingConfirm.vue";
import PlayerNameRegistration from "~/components/PlayerNameRegistration.vue";
import StreamGlobal from "~/components/StreamGlobal.vue";
</script>

<template>
  <StreamGlobal />
  <PlayerNameRegistration />
  <MatchmakingConfirm />
  <div class="flex min-h-screen w-full flex-col">
    <AppNav>
      <div
        :class="{
          'mx-auto': !showLeftNav,
          'lg:max-w-7xl': containContent,
        }"
      >
        <slot></slot>
      </div>
    </AppNav>
  </div>

  <div id="global-chat-container"></div>
</template>

<script lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";

export default {
  computed: {
    containContent() {
      switch (this.$route.name) {
        case "matches-id":
        case "map-pools":
        case "game-server-nodes":
        case "system-metrics":
        case "system-logs":
          return false;
        default:
          return true;
      }
    },
    showLeftNav() {
      return useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer);
    },
  },
};
</script>
