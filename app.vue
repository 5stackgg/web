<template>
  <NuxtLayout>
    <div
      v-if="$pwa?.offlineReady || $pwa?.needRefresh"
      class="pwa-toast"
      role="alert"
    >
      <div class="message">
        <span v-if="$pwa.offlineReady"> App ready to work offline </span>
        <span v-else>
          New content available, click on reload button to update.
        </span>
      </div>
      <button v-if="$pwa.needRefresh" @click="$pwa.updateServiceWorker()">
        Reload
      </button>
      <button @click="$pwa.cancelPrompt()">Close</button>
    </div>
    <div
      v-if="
        $pwa?.showInstallPrompt && !$pwa?.offlineReady && !$pwa?.needRefresh
      "
      class="pwa-toast"
      role="alert"
    >
      <div class="message">
        <span> Install PWA </span>
      </div>
      <button @click="$pwa.install()">Install</button>
      <button @click="$pwa.cancelInstall()">Cancel</button>
    </div>

    <NuxtPwaManifest />
    <NuxtPage></NuxtPage>
  </NuxtLayout>
  <Toaster />
</template>

<script>
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";

export default {
  beforeCreate() {
    useHead({
      title: "5stack",
      meta: [{ name: "description", content: "5stack.gg" }],
    });

    polyfillCountryFlagEmojis();
  },
};
</script>
