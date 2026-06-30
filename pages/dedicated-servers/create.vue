<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import ServerForm from "~/components/servers/ServerForm.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
</script>

<template>
  <PageTransition :delay="0">
    <PageHeading>
      <template #title>{{
        $t("pages.dedicated_servers.create.title")
      }}</template>
    </PageHeading>
  </PageTransition>
  <PageTransition :delay="100" class="mx-auto mt-6 w-full max-w-2xl">
    <server-form></server-form>
  </PageTransition>
</template>
