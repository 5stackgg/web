<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FleetTelemetry from "~/components/system-telemetry/FleetTelemetry.vue";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.system_telemetry.title") }}</h1>

  <PageTransition>
    <FleetTelemetry />
  </PageTransition>
</template>
