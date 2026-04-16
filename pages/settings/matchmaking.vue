<script setup lang="ts">
import MatchmakingSettings from "~/components/matchmaking/MatchmakingSettings.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
definePageMeta({
  layout: "profile-settings",
});
</script>

<template>
  <PageTransition :delay="0">
    <div>
      <h3 class="text-base font-semibold uppercase tracking-wide">
        {{ $t("pages.settings.matchmaking.title") }}
      </h3>
      <p class="text-sm text-muted-foreground mt-0.5">
        {{ $t("pages.settings.matchmaking.description") }}
      </p>
    </div>
  </PageTransition>

  <PageTransition :delay="100">
    <MatchmakingSettings />
  </PageTransition>
</template>

<script lang="ts">
export default {};
</script>
