<script setup lang="ts">
import { watch } from "vue";
import { useAuthStore } from "~/stores/AuthStore";

definePageMeta({
  layout: "public",
});

const authStore = useAuthStore();

if (!authStore.hasCheckedSession) {
  void authStore.getMe();
}

watch(
  [() => authStore.hasCheckedSession, () => authStore.me?.steam_id],
  ([hasCheckedSession, steamId]) => {
    if (!hasCheckedSession) {
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
