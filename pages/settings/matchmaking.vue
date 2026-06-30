<script setup lang="ts">
import MatchmakingSettings from "~/components/matchmaking/MatchmakingSettings.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
</script>

<template>
  <PageTransition :delay="0">
    <MatchmakingSettings />
  </PageTransition>
</template>

<script lang="ts">
export default {};
</script>
