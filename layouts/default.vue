<script setup lang="ts">
import AppNav from "~/layouts/components/AppNav.vue";
import AlertsContainer from "~/layouts/components/AlertsContainer.vue";
import MatchmakingConfirm from "~/components/matchmaking/MatchmakingConfirm.vue";
import PlayerNameRegistration from "~/components/PlayerNameRegistration.vue";
</script>

<template>
  <PlayerNameRegistration></PlayerNameRegistration>
  <MatchmakingConfirm></MatchmakingConfirm>
  <AlertsContainer></AlertsContainer>
  <div class="flex min-h-screen w-full flex-col">
    <AppNav>
      <main class="m-2 md:m-8">
        <slot></slot>
      </main>
    </AppNav>
  </div>
</template>

<script lang="ts">
export default {};
</script>
