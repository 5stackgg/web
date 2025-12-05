<script setup lang="ts">
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import MatchmakingConfirm from "~/components/matchmaking/MatchmakingConfirm.vue";
import PlayerNameRegistration from "~/components/PlayerNameRegistration.vue";
import StreamGlobal from "~/components/StreamGlobal.vue";
</script>

<template>
  <NuxtPwaManifest />

  <template v-if="me">
    <StreamGlobal />
    <PlayerNameRegistration />
    <MatchmakingConfirm />
  </template>

  <NuxtLayout>
    <NuxtPage></NuxtPage>
  </NuxtLayout>
  <Toaster />
</template>

<script lang="ts">
export default {
  beforeCreate() {
    polyfillCountryFlagEmojis();
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
  },
};
</script>
