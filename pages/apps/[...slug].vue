<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import PluginRemote from "~/components/plugins/PluginRemote.vue";

const route = useRoute();
const router = useRouter();

// ---- the plugin routing contract --------------------------------------------
// Everything under /apps/<slug>/ belongs to the plugin. The host owns the slug
// segment (that's how it resolves WHICH remote to load) and hands the remote the
// rest of the path plus a `navigate` callback — so a plugin can have real,
// linkable, back-button-able routes without shipping its own router, and without
// knowing it happens to be mounted under /apps/<slug>.
// One catch-all page, not [slug]/[[...path]]: Nuxt mis-parses an optional
// catch-all nested inside a dynamic directory — it emits "/apps/:slug()/:path(.*)*]"
// with a stray bracket, which matches nothing. So take every segment and split
// it here: first is the plugin slug, the rest is the plugin's own path.
//
// Resolving and mounting the remote itself lives in PluginRemote, which other
// hosts (the player-profile tabs) reuse with their own routing.
const segments = computed(() => {
  const parts = route.params.slug;
  return (Array.isArray(parts) ? parts : parts ? [parts] : []).filter(Boolean);
});
const slug = computed(() => segments.value[0] ?? "");
const base = computed(() => `/apps/${slug.value}`);
const subPath = computed(
  () => `/${segments.value.slice(1).join("/")}`.replace(/\/+$/, "") || "/",
);

function navigate(
  to: string,
  options: { replace?: boolean; query?: Record<string, unknown> } = {},
) {
  // Plugins navigate in their OWN space ("/admin"), never the host's.
  const path =
    `${base.value}${to.startsWith("/") ? to : `/${to}`}`.replace(/\/$/, "") ||
    base.value;
  const target = { path, query: options.query ?? route.query };
  return options.replace ? router.replace(target) : router.push(target);
}
</script>

<template>
  <PluginRemote
    :slug="slug"
    :base="base"
    :path="subPath"
    :query="route.query"
    :navigate="navigate"
  />
</template>
