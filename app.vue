<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import { useBranding } from "~/composables/useBranding";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";

const MatchmakingConfirm = defineAsyncComponent(
  () => import("~/components/matchmaking/MatchmakingConfirm.vue"),
);
const PlayerNameRegistration = defineAsyncComponent(
  () => import("~/components/PlayerNameRegistration.vue"),
);
const StreamGlobal = defineAsyncComponent(
  () => import("~/components/StreamGlobal.vue"),
);

polyfillCountryFlagEmojis();

useBranding();

const authStore = useAuthStore();
const applicationSettingsStore = useApplicationSettingsStore();

const me = computed(() => authStore.me);
const hasGlobalStream = computed(() => !!applicationSettingsStore.globalStream);
</script>

<template>
  <NuxtPwaManifest />

  <StreamGlobal v-if="hasGlobalStream" />

  <template v-if="me">
    <PlayerNameRegistration />
    <MatchmakingConfirm />
  </template>

  <NuxtLayout>
    <NuxtPage :page-key="(route) => route.fullPath" />
  </NuxtLayout>
  <Toaster />
</template>
