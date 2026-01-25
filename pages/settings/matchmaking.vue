<script setup lang="ts">
import MatchmakingSettings from "~/components/matchmaking/MatchmakingSettings.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
definePageMeta({
  layout: "profile-settings",
});
</script>

<template>
  <PageTransition :delay="0">
    <div class="p-4 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">
            {{ $t("pages.settings.matchmaking.title") }}
          </h1>
          <p class="text-gray-400 mt-1">
            {{ $t("pages.settings.matchmaking.description") }}
          </p>
        </div>
      </div>
    </div>
  </PageTransition>

  <PageTransition :delay="100">
    <MatchmakingSettings />
  </PageTransition>
</template>

<script lang="ts">
export default {};
</script>
