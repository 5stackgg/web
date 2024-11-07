<script setup lang="ts">
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";

const title = "5Stack | Counter-Strike Management System";
const description = "A Comprehensive Panel for Managing Servers, Matches, and Tournaments";
const url = `https://${useRuntimeConfig().public.webDomain}`

useSeoMeta({
  title: title,
  description: description,
  siteName: '5Stack',

  ogLocale: 'en',
  ogType: 'website',
  
  ogTitle: title,
  ogSiteName: '5Stack',

  ogUrl: url,
  ogImage: `${url}/_ipx/_/favicon/512.png`,
})

useServerSeoMeta({
  robots: 'index, follow',
  title: title,
  description: description,
  siteName: '5Stack',

  ogLocale: 'en',
  ogType: 'website',
  
  ogTitle: title,
  ogSiteName: '5Stack',

  ogUrl: url,
  ogImage: `${url}/_ipx/_/favicon/512.png`,
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
