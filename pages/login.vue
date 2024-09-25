<script setup lang="ts">
definePageMeta({
  layout: "public",
});
</script>
<template>
  <div class="flex items-center justify-center min-h-screen">
    <Card class="w-full max-w-md">
      <CardHeader>
        <CardTitle class="text-3xl font-bold text-center">5Stack</CardTitle>
        <CardDescription class="text-center"
          >Sign in with your Steam account to get started</CardDescription
        >
      </CardHeader>
      <CardContent class="flex flex-col items-center">
        <img
          src="https://community.akamai.steamstatic.com/public/images/signinthroughsteam/sits_01.png"
          alt="Steam login"
          class="cursor-pointer"
        />
      </CardContent>
    </Card>
  </div>
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
