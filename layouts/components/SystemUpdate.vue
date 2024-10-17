<script lang="ts" setup></script>

<template>
  <div v-if="hasUpdatesAvailalbe"></div>
</template>

<script lang="ts">
export default {
  computed: {
    hasUpdatesAvailalbe() {
      useApplicationSettingsStore().hasUpdates;
    },
  },
};
</script>
