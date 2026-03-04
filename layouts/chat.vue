<script setup lang="ts">
// Minimal layout for pop-out chat window: no nav, no sidebar, no header.
</script>

<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden bg-background">
    <slot />
  </div>
</template>
