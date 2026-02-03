<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import ServerForm from "~/components/servers/ServerForm.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
</script>

<template>
  <PageTransition :delay="0">
    <PageHeading>
      <template #title>{{
        $t("pages.dedicated_servers.create.title")
      }}</template>
    </PageHeading>
  </PageTransition>
  <PageTransition :delay="100" class="mt-6">
    <AnimatedCard variant="gradient" class="w-1/2 p-4">
      <server-form></server-form>
    </AnimatedCard>
  </PageTransition>
</template>
