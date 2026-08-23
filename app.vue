<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import { useBranding } from "~/composables/useBranding";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";

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

const TAB_QUERY_KEYS = new Set(["tab", "mode"]);

function pageKeyWithoutTabQuery(route: {
  name?: string | symbol | null;
  path: string;
  query: Record<string, unknown>;
  hash?: string;
  meta?: { persistQueryKeys?: string[] };
}) {
  // A plugin owns every route under its slug, so its key stops at the slug:
  // the plugin's own routes then swap views inside a mounted remote instead of
  // remounting it (and re-fetching its data) on every navigation — the same
  // reason tab/mode query keys are excluded below.
  const plugin = route.path.match(/^\/apps\/([^/]+)/);
  if (plugin) {
    return `/apps/${plugin[1]}`;
  }

  // Same idea, and for the same reason: the map is a PARAMETER of the utility
  // library, not a different page. Keying it on the path made every map switch
  // a full remount — the whole page torn down and rebuilt behind a 520ms slide,
  // the 740px board gone and back, every panel refiring its queries from
  // nothing — for what is really one prop changing. The page watches `mapName`
  // and swaps its contents in place instead.
  if (route.name === "utility-map") {
    return "/utility/:map";
  }

  const query = new URLSearchParams();
  const persisted = new Set([
    ...TAB_QUERY_KEYS,
    ...(route.meta?.persistQueryKeys ?? []),
  ]);

  Object.keys(route.query)
    .filter((key) => !persisted.has(key))
    .sort()
    .forEach((key) => {
      const value = route.query[key];
      const values = Array.isArray(value) ? value : [value];

      values.forEach((item) => {
        if (item == null) {
          return;
        }

        query.append(key, String(item));
      });
    });

  const queryString = query.toString();
  return `${route.path}${queryString ? `?${queryString}` : ""}${route.hash || ""}`;
}
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
