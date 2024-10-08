<template></template>

<script lang="ts">
export default {
  mounted() {
    window.location.href = `https://${useRuntimeConfig().public.webDomain}/auth/discord`;
  },
};
</script>
