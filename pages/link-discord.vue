<template></template>

<script lang="ts">
export default {
  watch: {
    me: {
      immediate: true,
      handler() {
        if (useAuthStore().hasDiscordLinked) {
          this.$router.push("/");
          return;
        }
        window.location.href = `https://${useRuntimeConfig().public.webDomain}/auth/discord`;
      },
    },
  },
};
</script>
