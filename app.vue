<script setup lang="ts">
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
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
