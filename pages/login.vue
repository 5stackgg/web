<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
import { useBranding } from "~/composables/useBranding";

definePageMeta({
  layout: "public",
});

const { brandName, logoUrl, loginFooterText, loginFooterUrl, loginShowFooter } = useBranding();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center min-h-screen bg-black gap-6"
  >
    <PageTransition>
      <img
        v-if="logoUrl"
        class="max-w-48 max-h-48 shadow-lg object-contain"
        :src="logoUrl"
      />
      <NuxtImg
        v-else
        class="rounded-full w-32 h-32 shadow-lg"
        src="/favicon/512.png"
      />
    </PageTransition>

    <PageTransition :delay="100">
      <AnimatedCard variant="gradient" class="w-full max-w-md">
        <CardHeader>
          <CardTitle class="text-3xl font-bold text-center">{{ brandName || '5Stack' }}</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col items-center">
          <img
            src="https://community.akamai.steamstatic.com/public/images/signinthroughsteam/sits_01.png"
            alt="Steam login"
            class="cursor-pointer hover:opacity-80 transition-opacity"
            @click="signIn"
          />
        </CardContent>
      </AnimatedCard>
    </PageTransition>

    <PageTransition v-if="loginShowFooter" :delay="200">
      <div>
        <a
          :href="loginFooterUrl || 'https://github.com/5stackgg/5stack-panel'"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {{ $t("pages.login.powered_by") }} {{ loginFooterText || '5stack.gg' }}
          <GithubLogoIcon v-if="(loginFooterUrl || 'https://github.com/5stackgg/5stack-panel').includes('github.com')" class="w-4 h-4" />
          <ExternalLink v-else class="w-4 h-4" />
        </a>
      </div>
    </PageTransition>
  </div>
</template>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";
import { GithubLogoIcon } from "@radix-icons/vue";
import { ExternalLink } from "lucide-vue-next";

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
