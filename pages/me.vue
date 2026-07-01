<script setup lang="ts">
import { useAuthStore } from "~/stores/AuthStore";
import LoadingScreen from "~/components/LoadingScreen.vue";

// Redirect at the MIDDLEWARE stage — before this page component mounts.
// Previously the redirect lived in an `immediate: true` watcher in setup();
// when the session was already known (in-app navigation through /me) that
// watcher fired `navigateTo` synchronously while /me was still resolving
// inside <NuxtPage>'s <Suspense>. Triggering a navigation mid-Suspense
// deadlocks the page swap: the router resolves but the target page never
// mounts, leaving this spinner stuck. Middleware redirects cleanly with no
// component mounted, so there is no Suspense to wedge.
definePageMeta({
  middleware: async () => {
    if (process.server) return;
    const authStore = useAuthStore();
    if (!authStore.hasCheckedSession) {
      await authStore.getMe();
    }
    return navigateTo(
      authStore.me?.steam_id ? `/players/${authStore.me.steam_id}` : "/login",
      { replace: true },
    );
  },
});
</script>

<template>
  <LoadingScreen />
</template>
