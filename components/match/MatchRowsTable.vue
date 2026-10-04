<script setup lang="ts">
import { ref, toRef } from "vue";
import PlayerMatchesTable from "~/components/player/PlayerMatchesTable.vue";
import { useMatchRowStats } from "~/composables/useMatchRowStats";

// A neutral PlayerMatchesTable with the per-page stats its rows show, for
// pages whose match list lives in Options API data.
const props = defineProps<{ matches: any[] }>();

const { statsByMatch, ratingByMatch, topPlayerByMatch } = useMatchRowStats(
  toRef(props, "matches"),
  ref(null),
);
</script>

<template>
  <PlayerMatchesTable
    neutral
    :matches="matches"
    :stats-by-match="statsByMatch"
    :rating-by-match="ratingByMatch"
    :top-player-by-match="topPlayerByMatch"
  />
</template>
