<script setup lang="ts">
import { computed } from "vue";
import { useSystemAlertsStore } from "~/stores/SystemAlertsStore";
import SystemAlertBannerItem from "~/components/SystemAlertBannerItem.vue";

const systemAlertsStore = useSystemAlertsStore();

const alerts = computed(() => systemAlertsStore.visibleAlerts);
</script>

<template>
  <TransitionGroup tag="div" name="alert">
    <!-- grid-rows 1fr<->0fr collapse animates height without measuring it,
         so the page below slides instead of jumping. -->
    <div v-for="alert in alerts" :key="alert.id" class="alert-row">
      <div class="min-h-0 overflow-hidden">
        <SystemAlertBannerItem
          :type="alert.type"
          :title="alert.title"
          :message="alert.message"
          :dismissible="alert.dismissible"
          @dismiss="systemAlertsStore.dismiss(alert.id)"
        />
      </div>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.alert-row {
  display: grid;
  grid-template-rows: 1fr;
}

.alert-enter-active,
.alert-leave-active {
  transition:
    grid-template-rows 280ms ease,
    opacity 280ms ease;
}

.alert-enter-from,
.alert-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

/* When an alert in the middle is removed, slide the others into place. */
.alert-move {
  transition: transform 280ms ease;
}
</style>
