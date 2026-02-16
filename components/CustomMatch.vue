<script setup lang="ts">
import { Swords } from "lucide-vue-next";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
</script>

<template>
  <NuxtLink
    :to="{ name: 'matches-create' }"
    class="flex-1 p-6 border rounded-lg hover:bg-accent/10 cursor-pointer transition-all duration-200 group relative overflow-hidden"
  >
    <div class="flex items-start gap-4">
      <div
        class="p-2 rounded-full bg-muted group-hover:bg-accent transition-colors"
      >
        <Swords class="size-10 text-foreground" />
      </div>
      <div class="space-y-2">
        <h3
          class="text-xl font-semibold transition-colors"
        >
          {{ $t("custom_match.title") }}
        </h3>
        <p class="text-sm text-muted-foreground leading-relaxed">
          {{ $t("custom_match.description") }}
        </p>
      </div>
    </div>
    <div
      class="absolute bottom-0 right-0 w-32 h-32 bg-muted/50 rounded-full -mr-16 -mb-16 group-hover:bg-accent/50 transition-colors"
    ></div>
  </NuxtLink>
</template>

<script lang="ts">
export default {
  computed: {
    canCreateMatch() {
      return useApplicationSettingsStore().canCreateMatch;
    },
  },
};
</script>
