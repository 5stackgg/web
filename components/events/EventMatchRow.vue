<script setup lang="ts">
import { computed } from "vue";
import MatchLineupScoreDisplay from "~/components/match/MatchLineupScoreDisplay.vue";
import { TICKER_LIVE_STATUSES } from "~/components/watch/watchTicker";

// One dense result line for the event overview: when, where, who, score.
// Scores go through MatchLineupScoreDisplay so the colours match every other
// match surface.
const props = defineProps<{ match: any }>();

const live = computed(() =>
  (TICKER_LIVE_STATUSES as readonly string[]).includes(props.match.status),
);
const map = computed(
  () =>
    props.match.match_maps?.find((matchMap: any) => matchMap.is_current_map)
      ?.map ?? props.match.match_maps?.[0]?.map,
);
const when = computed(() => {
  const value = props.match.started_at || props.match.created_at;
  return value
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "";
});
const lost = (lineupId: string) =>
  !live.value &&
  !!props.match.winning_lineup_id &&
  props.match.winning_lineup_id !== lineupId;
</script>

<template>
  <NuxtLink
    :to="{ name: 'matches-id', params: { id: match.id } }"
    class="grid gap-1.5 px-3.5 py-2.5 transition-colors duration-150 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[5.5rem_8.5rem_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3"
  >
    <span class="flex min-w-0 items-center gap-2 sm:contents">
      <span
        class="whitespace-nowrap text-xs tabular-nums text-muted-foreground"
      >
        <span
          v-if="live"
          class="inline-flex items-center gap-1.5 font-semibold text-destructive"
        >
          <span class="relative inline-flex h-2 w-2">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75 motion-reduce:animate-none"
            ></span>
            <span
              class="relative inline-flex h-2 w-2 rounded-full bg-destructive"
            ></span>
          </span>
          {{ $t("event.phase.live") }}
        </span>
        <template v-else>{{ when }}</template>
      </span>
      <span
        class="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground/85"
      >
        <img
          v-if="map?.poster"
          :src="map.poster"
          alt=""
          loading="lazy"
          class="hidden h-[1.625rem] w-[2.875rem] shrink-0 rounded object-cover sm:block"
        />
        <span class="truncate">{{ map?.label ?? map?.name }}</span>
      </span>
    </span>

    <span
      class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:contents"
    >
      <span
        class="truncate text-right text-sm font-semibold"
        :class="lost(match.lineup_1_id) ? 'text-muted-foreground' : ''"
      >
        {{ match.lineup_1.name }}
      </span>
      <span
        class="flex items-center justify-center gap-1.5 whitespace-nowrap text-base tabular-nums"
      >
        <MatchLineupScoreDisplay
          :match="match"
          :lineup="match.lineup_1"
          :halves="false"
        />
        <span class="text-muted-foreground">:</span>
        <MatchLineupScoreDisplay
          :match="match"
          :lineup="match.lineup_2"
          :halves="false"
        />
      </span>
      <span
        class="truncate text-sm font-semibold"
        :class="lost(match.lineup_2_id) ? 'text-muted-foreground' : ''"
      >
        {{ match.lineup_2.name }}
      </span>
    </span>
  </NuxtLink>
</template>
