<script setup lang="ts">
import AppNav from "~/layouts/components/AppNav.vue";
</script>

<template>
  <div class="flex min-h-screen w-full flex-col bg-muted/40">
    <div class="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
      <app-nav></app-nav>
      <main class="p-4 sm:px-6 sm:py-0">
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
