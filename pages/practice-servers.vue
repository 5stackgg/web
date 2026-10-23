<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import UtilityPracticeServersPanel from "~/components/utility/UtilityPracticeServersPanel.vue";

definePageMeta({
  middleware: "moderator",
});
</script>

<template>
  <h1 class="sr-only">
    {{ $t("layouts.app_nav.administration.practice_servers") }}
  </h1>

  <PageTransition>
    <UtilityPracticeServersPanel class="w-full max-w-3xl" />
  </PageTransition>
</template>
