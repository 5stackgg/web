<template>
  <p >
    <template v-if="match.status == e_match_status_enum.Canceled">
      Match Canceled @ {{ endOfMatch }}
    </template>
    <template v-else-if="match.status == e_match_status_enum.Finished">
      Match Finished @ {{ endOfMatch }}
    </template>
    <template v-else-if="match.status == e_match_status_enum.Warmup">
      Warmups
    </template>
    <template v-else-if="match.status == e_match_status_enum.Knife"> </template>
    <template v-else-if="match.status == e_match_status_enum.Scheduled">
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

<script setup lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
</script>

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
