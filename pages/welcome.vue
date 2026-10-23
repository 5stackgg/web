<script setup lang="ts">
import { useI18n } from "vue-i18n";
import LandingPage from "~/components/landing/LandingPage.vue";
import { useBranding } from "~/composables/useBranding";

definePageMeta({
  layout: false,
});

const { t } = useI18n();
const { brandName } = useBranding();

useHead({
  title: () => t("pages.welcome.meta_title"),
  meta: [
    {
      name: "description",
      content: () =>
        t("pages.welcome.meta_description", {
          name: brandName.value || "5Stack",
        }),
    },
  ],
});
</script>

<template>
  <LandingPage />
</template>
