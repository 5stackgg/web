<script lang="ts">
// Module scope, not component scope: the federation cache is global, so a
// remount of this catch-all page must not re-register a scope with a fresh
// cache-bust URL and re-download remoteEntry.js every navigation.
const registeredScopes = new Set<string>();
</script>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
// @ts-expect-error virtual module provided by @originjs/vite-plugin-federation
import {
  __federation_method_setRemote,
  __federation_method_getRemote,
  __federation_method_unwrapDefault,
} from "__federation__";
import { usePluginsStore } from "~/stores/Plugins";
import { useAuthStore } from "~/stores/AuthStore";
import LoadingScreen from "~/components/LoadingScreen.vue";

const route = useRoute();
const router = useRouter();
const plugins = usePluginsStore();
const authStore = useAuthStore();

type Status = "loading" | "ready" | "error" | "forbidden" | "not-found";

const RemoteComponent = shallowRef<unknown>(null);
const status = ref<Status>("loading");
const errorMessage = ref("");

let loadGeneration = 0;

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

async function loadPlugin(slug: string) {
  // Two in-flight loads (fast slug switch) can resolve out of order; only the
  // latest generation may write the result.
  const generation = ++loadGeneration;
  status.value = "loading";
  RemoteComponent.value = null;

  const plugin = plugins.pluginBySlug(slug);
  if (!plugin) {
    status.value = "not-found";
    return;
  }
  if (!plugins.canSee(plugin)) {
    status.value = "forbidden";
    return;
  }

  try {
    if (!registeredScopes.has(plugin.remote_scope)) {
      // remoteEntry.js keeps a stable filename but changes every build, so
      // cache-bust it (CDNs/browsers would otherwise serve a stale copy — or a
      // stale 404). The hashed chunks it references stay cacheable.
      const bust = `v=${Date.now()}`;
      const url = plugin.remote_entry_url.includes("?")
        ? `${plugin.remote_entry_url}&${bust}`
        : `${plugin.remote_entry_url}?${bust}`;
      __federation_method_setRemote(plugin.remote_scope, {
        url: () => Promise.resolve(url),
        format: "esm",
        from: "vite",
      });
      registeredScopes.add(plugin.remote_scope);
    }

    const module = await __federation_method_getRemote(
      plugin.remote_scope,
      plugin.exposed_module,
    );
    const component = await __federation_method_unwrapDefault(module);
    if (generation !== loadGeneration) {
      return;
    }
    RemoteComponent.value = component;
    status.value = "ready";
  } catch (error) {
    if (generation !== loadGeneration) {
      return;
    }
    errorMessage.value =
      error instanceof Error ? error.message : String(error);
    status.value = "error";
  }
}

// The registry arrives via subscription; wait for the first payload before
// resolving a slug so a cold load doesn't flash "not found".
//
// Watches the slug STRING (not route.params) on purpose: the plugin's own
// navigation changes the path, and re-running loadPlugin there would tear down and
// remount the remote on every route change it makes.
watch(
  () => `${plugins.initialized ? "1" : "0"}:${slug.value}`,
  () => {
    if (plugins.initialized && slug.value) {
      loadPlugin(slug.value);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="h-full w-full">
    <LoadingScreen v-if="status === 'loading'" />

    <component
      :is="RemoteComponent"
      v-else-if="status === 'ready'"
      :user="authStore.me"
      :base="base"
      :path="subPath"
      :query="route.query"
      :navigate="navigate"
    />

    <div
      v-else
      class="flex h-full w-full flex-col items-center justify-center gap-2 p-8 text-center"
    >
      <template v-if="status === 'not-found'">
        <h2 class="text-xl font-semibold">
          {{ $t("pages.plugins.not_found_title") }}
        </h2>
        <p class="text-muted-foreground">
          {{ $t("pages.plugins.not_found_description") }}
        </p>
      </template>

      <template v-else-if="status === 'forbidden'">
        <h2 class="text-xl font-semibold">
          {{ $t("pages.plugins.forbidden_title") }}
        </h2>
        <p class="text-muted-foreground">
          {{ $t("pages.plugins.forbidden_description") }}
        </p>
      </template>

      <template v-else>
        <h2 class="text-xl font-semibold">
          {{ $t("pages.plugins.error_title") }}
        </h2>
        <p class="max-w-lg break-words text-muted-foreground">
          {{ errorMessage }}
        </p>
      </template>
    </div>
  </div>
</template>
