<script setup lang="ts">
definePageMeta({
  layout: "public",
});
</script>

<template>
  <pre>{{ useRuntimeConfig() }}</pre>
  <img
    @click="signIn"
    src="https://community.akamai.steamstatic.com/public/images/signinthroughsteam/sits_02.png"
  />
</template>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";

export default {
  methods: {
    signIn() {
      window.location = this.authLink;
    },
  },
  watch: {
    me: {
      immediate: true,
      handler(me: Record<string, unknown>) {
        if (me) {
          this.$router.push("/");
        }
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    authLink() {
      return `https://${useRuntimeConfig().public.webDomain}/auth/steam?redirect=${encodeURIComponent(
        window.location.toString(),
      )}`;
    },
  },
};
</script>
