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
const PlayerNameRegistration = defineAsyncComponent(
  () => import("~/components/PlayerNameRegistration.vue"),
);
const StreamGlobal = defineAsyncComponent(
  () => import("~/components/StreamGlobal.vue"),
);

polyfillCountryFlagEmojis();

const { brandName } = useBranding();
const { t } = useI18n();

useHead({
  title: () => brandName.value || "5Stack",
  titleTemplate: (pageTitle?: string) => {
    const base = brandName.value || "5Stack";
    if (pageTitle && pageTitle !== base) {
      return `${pageTitle} | ${base}`;
    }
    return `${base} | ${t("branding.site_title_suffix")}`;
  },
});

const authStore = useAuthStore();
const applicationSettingsStore = useApplicationSettingsStore();

const me = computed(() => authStore.me);
const hasGlobalStream = computed(() => !!applicationSettingsStore.globalStream);

const TAB_QUERY_KEYS = new Set(["tab", "mode"]);

function pageKeyWithoutTabQuery(route: {
  path: string;
  query: Record<string, unknown>;
  hash?: string;
  meta?: { persistQueryKeys?: string[] };
}) {
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
  <NuxtPwaManifest />

  <StreamGlobal v-if="hasGlobalStream" />

  <div v-if="me" style="display: contents">
    <PlayerNameRegistration />
    <MatchmakingConfirm />
    <MatchActiveAlert />
  </div>

  <NuxtLayout>
    <NuxtPage :page-key="pageKeyWithoutTabQuery" />
  </NuxtLayout>
  <Toaster />
</template>
