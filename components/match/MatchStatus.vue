
<script setup lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
import TimeAgo from "~/components/TimeAgo.vue";
</script>

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
      <div v-if="match.server_id && !match.is_match_server_available">
        Waiting for Server to become available ...
      </div>
      <div v-else>
        Match is Scheduled for
        <template v-if="match.scheduled_at">
          <time-ago :date="match.scheduled_at"></time-ago>
        </template>
        <template v-else> ASAP </template>
      </div>
    </template>
    <template v-else-if="startOfMatch">
      Match has been going on for
      <time-ago :date="startOfMatch"></time-ago>
    </template>
    <template v-else>
      {{ match.status }}
    </template>
  </p >
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
