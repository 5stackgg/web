<script setup lang="ts">
import { computed } from "vue";
import { Badge } from "@/components/ui/badge";
import PlayerRanks from "~/components/draft-games/PlayerRanks.vue";

const props = defineProps<{
  ranks?: {
    avg_elo?: number | null;
    min_elo?: number | null;
    max_elo?: number | null;
    avg_faceit_level?: number | null;
    avg_faceit_elo?: number | null;
    avg_premier?: number | null;
    roster_size?: number | null;
  } | null;
  reputation?: {
    scrims_completed?: number | null;
    no_shows?: number | null;
    reliability_pct?: number | null;
  } | null;
}>();

const hasRanks = computed(() => (props.ranks?.roster_size ?? 0) > 0);

const player = computed(() => ({
  elo: { competitive: props.ranks?.avg_elo ?? undefined },
  premier_rank: props.ranks?.avg_premier ?? undefined,
  // FACEIT levels are 1–10 integers; round the team average so the badge shows
  // a whole level instead of an awkward decimal in the circular icon.
  faceit_skill_level:
    props.ranks?.avg_faceit_level != null
      ? Math.round(props.ranks.avg_faceit_level)
      : undefined,
  faceit_elo: props.ranks?.avg_faceit_elo ?? undefined,
}));
</script>

<template>
  <div v-if="hasRanks" class="flex flex-wrap items-center gap-2">
    <PlayerRanks :player="player" />

    <Badge
      v-if="reputation?.reliability_pct != null"
      variant="outline"
      :title="$t('team.rank_summary.reputation_title', { completed: reputation?.scrims_completed ?? 0, noShows: reputation?.no_shows ?? 0 })"
    >
      {{ $t('team.rank_summary.reliable', { pct: reputation?.reliability_pct }) }}
    </Badge>
  </div>
</template>
