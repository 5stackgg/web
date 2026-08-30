<script setup lang="ts">
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FleetTelemetry from "~/components/system-telemetry/FleetTelemetry.vue";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <div class="relative space-y-6">
    <PageTransition>
      <TacticalPageHeader>
        <template #title>{{ $t("pages.system_telemetry.title") }}</template>
      </TacticalPageHeader>
    </PageTransition>

    <PageTransition :delay="60">
      <FleetTelemetry />
    </PageTransition>
  </div>
</template>
