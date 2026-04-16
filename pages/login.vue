<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { useBranding } from "~/composables/useBranding";
import TopoBackground from "~/layouts/components/TopoBackground.vue";

definePageMeta({
  layout: "public",
});

const { brandName, logoUrl, loginFooterText, loginFooterUrl, loginShowFooter } =
  useBranding();

const waypointClasses =
  "relative flex h-[6.5rem] w-[6.5rem] items-center justify-center sm:h-[7.5rem] sm:w-[7.5rem]";

const wordmarkTitleClasses =
  "relative m-0 font-sans text-[clamp(2.75rem,7vw,4.5rem)] font-bold uppercase leading-[0.92] tracking-[0.025em] [font-stretch:80%]";

const loginFooterLinkClasses =
  "inline-flex items-center gap-2 px-[0.2rem] py-[0.4rem] font-sans text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground no-underline transition-colors duration-150 hover:text-foreground";
</script>

<template>
  <TopoBackground animated />
  <div
    class="relative z-10 flex min-h-screen flex-col items-center justify-center gap-7 px-4 py-16"
  >
    <PageTransition>
      <div class="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
        <div :class="waypointClasses">
          <img
            v-if="logoUrl"
            :src="logoUrl"
            :alt="brandName || '5Stack'"
            class="relative max-h-[78%] max-w-[78%] object-contain [filter:drop-shadow(0_0_12px_hsl(var(--tac-amber)/0.28))]"
          />
          <NuxtImg
            v-else
            src="/favicon/512.png"
            :alt="brandName || '5Stack'"
            class="relative max-h-[78%] max-w-[78%] rounded-full object-contain [filter:drop-shadow(0_0_12px_hsl(var(--tac-amber)/0.28))]"
          />
        </div>

        <div
          class="flex flex-col items-center gap-[0.65rem] text-center sm:items-start sm:text-left"
        >
          <span
            class="inline-flex items-center gap-2 font-sans text-[0.7rem] font-medium uppercase tracking-[0.32em] text-muted-foreground"
          >
            <span class="translate-y-[-1px] text-[0.6rem] text-[hsl(var(--tac-amber))]"
              >◢</span
            >
            AUTHORIZE
            <span class="text-[hsl(var(--muted-foreground)/0.55)]"
              >/ SECURE ACCESS</span
            >
          </span>
          <h1 :class="wordmarkTitleClasses">
            <span
              aria-hidden="true"
              class="pointer-events-none absolute left-[5px] top-[5px] select-none text-transparent [-webkit-text-stroke:1.2px_hsl(var(--tac-amber)/0.4)]"
            >
              {{ brandName || "5Stack" }}
            </span>
            <span
              class="relative bg-[linear-gradient(180deg,hsl(var(--foreground))_0%,hsl(var(--foreground)/0.7)_100%)] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
            >
              {{ brandName || "5Stack" }}
            </span>
          </h1>
          <span
            aria-hidden="true"
            class="relative block h-px w-[140px] bg-[linear-gradient(90deg,transparent,hsl(var(--foreground)/0.22)_30%,hsl(var(--foreground)/0.22)_70%,transparent)] sm:bg-[linear-gradient(90deg,hsl(var(--foreground)/0.22)_0%,hsl(var(--foreground)/0.22)_70%,transparent)]"
          >
            <span
              class="absolute left-1/2 top-[-3px] h-[7px] w-[7px] -translate-x-1/2 rotate-45 bg-[hsl(var(--tac-amber))] sm:left-[14px]"
            ></span>
          </span>
        </div>
      </div>
    </PageTransition>

    <PageTransition :delay="160">
      <button
        type="button"
        @click="signIn"
        :aria-label="$t ? $t('layouts.top_nav.login') : 'Sign in through Steam'"
        class="group relative border border-border bg-[linear-gradient(180deg,hsl(var(--card)/0.6)_0%,hsl(var(--card)/0.35)_100%)] px-[1.1rem] py-[0.85rem] transition-[background-color,border-color,transform] duration-200 [clip-path:polygon(10px_0,100%_0,100%_calc(100%-10px),calc(100%-10px)_100%,0_100%,0_10px)] hover:border-[hsl(var(--tac-amber)/0.55)] hover:bg-[linear-gradient(180deg,hsl(var(--tac-amber)/0.15)_0%,hsl(var(--tac-amber)/0.05)_100%)] active:translate-y-px"
      >
        <span
          aria-hidden="true"
          class="pointer-events-none absolute left-1 top-1 h-[10px] w-[10px] border-l-[1.5px] border-t-[1.5px] border-[hsl(var(--tac-amber))]"
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute bottom-1 right-1 h-[10px] w-[10px] border-b-[1.5px] border-r-[1.5px] border-[hsl(var(--tac-amber))]"
        ></span>
        <img
          src="https://community.akamai.steamstatic.com/public/images/signinthroughsteam/sits_01.png"
          :alt="$t('alt_text.steam_login')"
          class="block transition-opacity duration-200 group-hover:opacity-90"
        />
      </button>
    </PageTransition>

    <PageTransition v-if="loginShowFooter" :delay="240">
      <div>
        <a
          :href="loginFooterUrl || 'https://github.com/5stackgg/5stack-panel'"
          target="_blank"
          rel="noopener noreferrer"
          :class="loginFooterLinkClasses"
        >
          {{ loginFooterText || "5stack.gg" }}
          <GithubLogoIcon
            v-if="
              (
                loginFooterUrl || 'https://github.com/5stackgg/5stack-panel'
              ).includes('github.com')
            "
            class="h-4 w-4"
          />
          <ExternalLink v-else class="h-4 w-4" />
        </a>
      </div>
    </PageTransition>
  </div>
</template>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";
import { GithubLogoIcon } from "@radix-icons/vue";
import { ExternalLink } from "lucide-vue-next";
import { loginLinks } from "~/utilities/loginLinks";

export default {
  methods: {
    signIn() {
      window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(window.location.toString())}`;
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
  },
};
</script>
