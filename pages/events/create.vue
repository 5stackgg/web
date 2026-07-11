<script setup lang="ts">
import { watch } from "vue";
import EventForm from "~/components/events/EventForm.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";

// Events are feature-gated (public.events_enabled, default off). Wait for
// settings to load before deciding, so a direct link is not falsely bounced.
const applicationSettingsStore = useApplicationSettingsStore();
watch(
  () => applicationSettingsStore.settings.length,
  () => {
    if (
      applicationSettingsStore.settings.length > 0 &&
      !applicationSettingsStore.eventsEnabled
    ) {
      navigateTo("/");
    }
  },
  { immediate: true },
);

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
