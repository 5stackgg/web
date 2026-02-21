<script setup lang="ts">
import { Swords } from "lucide-vue-next";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
</script>

<template>
  <AnimatedCard variant="elevated">
    <NuxtLink :to="{ name: 'matches-create' }" class="block p-6 cursor-pointer">
      <div class="flex items-start gap-4">
        <div class="p-2 rounded-full bg-muted">
          <Swords class="size-10 text-foreground" />
        </div>
        <div class="space-y-2">
          <h3 class="text-xl font-semibold">
            {{ $t("custom_match.title") }}
          </h3>
          <p class="text-sm text-muted-foreground leading-relaxed">
            {{ $t("custom_match.description") }}
          </p>
        </div>
      </div>
    </NuxtLink>
  </AnimatedCard>
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
