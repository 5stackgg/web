<script setup lang="ts">
import { e_match_status_enum } from "~/generated/zeus";
import TimeAgo from "~/components/TimeAgo.vue";
</script>

<template>
  <Badge variant="secondary">
    <template v-if="match.status == e_match_status_enum.Canceled">
      {{ $t("match.status.cancelled") }}
    </template>
    <template v-else-if="match.status == e_match_status_enum.Finished">
      {{ $t("match.status.finished") }} &nbsp;
      <time-ago :date="match.ended_at"></time-ago>
    </template>
    <template v-else-if="match.status == e_match_status_enum.Scheduled">
      <div v-if="match.server && !match.is_match_server_available">
        {{ $t("match.status.waiting_server") }}
      </div>
      <div class="flex items-center space-x-2" v-else>
        <template v-if="match.scheduled_at">
          <TimeAgo :date="match.scheduled_at"></TimeAgo>
        </template>
        <template v-else>{{ $t("match.status.scheduled_asap") }}</template>
      </div>
    </template>
    <template v-else>
      {{ match.e_match_status.description }}
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
