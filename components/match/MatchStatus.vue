<script setup lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
import TimeAgo from "~/components/TimeAgo.vue";
</script>

<template>
  <Badge variant="secondary">
    <template v-if="match.status == e_match_status_enum.Canceled">
      Canceled
    </template>
    <template v-else-if="match.status == e_match_status_enum.Finished">
      Finished &nbsp; <time-ago :date="match.ended_at"></time-ago>
    </template>
    <template v-else-if="match.status == e_match_status_enum.Scheduled">
      <div v-if="match.server && !match.is_match_server_available">
        Waiting for server ...
      </div>
      <div v-else>
        Scheduled (<template v-if="match.scheduled_at">
          <time-ago :date="match.scheduled_at"></time-ago>
        </template>
        <template v-else>ASAP</template>)
      </div>
    </template>
    <template v-else>
      {{ match.status }}
    </template>
  </Badge>
</template>

<script lang="ts">
export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
};
</script>
