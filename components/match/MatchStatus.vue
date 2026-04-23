<script setup lang="ts">
import { computed } from "vue";
import { e_match_status_enum, e_match_map_status_enum } from "~/generated/zeus";
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

const hasPausedMap = computed(() => {
  return props.match.match_maps?.some(
    (m) => m.status === e_match_map_status_enum.Paused,
  );
});

const badgeVariant = computed(() => {
  if (PROBLEM_STATUSES.includes(props.match.status as e_match_status_enum)) {
    return "destructive";
  }

  return "secondary";
});

const badgeClasses = computed(() => {
  const base =
    "inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] leading-none whitespace-nowrap";

  if (badgeVariant.value === "destructive") {
    return `${base} border-destructive/45 bg-destructive/10 text-destructive`;
  }

  if (props.match.status === e_match_status_enum.Live) {
    return `${base} border-green-500/45 bg-green-500/10 text-green-500`;
  }

  return `${base} border-border/70 bg-muted/35 text-muted-foreground`;
});
</script>

<template>
  <span :class="badgeClasses">
    <template v-if="match.status == e_match_status_enum.Canceled">
      {{ $t("match.status.cancelled") }}
    </template>
    <template v-else-if="match.status == e_match_status_enum.Finished">
      {{ $t("common.finished") }}
    </template>
    <template v-else-if="match.status == e_match_status_enum.Scheduled">
      <span v-if="match.server && !match.is_match_server_available">
        {{ $t("match.status.waiting_server") }}
      </span>
      <span class="flex items-center space-x-2" v-else>
        <template v-if="match.scheduled_at">
          <TimeAgo :date="match.scheduled_at"></TimeAgo>
        </template>
        <template v-else>{{ $t("match.status.scheduled_asap") }}</template>
      </span>
    </template>
    <template
      v-else-if="match.status === e_match_status_enum.Live && hasPausedMap"
    >
      {{ $t("match.status.paused") }}
    </template>
    <template v-else>
      {{ match.e_match_status.description }}
    </template>
  </span>
</template>
