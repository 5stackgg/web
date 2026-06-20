<script setup lang="ts">
import PlayerElo from "~/components/PlayerElo.vue";
import PlayerPremierRank from "~/components/PlayerPremierRank.vue";
import PlayerFaceitRank from "~/components/PlayerFaceitRank.vue";

defineProps<{
  player: any;
}>();
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <PlayerElo :elo="player?.elo" :bordered="true" />
    <PlayerPremierRank
      :premier-rank="player?.premier_rank"
      :premier-rank-updated-at="player?.premier_rank_updated_at"
    />
    <PlayerFaceitRank
      :faceit-skill-level="player?.faceit_skill_level"
      :faceit-elo="player?.faceit_elo"
      :faceit-url="player?.faceit_url"
      :faceit-nickname="player?.faceit_nickname"
    />
  </div>
</template>
