<script setup lang="ts">
// The organizer list now lives on /tournaments (Filters → only mine).
definePageMeta({
  middleware: () => navigateTo({ name: "tournaments" }, { replace: true }),
});
</script>

<template>
  <div />
</template>
