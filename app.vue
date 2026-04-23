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

function pageKeyWithoutTabQuery(route: {
  path: string;
  query: Record<string, unknown>;
  hash?: string;
}) {
  const query = new URLSearchParams();

  Object.keys(route.query)
    .filter((key) => key !== "tab")
    .sort()
    .forEach((key) => {
      const value = route.query[key];
      const values = Array.isArray(value) ? value : [value];

      values.forEach((item) => {
        if (item == null) {
          return;
        }

        query.append(key, String(item));
      });
    });

  const queryString = query.toString();
  return `${route.path}${queryString ? `?${queryString}` : ""}${route.hash || ""}`;
}
</script>

<template>
  <NuxtPwaManifest />

  <StreamGlobal v-if="hasGlobalStream" />

  <template v-if="me">
    <PlayerNameRegistration />
    <MatchmakingConfirm />
  </template>

  <NuxtLayout>
    <NuxtPage :page-key="pageKeyWithoutTabQuery" />
  </NuxtLayout>
  <Toaster />
</template>
