<template>
  <NuxtPwaManifest />
  <NuxtLayout>
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
