<template>
  <img
      @click="signIn"
      src="https://community.akamai.steamstatic.com/public/images/signinthroughsteam/sits_02.png"
  />
</template>

<script setup lang="ts">
definePageMeta({
  layout: "public",
});
</script>

<script lang="ts">
import {useAuthStore} from "~/stores/AuthStore";

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
      // TODO - use env variable
      return `https://api.5stack.gg/auth/steam?redirect=${encodeURIComponent(
          window.location.toString(),
      )}`;
    },
  },
}
</script>
