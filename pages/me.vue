<script setup lang="ts">
import { watch } from "vue";
import { useAuthStore } from "~/stores/AuthStore";

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

    void navigateTo(steamId ? `/players/${steamId}` : "/login", {
      replace: true,
    });
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div
      class="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-foreground"
      :aria-label="$t('ui.tooltips.loading')"
      role="status"
    ></div>
  </div>
</template>
