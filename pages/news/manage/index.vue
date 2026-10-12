<script setup lang="ts">
// Drafts, publishing and view counts now live on /news for authors; kept so
// old links land there instead of falling into [id].
definePageMeta({
  middleware: () => navigateTo({ name: "news" }, { replace: true }),
});
</script>

<template>
  <div />
</template>
