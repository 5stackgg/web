<script setup lang="ts">
// The events list now lives on /events (with an "only mine" filter); kept so
// old links land there instead of falling into [eventId].
definePageMeta({
  middleware: () => navigateTo({ name: "events" }, { replace: true }),
});
</script>

<template>
  <div />
</template>
