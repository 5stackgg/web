<script setup lang="ts">
definePageMeta({
  layout: "public",
});
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen bg-black">
    <NuxtImg
      class="rounded-full w-32 h-32 mb-8 shadow-lg"
      src="/favicon/512.png"
    />
    <Card class="w-full max-w-md">
      <CardHeader>
        <CardTitle class="text-3xl font-bold text-center">5Stack</CardTitle>
        <CardDescription class="text-center">
          {{ $t("pages.login.sign_in") }}
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col items-center">
        <img
          src="https://community.akamai.steamstatic.com/public/images/signinthroughsteam/sits_01.png"
          alt="Steam login"
          class="cursor-pointer hover:opacity-80 transition-opacity"
          @click="signIn"
        />
      </CardContent>
    </Card>

    <div class="mt-8">
      <a
        href="https://github.com/5stackgg/5stack-panel"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {{ $t("pages.login.powered_by") }} 5stack.gg
        <GithubLogoIcon class="w-4 h-4" />
      </a>
    </div>
  </div>
</template>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";
import { GithubLogoIcon } from "@radix-icons/vue";

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
