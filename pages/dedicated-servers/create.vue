<script setup lang="ts">
import ServerForm from "~/components/servers/ServerForm.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";

definePageMeta({ middleware: "admin" });
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.dedicated_servers.create_server") }}</h1>
  <!-- Left-aligned like the rest of admin; the bottom room keeps the last
       field clear of the floating create bar. -->
  <PageTransition class="w-full max-w-3xl pb-28">
    <ServerForm />
  </PageTransition>
</template>
