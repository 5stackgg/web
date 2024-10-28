<script setup lang="ts">
import AppNav from "~/layouts/components/AppNav.vue";
import AlertsContainer from "~/layouts/components/AlertsContainer.vue";
import MatchMakingConfirm from "~/components/match-making/MatchMakingConfirm.vue";
</script>

<template>
  <MatchMakingConfirm></MatchMakingConfirm>
  <AlertsContainer></AlertsContainer>
  <div class="flex min-h-screen w-full flex-col">
    <AppNav>
      <main class="m-2 md:m-8">
        <slot></slot>
      </main>
    </AppNav>
  </div>
</template>

<script lang="ts"></script>
