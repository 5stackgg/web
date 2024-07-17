<script setup lang="ts">
import AppNav from "~/layouts/components/AppNav.vue";
import AlertsContainer from "~/layouts/components/AlertsContainer.vue";
</script>

<template>
  <alerts-container></alerts-container>
  <div class="flex min-h-screen w-full flex-col bg-muted/40">
    <div class="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
      <app-nav></app-nav>
      <main class="m-8">
        <slot></slot>
      </main>
    </div>
  </div>
</template>

<script lang="ts">
import socket from "~/web-sockets/Socket";

export default {
  created() {
    socket.connect();
  },
};
</script>
