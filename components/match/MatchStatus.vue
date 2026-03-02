<script setup lang="ts">
import { computed } from "vue";
import {
  e_match_status_enum,
  e_match_map_status_enum,
} from "~/generated/zeus";
import TimeAgo from "~/components/TimeAgo.vue";

const props = defineProps<{
  match: {
    status: string;
    e_match_status: { description: string };
    server?: any;
    is_match_server_available?: boolean;
    scheduled_at?: string;
    match_maps?: Array<{ status?: string }>;
  };
}>();

const PROBLEM_STATUSES = [
  e_match_status_enum.Canceled,
  e_match_status_enum.Forfeit,
  e_match_status_enum.Surrendered,
  e_match_status_enum.WaitingForServer,
];

const OK_STATUSES = [
  e_match_status_enum.Finished,
  e_match_status_enum.Tie,
  e_match_status_enum.Live,
  e_match_status_enum.Veto,
  e_match_status_enum.WaitingForCheckIn,
];

const hasPausedMap = computed(() => {
  return props.match.match_maps?.some(
    (m) => m.status === e_match_map_status_enum.Paused,
  );
});

const badgeVariant = computed(() => {
  if (PROBLEM_STATUSES.includes(props.match.status as e_match_status_enum))
    return "destructive";
  if (
    props.match.status === e_match_status_enum.Live &&
    hasPausedMap.value
  )
    return "destructive";
  if (OK_STATUSES.includes(props.match.status as e_match_status_enum))
    return "success";
  return "secondary";
});
</script>

<template>
  <Badge :variant="badgeVariant">
    <template v-if="match.status == e_match_status_enum.Canceled">
      {{ $t("match.status.cancelled") }}
    </template>
    <template v-else-if="match.status == e_match_status_enum.Finished">
      {{ $t("match.status.finished") }}
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
    <template
      v-else-if="match.status === e_match_status_enum.Live && hasPausedMap"
    >
      {{ $t("match.status.paused") }}
    </template>
    <template v-else>
      {{ match.e_match_status.description }}
    </template>
  </Badge>
</template>
