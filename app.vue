<template>
  <NuxtLayout>

    <div
        v-if="$pwa?.offlineReady || $pwa?.needRefresh"
        class="pwa-toast"
        role="alert"
    >
      <div class="message">
          <span v-if="$pwa.offlineReady">
            App ready to work offline
          </span>
        <span v-else>
            New content available, click on reload button to update.
          </span>
      </div>
      <button
          v-if="$pwa.needRefresh"
          @click="$pwa.updateServiceWorker()"
      >
        Reload
      </button>
      <button @click="$pwa.cancelPrompt()">
        Close
      </button>
    </div>
    <div
        v-if="$pwa?.showInstallPrompt && !$pwa?.offlineReady && !$pwa?.needRefresh"
        class="pwa-toast"
        role="alert"
    >
      <div class="message">
          <span>
            Install PWA
          </span>
      </div>
      <button @click="$pwa.install()">
        Install
      </button>
      <button @click="$pwa.cancelInstall()">
        Cancel
      </button>
    </div>

    <NuxtPwaManifest />
    <NuxtPage></NuxtPage>
  </NuxtLayout>
  <Toaster />
</template>

<script>
export default {
  beforeCreate() {
    useHead({
      title: "5stack",
      meta: [{ name: "description", content: "5stack.gg" }],
      link: [
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/favicon/apple-touch-icon.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/favicon/favicon-32x32.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "16x16",
          href: "/favicon/favicon-16x16.png",
        },
        { rel: "manifest", href: "/favicon/manifest.json" },
        {
          rel: "mask-icon",
          href: "/favicon/safari-pinned-tab.svg",
          color: "#48acf0",
        },
        { rel: "shortcut icon", href: "/favicon/favicon.ico" },
      ],
    });
  },
};
</script>
