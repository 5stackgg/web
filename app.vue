<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import { useBranding } from "~/composables/useBranding";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";
import { pageKeyWithoutTabQuery } from "~/utilities/pageKey";

const MatchmakingConfirm = defineAsyncComponent(
  () => import("~/components/matchmaking/MatchmakingConfirm.vue"),
);
const MatchActiveAlert = defineAsyncComponent(
  () => import("~/components/match/MatchActiveAlert.vue"),
);
const DraftActiveAlert = defineAsyncComponent(
  () => import("~/components/draft-games/DraftActiveAlert.vue"),
);
const PlayerNameRegistration = defineAsyncComponent(
  () => import("~/components/PlayerNameRegistration.vue"),
);
const StreamGlobal = defineAsyncComponent(
  () => import("~/components/StreamGlobal.vue"),
);

polyfillCountryFlagEmojis();

const { brandName } = useBranding();
const { t } = useI18n();

// Single, stable manifest link. 5stack.gg keeps the static build manifest; every
// other (white-label) host points at the host-aware Nitro route. Setting it once
// here — instead of swapping a NuxtPwaManifest-injected link at runtime — avoids
// Chrome seeing the static "5stack" manifest first and prompting a name "update".
const manifestHref =
  typeof window !== "undefined" && window.location.hostname === "5stack.gg"
    ? "/manifest.webmanifest"
    : "/branding/manifest.webmanifest";

// Every avatar, banner and clip thumbnail is served from the API origin, which
// is a different host to the panel. The LCP element on /watch is one of those
// banners, and its request cannot even be issued until the page's GraphQL has
// resolved -- so without this the DNS + TCP + TLS handshake to that origin is
// paid at ~4.1s, right on the critical path. Warming it during boot moves that
// cost off the LCP chain entirely.
//
// Deliberately without `crossorigin`: the browser pools connections by
// credentials mode, and NuxtImg renders a bare <img src> with no crossorigin
// attribute. An anonymous-CORS socket is one those images cannot reuse, so the
// handshake this exists to remove would still be paid -- on a second
// connection, with the warmed one left idle.
const apiOrigin = (() => {
  const domain = useRuntimeConfig().public.apiDomain;
  if (!domain) {
    return undefined;
  }
  return domain.startsWith("http") ? domain : `https://${domain}`;
})();

useHead({
  title: () => brandName.value || "5Stack",
  titleTemplate: (pageTitle?: string) => {
    const base = brandName.value || "5Stack";
    if (pageTitle && pageTitle !== base) {
      return `${pageTitle} | ${base}`;
    }
    return `${base} | ${t("branding.site_title_suffix")}`;
  },
  link: [
    { rel: "manifest", href: manifestHref },
    ...(apiOrigin
      ? [
          { rel: "preconnect", href: apiOrigin },
          { rel: "dns-prefetch", href: apiOrigin },
        ]
      : []),
  ],
  // iOS home-screen label — plain brand name, no " | …" suffix.
  meta: [
    {
      name: "apple-mobile-web-app-title",
      content: () => brandName.value || "5Stack",
    },
  ],
});

const authStore = useAuthStore();
const applicationSettingsStore = useApplicationSettingsStore();

const me = computed(() => authStore.me);
const hasGlobalStream = computed(() => !!applicationSettingsStore.globalStream);
</script>

<template>
  <StreamGlobal v-if="hasGlobalStream" />

  <div v-if="me" style="display: contents">
    <PlayerNameRegistration />
    <MatchmakingConfirm />
    <MatchActiveAlert />
    <DraftActiveAlert />
  </div>

  <NuxtLayout>
    <NuxtPage :page-key="pageKeyWithoutTabQuery" />
  </NuxtLayout>
  <Toaster />
</template>
