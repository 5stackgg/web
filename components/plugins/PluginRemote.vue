<script lang="ts">
// Module scope, not component scope: the federation cache is global, so a
// remount of a host that renders a remote must not re-register a scope with a
// fresh cache-bust URL and re-download remoteEntry.js every navigation.
const registeredScopes = new Set<string>();
</script>

<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";
// @ts-expect-error virtual module provided by @originjs/vite-plugin-federation
import {
  __federation_method_setRemote,
  __federation_method_getRemote,
  __federation_method_unwrapDefault,
} from "__federation__";
import { usePluginsStore } from "~/stores/Plugins";
import { useAuthStore } from "~/stores/AuthStore";
import LoadingScreen from "~/components/LoadingScreen.vue";

// Resolves a plugin by slug and mounts its remote. Routing is deliberately NOT
// owned here — the caller passes `path`/`query`/`navigate`, because where a
// plugin's navigation should go depends on where it is mounted. Under
// /apps/<slug> that's the host router; inside a player-profile tab it's local
// state, so clicking around in the plugin doesn't blow the user off the page.
const props = defineProps<{
  slug: string;
  base: string;
  path: string;
  query: Record<string, unknown>;
  navigate: (
    to: string,
    options?: { replace?: boolean; query?: Record<string, unknown> },
  ) => unknown;
  // The escape hatch from the above: `navigate` deliberately keeps the user
  // where they are, so a plugin that wants to send them to its own full page
  // needs a channel that moves the HOST router. Optional — hosts where the
  // plugin already owns the screen have nowhere to send them.
  navigateApp?: (to: string) => unknown;
}>();

const plugins = usePluginsStore();
const authStore = useAuthStore();

type Status = "loading" | "ready" | "error" | "forbidden" | "not-found";

const RemoteComponent = shallowRef<unknown>(null);
const status = ref<Status>("loading");
const errorMessage = ref("");

let loadGeneration = 0;

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
// Watches the slug STRING (not a route object) on purpose: the plugin's own
// navigation changes `path`, and re-running loadPlugin there would tear down
// and remount the remote on every route change it makes.
watch(
  () => `${plugins.initialized ? "1" : "0"}:${props.slug}`,
  () => {
    if (plugins.initialized && props.slug) {
      loadPlugin(props.slug);
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
      :path="path"
      :query="query"
      :navigate="navigate"
      :navigate-app="navigateApp"
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
