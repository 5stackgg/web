<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
// @ts-expect-error virtual module provided by @originjs/vite-plugin-federation
import {
  __federation_method_setRemote,
  __federation_method_getRemote,
  __federation_method_unwrapDefault,
} from "__federation__";
import { useCustomPagesStore } from "~/stores/CustomPages";
import { useAuthStore } from "~/stores/AuthStore";
import LoadingScreen from "~/components/LoadingScreen.vue";

const route = useRoute();
const customPages = useCustomPagesStore();
const authStore = useAuthStore();

type Status = "loading" | "ready" | "error" | "forbidden" | "not-found";

const RemoteComponent = shallowRef<unknown>(null);
const status = ref<Status>("loading");
const errorMessage = ref("");

const registeredScopes = new Set<string>();

async function loadPage(slug: string) {
  status.value = "loading";
  RemoteComponent.value = null;

  const page = customPages.pageBySlug(slug);
  if (!page) {
    status.value = "not-found";
    return;
  }
  if (!customPages.canSee(page)) {
    status.value = "forbidden";
    return;
  }

  try {
    if (!registeredScopes.has(page.remote_scope)) {
      // remoteEntry.js keeps a stable filename but changes every build, so
      // cache-bust it (CDNs/browsers would otherwise serve a stale copy — or a
      // stale 404). The hashed chunks it references stay cacheable.
      const bust = `v=${Date.now()}`;
      const url = page.remote_entry_url.includes("?")
        ? `${page.remote_entry_url}&${bust}`
        : `${page.remote_entry_url}?${bust}`;
      __federation_method_setRemote(page.remote_scope, {
        url: () => Promise.resolve(url),
        format: "esm",
        from: "vite",
      });
      registeredScopes.add(page.remote_scope);
    }

    const module = await __federation_method_getRemote(
      page.remote_scope,
      page.exposed_module,
    );
    RemoteComponent.value = await __federation_method_unwrapDefault(module);
    status.value = "ready";
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : String(error);
    status.value = "error";
  }
}

// The registry arrives via subscription; wait for the first payload before
// resolving a slug so a cold load doesn't flash "not found".
watch(
  () =>
    [route.params.slug, customPages.initialized] as [
      string | string[],
      boolean,
    ],
  ([slug, initialized]) => {
    if (initialized && typeof slug === "string") {
      loadPage(slug);
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
    />

    <div
      v-else
      class="flex h-full w-full flex-col items-center justify-center gap-2 p-8 text-center"
    >
      <template v-if="status === 'not-found'">
        <h2 class="text-xl font-semibold">
          {{ $t("pages.custom_pages.not_found_title") }}
        </h2>
        <p class="text-muted-foreground">
          {{ $t("pages.custom_pages.not_found_description") }}
        </p>
      </template>

      <template v-else-if="status === 'forbidden'">
        <h2 class="text-xl font-semibold">
          {{ $t("pages.custom_pages.forbidden_title") }}
        </h2>
        <p class="text-muted-foreground">
          {{ $t("pages.custom_pages.forbidden_description") }}
        </p>
      </template>

      <template v-else>
        <h2 class="text-xl font-semibold">
          {{ $t("pages.custom_pages.error_title") }}
        </h2>
        <p class="max-w-lg break-words text-muted-foreground">
          {{ errorMessage }}
        </p>
      </template>
    </div>
  </div>
</template>
