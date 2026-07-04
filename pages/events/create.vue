<script setup lang="ts">
import EventForm from "~/components/events/EventForm.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";

function onSaved(id: string) {
  navigateTo({ name: "events-eventId", params: { eventId: id } });
}
</script>

<template>
  <PageTransition :delay="0">
    <TacticalPageHeader>
      <template #title>{{ $t("pages.events.create") }}</template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="100" class="mt-6">
    <event-form @saved="onSaved"></event-form>
  </PageTransition>
</template>
