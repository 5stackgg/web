<script setup lang="ts">
import { watch } from "vue";
import EventForm from "~/components/events/EventForm.vue";
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
  <h1 class="sr-only">{{ $t("pages.events.create") }}</h1>
  <PageTransition>
    <event-form @saved="onSaved"></event-form>
  </PageTransition>
</template>
