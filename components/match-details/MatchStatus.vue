<template>
  <p class="mt-1 text-gray-600 dark:text-gray-400">
    <template v-if="match.status == 'Canceled'">
      Match Canceled @ {{ endOfMatch }}
    </template>
    <template v-else-if="match.status == 'Finished'">
      Match Finished @ {{ endOfMatch }}
    </template>
    <template v-else-if="match.status == 'Warmup'"> Warmups </template>
    <template v-else-if="match.status == 'Knife'"> </template>
    <template v-else-if="match.status == 'Scheduled'">
      Match is Scheduled for
      <template v-if="match.scheduled_at">
        <time-ago :date="match.scheduled_at"></time-ago>
      </template>
      <template v-else> ASAP </template>
    </template>
    <template v-else-if="startOfMatch">
      Match has been going on for
      <time-ago :date="startOfMatch"></time-ago>
    </template>
    <template v-else>
      {{ match.status }}
    </template>
  </p>
</template>
<script lang="ts">
export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  computed: {
    startOfMatch() {
      // TODO
    },
    endOfMatch() {
      // TODO
    },
  },
};
</script>
