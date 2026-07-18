<script setup lang="ts">
import { watch } from "vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useCustomPagesStore } from "~/stores/CustomPages";
import LoadingScreen from "~/components/LoadingScreen.vue";

definePageMeta({
  layout: "public",
});

const authStore = useAuthStore();
const customPagesStore = useCustomPagesStore();

if (!authStore.hasCheckedSession) {
  void authStore.getMe();
}

// A custom page flagged is_default takes over the landing route, but only once
// the registry has loaded and only if the current viewer may see it — otherwise
// fall back to the normal /me vs /watch redirect.
watch(
  [
    () => authStore.hasCheckedSession,
    () => authStore.me?.steam_id,
    () => customPagesStore.initialized,
    () => customPagesStore.defaultPage,
  ],
  ([hasCheckedSession, steamId, initialized, defaultPage]) => {
    if (!hasCheckedSession || !initialized) {
      return;
    }

    if (defaultPage) {
      void navigateTo(`/apps/${defaultPage.slug}`, { replace: true });
      return;
    }

    void navigateTo(steamId ? "/me" : "/watch", {
      replace: true,
    });
  },
  { immediate: true },
);
</script>

<template>
  <LoadingScreen />
</template>
