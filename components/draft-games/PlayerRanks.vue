<script setup lang="ts">
import { computed, inject } from "vue";
import PlayerElo from "~/components/PlayerElo.vue";
import PlayerPremierRank from "~/components/PlayerPremierRank.vue";
import PlayerFaceitRank from "~/components/PlayerFaceitRank.vue";
import {
  RANK_SLOTS_KEY,
  hasFaceitRank,
  hasPremierRank,
} from "~/components/draft-games/playerRanks";

const props = defineProps<{
  player: any;
}>();

const slots = inject(RANK_SLOTS_KEY, null);

const blankPremier = computed(
  () => !!slots?.value.premier && !hasPremierRank(props.player),
);
const blankFaceit = computed(
  () => !!slots?.value.faceit && !hasFaceitRank(props.player),
);

const blankClasses =
  "inline-flex h-[26px] select-none items-center gap-1.5 rounded-md border border-border bg-card/55 px-[0.6rem] leading-none text-muted-foreground/50";
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <PlayerElo :elo="player?.elo" :bordered="true" />
    <PlayerPremierRank
      :premier-rank="player?.premier_rank"
      :premier-rank-updated-at="player?.premier_rank_updated_at"
    />
    <span
      v-if="blankPremier"
      :class="blankClasses"
      :title="$t('draft_games.ranks.no_premier')"
    >
      <span class="inline-flex items-center gap-[3px]" aria-hidden="true">
        <span
          v-for="bar in 2"
          :key="bar"
          class="block h-[15px] w-[5px] rounded-[1px] bg-current [transform:skewX(-18deg)]"
        ></span>
      </span>
      <span class="h-3 w-px shrink-0 bg-border/70" aria-hidden="true"></span>
      <span class="font-mono text-[0.75rem] font-bold">—</span>
      <span class="sr-only">{{ $t("draft_games.ranks.no_premier") }}</span>
    </span>
    <PlayerFaceitRank
      :faceit-skill-level="player?.faceit_skill_level"
      :faceit-elo="player?.faceit_elo"
      :faceit-url="player?.faceit_url"
      :faceit-nickname="player?.faceit_nickname"
    />
    <span
      v-if="blankFaceit"
      :class="blankClasses"
      :title="$t('draft_games.ranks.no_faceit')"
    >
      <span
        class="grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-current font-mono text-[0.62rem] font-bold"
        aria-hidden="true"
        >–</span
      >
      <span class="sr-only">{{ $t("draft_games.ranks.no_faceit") }}</span>
    </span>
  </div>
</template>
