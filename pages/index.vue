<script setup lang="ts">
import { watch } from "vue";
import { useAuthStore } from "~/stores/AuthStore";
import { usePluginsStore } from "~/stores/Plugins";
import LoadingScreen from "~/components/LoadingScreen.vue";

definePageMeta({
  layout: "public",
});

const authStore = useAuthStore();
const pluginsStore = usePluginsStore();

if (!authStore.hasCheckedSession) {
  void authStore.getMe();
}

// A plugin flagged is_default takes over the landing route, but only once
// the registry has loaded and only if the current viewer may see it — otherwise
// fall back to the normal /me vs /watch redirect.
watch(
  [
    () => authStore.hasCheckedSession,
    () => authStore.me?.steam_id,
    () => pluginsStore.initialized,
    () => pluginsStore.defaultPlugin,
  ],
  ([hasCheckedSession, steamId, initialized, defaultPlugin]) => {
    if (!hasCheckedSession || !initialized) {
      return;
    }

    if (defaultPlugin) {
      void navigateTo(`/apps/${defaultPlugin.slug}`, { replace: true });
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
