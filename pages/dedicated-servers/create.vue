<script setup lang="ts">
import ServerForm from "~/components/servers/ServerForm.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";

definePageMeta({ middleware: "admin" });
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.dedicated_servers.create.title") }}</h1>
  <PageTransition class="mx-auto w-full max-w-2xl">
    <server-form></server-form>
  </PageTransition>
</template>
