<script setup lang="ts">
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";

const title = "5Stack | Counter-Strike Management System";
const description = "A Comprehensive Panel for Managing Servers, Matches, and Tournaments";

useSeoMeta({
  title: title,
  ogTitle: title,
  description: description,
  ogDescription: description,
  ogImage: 'https://5stack.gg/_ipx/_/favicon/512.png',
  twitterCard: 'summary_large_image',
})

useServerSeoMeta({
  robots: 'index, follow',
  title: title,
  ogTitle: title,
  description: description,
  ogDescription: description,
  ogImage: 'https://5stack.gg/_ipx/_/favicon/512.png',
  twitterCard: 'summary_large_image',
})
</script>


<template>
  <NuxtPwaManifest />
  <NuxtLayout>
    <NuxtPage></NuxtPage>
  </NuxtLayout>
  <Toaster />
</template>

<script lang="ts">

export default {
  beforeCreate() {
    polyfillCountryFlagEmojis();
  },
};
</script>
